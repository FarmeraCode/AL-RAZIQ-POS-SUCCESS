/**
 * Dev entry: one central SQLite on this PC + API on all interfaces + Vite on LAN.
 * Sets POS_DATA_DIR so `npm --prefix server run dev` matches the "hub desktop" model.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.POS_DATA_DIR || path.join(os.homedir(), ".al-raziq-pos");
fs.mkdirSync(dataDir, { recursive: true });

const apiPort = String(Math.min(65535, Math.max(1, Number(process.env.POS_PORT) || 7000)));
const uiPort = String(Math.min(65535, Math.max(1, Number(process.env.VITE_DEV_PORT) || 5173)));
const env = { ...process.env, POS_DATA_DIR: dataDir, POS_PORT: apiPort, VITE_DEV_PORT: uiPort };

const nets = os.networkInterfaces();
const lanIps = []
  .concat(...Object.values(nets))
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => i.address);

console.log("");
console.log("[Al Raziq POS — dev LAN hub]");
console.log("  SQLite:          ", path.join(dataDir, "pos.db"));
console.log("");
console.log("  API (REST + WS) — open /health to verify:");
console.log("    ", `http://127.0.0.1:${apiPort}/health`);
if (lanIps.length) {
  for (const ip of lanIps) {
    console.log("    ", `http://${ip}:${apiPort}/health`);
  }
}
console.log("");
console.log("  Web UI (Vite) — use these in the browser:");
console.log("    ", `http://127.0.0.1:${uiPort}/`);
console.log("    ", `http://localhost:${uiPort}/`);
if (lanIps.length) {
  for (const ip of lanIps) {
    console.log("    ", `http://${ip}:${uiPort}/`);
  }
}
console.log("");
console.log("  If the UI port is busy, Vite may pick another port; read the [ui] lines below.");
console.log("  First Vite start can take 30-60s before the UI URLs respond — wait for [ui] ready.");
console.log("  If LAN cannot connect, allow Node.js through Windows Firewall (Private network).");
console.log("  SQLite: using Node.js built-in (node:sqlite) — no Build Tools required.");
console.log("");

const child = spawn("npm", ["run", "dev:lan:inner"], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 0));
