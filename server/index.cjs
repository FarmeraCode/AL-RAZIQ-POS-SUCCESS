/* eslint-disable */
/**
 * Al Raziq POS — LAN server
 * -------------------------------------------------------------
 * Runs on any Windows machine without Microsoft Build Tools.
 * Uses Node.js v22+ built-in `node:sqlite` (DatabaseSync) —
 * zero native compilation, zero extra packages.
 *
 * Storage: SQLite via node:sqlite (built-in), stored in ~/.al-raziq-pos/pos.db
 *
 * This file is intentionally framework-free CommonJS so it can run
 * in the Node runtime without any build step.
 */

const path = require("path");
const os = require("os");
const fs = require("fs");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");
const dgram = require("dgram");

// ---------------------------------------------------------------------------
// Built-in SQLite (Node.js v22.5+) — no compilation, no Build Tools needed
// ---------------------------------------------------------------------------
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.POS_PORT || 7000);
const DISCOVERY_PORT = Number(process.env.POS_DISCOVERY_PORT || 7331);

/** Default hub DB folder on this machine. */
function defaultPosDataDir() {
  const h = os.homedir();
  const primary = path.join(h, ".al-raziq-pos");
  const legacy = path.join(h, ".lovable-pos");
  try {
    if (fs.existsSync(path.join(primary, "pos.db"))) return primary;
    if (fs.existsSync(path.join(legacy, "pos.db"))) return legacy;
  } catch {}
  return primary;
}

const DATA_DIR = process.env.POS_DATA_DIR || defaultPosDataDir();
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "pos.db"));
db.exec("PRAGMA journal_mode = WAL");

// -------- Schema --------
db.exec(`
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  phone TEXT,
  active INTEGER DEFAULT 1,
  permissions TEXT DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, name TEXT, category_id TEXT,
  price REAL, cost REAL, available INTEGER DEFAULT 1,
  taxable INTEGER DEFAULT 1, sku TEXT, prep_time INTEGER
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, name TEXT, icon TEXT
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, number INTEGER, type TEXT, table_id TEXT,
  customer_id TEXT, status TEXT, subtotal REAL, discount REAL,
  tax REAL, service REAL, total REAL, payment_method TEXT,
  fbr_invoice_number TEXT, fbr_qr_payload TEXT,
  staff_id TEXT, shift_id TEXT, created_at INTEGER, updated_at INTEGER,
  items_json TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  k TEXT PRIMARY KEY, v TEXT
);
`);

// Seed default owner if empty.
const staffCount = db.prepare("SELECT COUNT(*) AS n FROM staff").get().n;
if (staffCount === 0) {
  db.prepare(`INSERT INTO staff (id,name,pin,role,active,permissions) VALUES (?,?,?,?,1,?)`)
    .run("s1", "Owner Admin", "1234", "owner", "[]");
}

// -------- App --------
const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) =>
  res.json({ ok: true, name: "Al Raziq POS LAN server", port: PORT, time: Date.now() })
);

// ---------------------------------------------------------------------------
// Full POS state sync
// ---------------------------------------------------------------------------
const POS_STATE_KEY = "__al_raziq_pos_state__";

function readStateRow() {
  const row = db.prepare("SELECT v FROM settings WHERE k = ?").get(POS_STATE_KEY);
  if (!row) return { rev: 0, state: null, ts: 0 };
  try {
    const parsed = JSON.parse(row.v);
    if (parsed && typeof parsed === "object" && typeof parsed.rev === "number") return parsed;
  } catch {}
  return { rev: 0, state: null, ts: 0 };
}

function writeStateRow(next) {
  db.prepare("INSERT OR REPLACE INTO settings (k,v) VALUES (?,?)")
    .run(POS_STATE_KEY, JSON.stringify(next));
}

// PIN login — returns staff record without leaking PIN
app.post("/api/auth/pin", (req, res) => {
  const pin = String(req.body?.pin || "");
  if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: "Invalid PIN format" });
  const row = db.prepare("SELECT * FROM staff WHERE pin = ? AND active = 1").get(pin);
  if (!row) return res.status(401).json({ error: "Unknown PIN" });
  const { pin: _omit, ...safe } = row;
  res.json({ staff: { ...safe, permissions: JSON.parse(safe.permissions || "[]") } });
});

