/**
 * Tiny REST client for the bundled LAN server.
 *
 * Browser preview (hosted dev): no server reachable, calls return null
 * and the UI keeps using the local Zustand store. This is why the live
 * preview is UI-only — see BUILD_INSTRUCTIONS.md.
 *
 * Desktop (Electron): server runs on http://127.0.0.1:7000; UI loads from file://.
 * LAN browser: open http://<desktop-ip>:7000/ (server serves `dist` when POS_UI_ROOT is set).
 * Android (Capacitor): user sets the desktop's LAN IP in Settings, or UDP discovery.
 */
const KEY = "al-raziq-pos.server-url";
const LEGACY_SERVER_URL_KEY = "lovable-pos.server-url";
const LAST_GOOD_KEY = "al-raziq-pos.server-url.last-good";

/** Last URL that responded to /health in this session (see ensureServerUrl). */
let verifiedServerBase: string | null = null;

function normalizeBase(url: string) {
  return url.replace(/\/+$/, "");
}

/**
 * Node binds `0.0.0.0` (IPv4). Browsers often resolve `localhost` to `::1` first on Windows,
 * so `http://localhost:7000` fails while `http://127.0.0.1:7000` works. Use IPv4 for API bases.
 */
function preferIpv4LoopbackBase(base: string): string {
  try {
    const u = new URL(base);
    if (u.hostname === "localhost" || u.hostname === "[::1]" || u.hostname === "::1") {
      u.hostname = "127.0.0.1";
      return normalizeBase(u.toString());
    }
  } catch {
    /* ignore */
  }
  return normalizeBase(base);
}

/** Map page hostname to the host we use for same-machine API guesses (Vite dev on localhost). */
function apiGuessHost(pageHostname: string): string {
  if (pageHostname === "localhost" || pageHostname === "[::1]" || pageHostname === "::1") {
    return "127.0.0.1";
  }
  return pageHostname;
}

function isElectronFileOrigin() {
  return typeof window !== "undefined" && window.location.protocol === "file:";
}

function swapPort(base: string, port: number) {
  try {
    const u = new URL(base);
    u.port = String(port);
    return u.toString().replace(/\/$/, "");
  } catch {
    return base;
  }
}

function isLikelyAutoGuess(base: string) {
  // If user never configured a URL, we auto-guess "http://<host>:7000".
  // We treat that as "not user-intentional" and allow auto-fallback.
  try {
    const u = new URL(base);
    return u.port === "7000";
  } catch {
    return false;
  }
}

export function getServerUrl(): string | null {
  if (typeof window === "undefined") return null;
  if (verifiedServerBase) return verifiedServerBase;

  // In Electron, we often run the server on the same machine.
  // But we should allow discovery/manual override if needed.
  let stored = localStorage.getItem(KEY);
  if (!stored) {
    const legacy = localStorage.getItem(LEGACY_SERVER_URL_KEY);
    if (legacy) {
      localStorage.setItem(KEY, legacy);
      localStorage.removeItem(LEGACY_SERVER_URL_KEY);
      stored = legacy;
    }
  }

  // If served from a standard HTTP(S) origin (not file://), default to relative base.
  // This ensures that when served via LAN IP (e.g. 192.168.x.x:7000), it just works.
  if (!isElectronFileOrigin() && !stored) {
    const isViteDev = window.location.port === "5173";
    if (!isViteDev && window.location.port === "7000") {
      return window.location.origin;
    }
  }

  // For Electron/Local, default to 127.0.0.1 if nothing else is verified yet.
  if (isElectronFileOrigin() && !stored) return "http://127.0.0.1:7000";

  return stored || null;
}

export function setServerUrl(url: string) {
  verifiedServerBase = null;
  localStorage.setItem(KEY, normalizeBase(url));
}

function setLastGoodUrl(url: string) {
  try {
    localStorage.setItem(LAST_GOOD_KEY, normalizeBase(url));
  } catch {}
}

function getLastGoodUrl(): string | null {
  try {
    return localStorage.getItem(LAST_GOOD_KEY);
  } catch {
    return null;
  }
}

