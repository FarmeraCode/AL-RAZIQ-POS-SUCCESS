/**
 * Cloud sync for the hosted web app.
 *
 * Replaces the old LAN client (server-URL probing, UDP discovery, WebSockets).
 * Everything now talks to the *same origin* it was served from — `/api/state` —
 * so it works identically on localhost and on Vercel with zero configuration.
 *
 * Model (unchanged from the LAN build):
 *   - The Zustand store in this browser is the working copy; the app is fully
 *     usable with no network at all.
 *   - The server holds one shared snapshot with a monotonic `rev`. Local changes
 *     are pushed (debounced); remote changes are pulled on an interval and when
 *     the tab regains focus.
 *
 * If the API is unreachable (or storage isn't configured on the host), every call
 * degrades to a no-op and the POS keeps running purely on local storage.
 */
import { applyLanSnapshot, getLanSnapshot, type LanSnapshot } from "./pos-store";

export type SyncStatus = "idle" | "connecting" | "online" | "offline" | "syncing";

type ServerStateResponse = { rev: number; ts: number; state: LanSnapshot | null };
type ServerStatePutResponse = { ok: true; rev: number; ts: number };
type HealthResponse = { ok: boolean; storage: string; durable: boolean; time: number };

const PULL_INTERVAL_MS = 5000;
const PUSH_DEBOUNCE_MS = 300;

let started = false;
let clientId = "";
let lastSeenRev = 0;
let unsubscribe: null | (() => void) = null;
let applyingRemote = false;
let pollTimer: number | null = null;
let pushTimer: number | null = null;
let pendingPush = false;
let status: SyncStatus = "idle";

const listeners = new Set<(s: SyncStatus) => void>();

function setStatus(next: SyncStatus) {
  if (status === next) return;
  status = next;
  listeners.forEach((l) => l(next));
}

export function getSyncStatus() {
  return status;
}

/** Subscribe to sync status changes (used by the Settings page). */
export function onSyncStatus(fn: (s: SyncStatus) => void) {
  listeners.add(fn);
  fn(status);
  return () => {
    listeners.delete(fn);
  };
}

function makeClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Same-origin API call. Returns null on any failure — never throws. */
async function api<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function checkServer(): Promise<HealthResponse | null> {
  return api<HealthResponse>("/api/health");
}

async function pullLatest(): Promise<boolean> {
  const res = await api<ServerStateResponse>("/api/state");
  if (!res) {
    setStatus("offline");
    return false;
  }
  setStatus("online");
  if (!res.state) return true; // server has no snapshot yet
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

async function pushNow() {
  setStatus("syncing");
  const res = await api<ServerStatePutResponse>("/api/state", {
    method: "PUT",
    body: JSON.stringify({ clientId, state: getLanSnapshot() }),
  });
  if (res) {
    lastSeenRev = Math.max(lastSeenRev, res.rev);
    setStatus("online");
  } else {
    setStatus("offline");
  }
}

/** Seed the server from this device when it has never held a snapshot. */
async function seedIfEmpty() {
  const res = await api<ServerStateResponse>("/api/state");
  if (!res || res.state) return;
  await pushNow();
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
  }, PUSH_DEBOUNCE_MS);
}

function onVisible() {
  if (document.visibilityState === "visible") pullLatest();
}

/**
 * Start cloud sync (idempotent). Called once from the app shell.
 * Safe to call when the API is unavailable — it simply reports "offline".
 */
export async function startCloudSync() {
  if (started) return;
  started = true;
  clientId = makeClientId();
  setStatus("connecting");

  const health = await checkServer();
  if (!health?.ok) {
    setStatus("offline");
    // Keep retrying quietly: a deploy/cold start may just not be warm yet.
  }

  await pullLatest();
  await seedIfEmpty();

  // Push whenever the shared slice of the store changes.
  let lastSnapJson = "";
  unsubscribe = (await import("./pos-store")).usePos.subscribe(() => {
    const snap = JSON.stringify(getLanSnapshot());
    if (snap === lastSnapJson) return;
    lastSnapJson = snap;
    schedulePush();
  });

  pollTimer = window.setInterval(() => {
    pullLatest();
  }, PULL_INTERVAL_MS);

  document.addEventListener("visibilitychange", onVisible);
}

/** Force a fresh pull of shared state (e.g. right before PIN sign-in). */
export async function pullStateOnce(): Promise<boolean> {
  lastSeenRev = -1;
  return pullLatest();
}

export function stopCloudSync() {
  unsubscribe?.();
  unsubscribe = null;
  if (pollTimer != null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (pushTimer != null) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  document.removeEventListener("visibilitychange", onVisible);
  started = false;
  setStatus("idle");
}

/** Push this device's data to the server immediately (Settings → "Sync now"). */
export async function pushStateNow() {
  await pushNow();
}