// Full-state sync endpoints.
app.get("/api/state", (_req, res) => {
  const current = readStateRow();
  res.json({ rev: current.rev, ts: current.ts, state: current.state });
});

app.put("/api/state", (req, res) => {
  const body = req.body || {};
  const clientId = String(body.clientId || "");
  const incoming = body.state;
  if (!incoming || typeof incoming !== "object") {
    return res.status(400).json({ error: "Missing state" });
  }

  const current = readStateRow();
  const next = { rev: current.rev + 1, ts: Date.now(), state: incoming };
  writeStateRow(next);

  broadcast({ type: "state:rev", rev: next.rev, ts: next.ts, clientId });
  res.json({ ok: true, rev: next.rev, ts: next.ts });
});

// Staff CRUD (owner only — caller must include x-staff-role: owner)
function ownerOnly(req, res, next) {
  if (req.header("x-staff-role") !== "owner") return res.status(403).json({ error: "Owner only" });
  next();
}

app.get("/api/staff", (_req, res) => {
  const rows = db.prepare("SELECT id,name,role,phone,active,permissions FROM staff").all();
  res.json(rows.map((r) => ({ ...r, permissions: JSON.parse(r.permissions || "[]") })));
});

app.post("/api/staff", ownerOnly, (req, res) => {
  const s = req.body || {};
  db.prepare(`INSERT OR REPLACE INTO staff (id,name,pin,role,phone,active,permissions)
              VALUES (?,?,?,?,?,?,?)`)
    .run(s.id, s.name, s.pin, s.role, s.phone || null,
         s.active ? 1 : 0, JSON.stringify(s.permissions || []));
  res.json({ ok: true });
});

app.delete("/api/staff/:id", ownerOnly, (req, res) => {
  db.prepare("DELETE FROM staff WHERE id = ? AND role != 'owner'").run(req.params.id);
  res.json({ ok: true });
});

// Generic key/value settings
app.get("/api/settings/:k", (req, res) => {
  const row = db.prepare("SELECT v FROM settings WHERE k = ?").get(req.params.k);
  res.json({ value: row ? JSON.parse(row.v) : null });
});
app.put("/api/settings/:k", (req, res) => {
  db.prepare("INSERT OR REPLACE INTO settings (k,v) VALUES (?,?)")
    .run(req.params.k, JSON.stringify(req.body?.value ?? null));
  res.json({ ok: true });
});

// Orders
app.get("/api/orders", (_req, res) => {
  const rows = db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 500").all();
  res.json(rows.map((r) => ({ ...r, items: JSON.parse(r.items_json || "[]") })));
});