async function tryFetchJson<T>(
  base: string,
  path: string,
  init?: RequestInit & { staffRole?: string },
): Promise<{ ok: true; json: T } | { ok: false }> {
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.staffRole ? { "x-staff-role": init.staffRole } : {}),
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) return { ok: false };
    return { ok: true, json: (await res.json()) as T };
  } catch {
    return { ok: false };
  }
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { staffRole?: string },
): Promise<T | null> {
  const base0 = getServerUrl();
  if (!base0) return null;
  const base = normalizeBase(base0);

  const first = await tryFetchJson<T>(base, path, init);
  if (first.ok) {
    verifiedServerBase = base;
    setLastGoodUrl(base);
    return first.json;
  }

  const loop = preferIpv4LoopbackBase(base);
  if (loop !== base) {
    const viaLoop = await tryFetchJson<T>(loop, path, init);
    if (viaLoop.ok) {
      setServerUrl(loop);
      verifiedServerBase = loop;
      setLastGoodUrl(loop);
      return viaLoop.json;
    }
  }

  // Quick-fix for dev: if we auto-guessed :7000 but the server is actually on :7001,
  // retry once and persist the working URL.
  if (!isElectronFileOrigin() && isLikelyAutoGuess(base)) {
    const alt = swapPort(base, 7001);
    const second = await tryFetchJson<T>(alt, path, init);
    if (second.ok) {
      const altNorm = normalizeBase(alt);
      setServerUrl(altNorm);
      verifiedServerBase = altNorm;
      setLastGoodUrl(altNorm);
      return second.json;
    }
  }

  console.warn("[lan] request failed", path, { base });
  return null;
}

/** Prefer IPv4 loopback when the URL used `localhost` / `::1`, then original. */
async function resolvePingableServerBase(url: string): Promise<string | null> {
  const n = normalizeBase(url);
  const alt = preferIpv4LoopbackBase(n);
  const tryOrder = alt !== n ? [alt, n] : [n];
  for (const base of tryOrder) {
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) return normalizeBase(base);
    } catch {
      /* next */
    }
  }
  return null;
}

export async function pingServer(url: string): Promise<boolean> {
  return (await resolvePingableServerBase(url)) !== null;
}

/**
 * Ensure we have a working server URL without manual configuration.
 * - Uses persisted URL immediately if it works.
 * - Falls back to last-known-good URL.
 * - On native APK, uses UDP discovery to find the desktop server automatically.
 * - Finally falls back to same-host guesses (:7000 and :7001).
 */
export async function ensureServerUrl(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (isElectronFileOrigin()) {
    verifiedServerBase = "http://127.0.0.1:7000";
    return verifiedServerBase;
  }

  // Bypass verifiedServerBase while probing (getServerUrl reads verified first).
  verifiedServerBase = null;

  const storedRaw = localStorage.getItem(KEY);
  const legacy = !storedRaw ? localStorage.getItem(LEGACY_SERVER_URL_KEY) : null;
  if (legacy) {
    localStorage.setItem(KEY, legacy);
    localStorage.removeItem(LEGACY_SERVER_URL_KEY);
  }
  const storedManual = normalizeBase(storedRaw || legacy || "");

  const candidates: string[] = [];
  if (storedManual) candidates.push(storedManual);
  const last = getLastGoodUrl();
  if (last && !candidates.includes(last)) candidates.push(last);

  const host = window.location.hostname;
  const origin = window.location.origin;
  const guessHost = host ? apiGuessHost(host) : "";
  const guess0 = guessHost ? `http://${guessHost}:7000` : null;

  // Add current origin as a high-priority candidate if not file://
  if (!isElectronFileOrigin()) {
    candidates.unshift(origin);
  }
  const guess1 = guess0 ? swapPort(guess0, 7001) : null;

  for (const c of candidates) {
    if (!c) continue;
    const resolved = await resolvePingableServerBase(c);
    if (resolved) {
      verifiedServerBase = resolved;
      setLastGoodUrl(resolved);
      if (normalizeBase(c) !== resolved) setServerUrl(resolved);
      return resolved;
    }
  }

  try {
    const { discoverPosServerUrl } = await import("./lan-discovery");
    const discovered = await discoverPosServerUrl();
    const dResolved = discovered ? await resolvePingableServerBase(discovered) : null;
    if (dResolved) {
      setServerUrl(dResolved);
      verifiedServerBase = dResolved;
      setLastGoodUrl(dResolved);
      return dResolved;
    }
  } catch {
    // ignore
  }

  if (guess0) {
    const g0 = await resolvePingableServerBase(guess0);
    if (g0) {
      setServerUrl(g0);
      verifiedServerBase = g0;
      setLastGoodUrl(g0);
      return g0;
    }
  }
  if (guess1) {
    const g1 = await resolvePingableServerBase(guess1);
    if (g1) {
      setServerUrl(g1);
      verifiedServerBase = g1;
      setLastGoodUrl(g1);
      return g1;
    }
  }

  verifiedServerBase = null;
  return null;
}
