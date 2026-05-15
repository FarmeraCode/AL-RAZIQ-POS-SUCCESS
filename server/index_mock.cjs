/* eslint-disable */
const path = require("path");
const os = require("os");
const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");

const PORT = 7000;
const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// In-memory mock database
let state = { rev: 0, ts: Date.now(), state: null };
let staff = [
  { id: "s1", name: "Owner Admin", pin: "1234", role: "owner", active: 1, permissions: "[]" }
];
let orders = [];

app.get("/health", (req, res) => res.json({ ok: true, mocked: true }));

app.post("/api/auth/pin", (req, res) => {
  const pin = String(req.body?.pin || "");
  const user = staff.find(s => s.pin === pin && s.active === 1);
  if (!user) return res.status(401).json({ error: "Unknown PIN" });
  const { pin: _, ...safe } = user;
  res.json({ staff: { ...safe, permissions: JSON.parse(safe.permissions || "[]") } });
});

app.get("/api/state", (req, res) => res.json(state));
app.put("/api/state", (req, res) => {
  state = { rev: state.rev + 1, ts: Date.now(), state: req.body.state };
  res.json({ ok: true, rev: state.rev, ts: state.ts });
});

app.get("/api/staff", (req, res) => res.json(staff.map(s => ({...s, permissions: JSON.parse(s.permissions)}))));

app.get("/api/orders", (req, res) => res.json(orders));

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[MOCK SERVER] Listening on http://0.0.0.0:${PORT}`);
});

const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "hello", ts: Date.now() }));
});