app.post("/api/orders", (req, res) => {
  const o = req.body || {};
  db.prepare(`INSERT OR REPLACE INTO orders
    (id,number,type,table_id,customer_id,status,subtotal,discount,tax,service,total,
     payment_method,fbr_invoice_number,fbr_qr_payload,staff_id,shift_id,created_at,updated_at,items_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(o.id, o.number, o.type, o.tableId || null, o.customerId || null, o.status,
         o.subtotal, o.discount, o.tax, o.service || 0, o.total,
         o.paymentMethod || null, o.fbrInvoiceNumber || null, o.fbrQrPayload || null,
         o.staffId || null, o.shiftId || null, o.createdAt, o.updatedAt,
         JSON.stringify(o.items || []));
  broadcast({ type: "order:upsert", order: o });
  res.json({ ok: true });
});

// -------- Optional: web UI on the same port (LAN browsers) --------
const POS_UI_ROOT = process.env.POS_UI_ROOT ? path.resolve(process.env.POS_UI_ROOT) : "";

const uiIndexPath = fs.existsSync(path.join(POS_UI_ROOT, "index.html"))
  ? path.join(POS_UI_ROOT, "index.html")
  : fs.existsSync(path.join(POS_UI_ROOT, "client", "index.html"))
    ? path.join(POS_UI_ROOT, "client", "index.html")
    : "";

if (uiIndexPath) {
  console.log(`[Al Raziq POS] UI Root: ${POS_UI_ROOT}`);

  // 1. Serve the main dist folder (covers /client/assets/...)
  app.use(express.static(POS_UI_ROOT, { index: false, maxAge: "2h" }));

  // 2. Fallback: map /assets directly to client/assets (fixes dynamic import 404s)
  const clientAssetsPath = path.join(POS_UI_ROOT, "client", "assets");
  if (fs.existsSync(clientAssetsPath)) {
    app.use("/assets", express.static(clientAssetsPath));
  }

  // 3. Fallback: map root to client folder
  const clientPath = path.join(POS_UI_ROOT, "client");
  if (fs.existsSync(clientPath)) {
    app.use(express.static(clientPath, { index: false }));
  }

  // Support TanStack Start's default /_app base path for assets
  app.use("/_app", express.static(POS_UI_ROOT));

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    if (req.path === "/ws" || req.path.startsWith("/ws/")) return next();
    res.sendFile(uiIndexPath, (err) => (err ? next(err) : undefined));
  });
  console.log(`[Al Raziq POS] Web UI (LAN browser) active at port ${PORT}`);
}

// -------- WebSocket realtime broadcast --------
let wss;
function broadcast(msg) {
  if (!wss) return;
  const data = JSON.stringify(msg);
  wss.clients.forEach((c) => { if (c.readyState === 1) c.send(data); });
}

app.get("/api/info", (_req, res) => {
  const ips = listIpv4Addrs();
  res.json({
    ok: true,
    name: "Al Raziq POS LAN server",
    ips,
    port: PORT,
    url: ips.length > 0 ? `http://${ips[0]}:${PORT}` : `http://127.0.0.1:${PORT}`,
    time: Date.now()
  });
});

// `0.0.0.0` accepts IPv4 connections from any device on the LAN.
const server = http.createServer(app);
server.listen(PORT, "0.0.0.0", () => {
  const ips = listIpv4Addrs();
  console.log(`[Al Raziq POS] Listening on http://0.0.0.0:${PORT} (LAN)`);
  console.log(`[Al Raziq POS] This PC:     http://127.0.0.1:${PORT}/health`);
  console.log(`[Al Raziq POS] LAN URLs:`, ips.map((ip) => `http://${ip}:${PORT}`).join("  "));
  console.log(`[Al Raziq POS] Discovery UDP: 0.0.0.0:${DISCOVERY_PORT}`);
  console.log(`[Al Raziq POS] Data dir: ${DATA_DIR}`);
});

wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "hello", ts: Date.now() }));
});

// ---------------------------------------------------------------------------
// UDP LAN discovery
// ---------------------------------------------------------------------------
const DISCOVERY_PING = "WHERE_IS_POS_SERVER?";

function listIpv4Addrs() {
  return []
    .concat(...Object.values(os.networkInterfaces()))
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
}

function pickBestIpForRemote(remoteIp) {
  const ips = listIpv4Addrs();
  if (ips.length === 0) return "127.0.0.1";
  const r = String(remoteIp || "");
  const rPrefix = r.split(".").slice(0, 3).join(".");
  const same = ips.find((ip) => ip.split(".").slice(0, 3).join(".") === rPrefix);
  return same || ips[0];
}

const udp = dgram.createSocket({ type: "udp4", reuseAddr: true });
udp.on("error", (err) => {
  console.warn("[discovery] UDP error", err?.message || err);
});
udp.on("message", (buf, rinfo) => {
  const msg = String(buf || "").trim();
  if (msg !== DISCOVERY_PING) return;
  const ip = pickBestIpForRemote(rinfo.address);
  const payload = {
    ok: true,
    name: "Al Raziq POS LAN server",
    ip,
    port: PORT,
    url: `http://${ip}:${PORT}`,
    ts: Date.now(),
  };
  const out = Buffer.from(JSON.stringify(payload));
  udp.send(out, 0, out.length, rinfo.port, rinfo.address);
});
udp.bind(DISCOVERY_PORT, "0.0.0.0", () => {
  try {
    udp.setBroadcast(true);
  } catch {}
});

module.exports = { app, server };
