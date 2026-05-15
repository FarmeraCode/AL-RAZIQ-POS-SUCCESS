import { api, ensureServerUrl, getServerUrl } from "./lan-client";
import { applyLanSnapshot, getLanSnapshot, type LanSnapshot } from "./pos-store";

type ServerStateResponse = { rev: number; ts: number; state: LanSnapshot | null };
type ServerStatePutResponse = { ok: true; rev: number; ts: number };

function makeClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function wsUrlFromHttp(httpBase: string) {
  const u = new URL(httpBase);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/ws";
  u.search = "";
  u.hash = "";
  return u.toString();
}

let started = false;
let clientId = "";
let lastSeenRev = 0;
let unsubscribe: null | (() => void) = null;
let ws: WebSocket | null = null;
let applyingRemote = false;
let pollTimer: number | null = null;

let pushTimer: number | null = null;
let pendingPush = false;

async function pullLatest() {
  const res = await api<ServerStateResponse>("/api/state");
  if (!res) return false;
  if (!res.state) return true; // no server state yet
  if (res.rev <= lastSeenRev) return true;

  lastSeenRev = res.rev;
  applyingRemote = true;
  try {
    applyLanSnapshot(res.state);
  } finally {
    applyingRemote = false;
  }
  return true;
}

async function seedIfEmpty() {
  const res = await api<ServerStateResponse>("/api/state");
  if (!res) return;
  if (res.state) return;
  await pushNow();
}

async function pushNow() {
  const snap = getLanSnapshot();
  const res = await api<ServerStatePutResponse>("/api/state", {
    method: "PUT",
    body: JSON.stringify({ clientId, state: snap }),
  });
  if (res) lastSeenRev = Math.max(lastSeenRev, res.rev);
}

function schedulePush() {
  if (applyingRemote) return;
  pendingPush = true;
  if (pushTimer != null) return;
  pushTimer = window.setTimeout(async () => {
    pushTimer = null;
    if (!pendingPush) return;
    pendingPush = false;
    await pushNow();
  }, 250);
}

function connectWs(httpBase: string) {
  try {
    const url = wsUrlFromHttp(httpBase);
    const next = new WebSocket(url);
    next.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg?.type === "state:rev") {
          if (msg.clientId === clientId) return;
          if (typeof msg.rev === "number" && msg.rev > lastSeenRev) pullLatest();
        }
      } catch {
        // ignore
      }
    };
    next.onclose = () => {
      if (ws === next) ws = null;
      // retry (best-effort)
      setTimeout(() => {
        const base = getServerUrl();
        if (base) connectWs(base);
      }, 1200);
    };
    ws = next;
  } catch {
    // ignore
  }
}

/**
 * Start LAN state sync (idempotent). Call once from the UI root.
 * If there is no server URL configured, it becomes a no-op.
 */
export async function startLanSync() {
  if (started) return;
  started = true;
  clientId = makeClientId();

  // Auto-discover on native clients if not configured.
  const base = await ensureServerUrl();
  if (!base) {
    started = false;
    return;
  }

  await pullLatest();
  // If the server has no state yet, seed it with this device's snapshot so
  // all other clients (phones/tablets) immediately see consistent data.
  await seedIfEmpty();

  // Subscribe to serializable snapshot only (throttled push) — LAN_KEYS excludes PIN/session fields.
  let lastSnapJson = "";
  unsubscribe = (await import("./pos-store")).usePos.subscribe(() => {
    const snap = JSON.stringify(getLanSnapshot());
    if (snap === lastSnapJson) return;
    lastSnapJson = snap;
    schedulePush();
  });

  connectWs(base);

  // Reliability fallback: if WS messages are dropped on some networks/devices,
  // periodic pulls keep all clients eventually consistent in both directions.
  pollTimer = window.setInterval(() => {
    pullLatest();
  }, 8000);
}

/** Re-resolve server URL and pull latest shared state (e.g. before PIN login on a LAN device). */
export async function pullLanStateOnce(): Promise<boolean> {
  const base = await ensureServerUrl();
  if (!base) return false;
  lastSeenRev = -1;
  return pullLatest();
}

export function stopLanSync() {
  unsubscribe?.();
  unsubscribe = null;
  try {
    ws?.close();
  } catch {
    // ignore
  }
  ws = null;
  if (pollTimer != null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  started = false;
}

