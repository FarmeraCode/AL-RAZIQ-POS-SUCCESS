/**
 * Shared-state storage for the POS API.
 *
 * Replaces the old `~/.al-raziq-pos/pos.db` SQLite file, which cannot exist on a
 * serverless host. Three drivers, picked automatically:
 *
 *   1. `redis` — Vercel Marketplace Redis / Upstash. Durable, shared across all
 *      instances and regions. Enabled as soon as the KV env vars exist.
 *   2. `file`  — `.pos-data/state.json` next to the project. Used for local
 *      `npm run dev`, so localhost behaves exactly like the old desktop build.
 *   3. `memory` — last-resort fallback (a deploy with no storage configured).
 *      Works, but resets when the serverless instance goes cold.
 *
 * The payload is the same envelope the LAN server used: { rev, ts, state }.
 */
import fs from "node:fs";
import path from "node:path";

export type StateEnvelope = {
  rev: number;
  ts: number;
  state: unknown | null;
};

export type Driver = "redis" | "file" | "memory";

const STATE_KEY = "al-raziq-pos:state";
const EMPTY: StateEnvelope = { rev: 0, ts: 0, state: null };

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const isServerless = Boolean(process.env.VERCEL);

export const driver: Driver = redisUrl && redisToken ? "redis" : isServerless ? "memory" : "file";

/** Durable = survives restarts and is shared between server instances. */
export const durable = driver !== "memory";

// ── memory driver ────────────────────────────────────────────────────────────
// Module scope survives between invocations on a warm instance.
let memoryState: StateEnvelope = { ...EMPTY };

// ── file driver ──────────────────────────────────────────────────────────────
const dataDir = process.env.POS_DATA_DIR || path.join(process.cwd(), ".pos-data");
const dataFile = path.join(dataDir, "state.json");

function readFileState(): StateEnvelope {
  try {
    const raw = fs.readFileSync(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.rev === "number") {
      return parsed as StateEnvelope;
    }
  } catch {
    /* missing or corrupt — start fresh */
  }
  return { ...EMPTY };
}

function writeFileState(next: StateEnvelope) {
  fs.mkdirSync(dataDir, { recursive: true });
  // Write-then-rename so a crash mid-write can't truncate an existing snapshot.
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next), "utf8");
  fs.renameSync(tmp, dataFile);
}

// ── redis driver (Upstash REST — fetch only, no SDK dependency) ───────────────
async function redisGet(): Promise<StateEnvelope> {
  const res = await fetch(`${redisUrl}/get/${encodeURIComponent(STATE_KEY)}`, {
    headers: { Authorization: `Bearer ${redisToken}` },
    cache: "no-store",
  });
  if (!res.ok) return { ...EMPTY };
  const body = (await res.json()) as { result?: string | null };
  if (!body.result) return { ...EMPTY };
  try {
    const parsed = JSON.parse(body.result);
    if (parsed && typeof parsed === "object" && typeof parsed.rev === "number") {
      return parsed as StateEnvelope;
    }
  } catch {
    /* fall through */
  }
  return { ...EMPTY };
}

async function redisSet(next: StateEnvelope): Promise<void> {
  await fetch(`${redisUrl}/set/${encodeURIComponent(STATE_KEY)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
}

// ── public API ───────────────────────────────────────────────────────────────
export async function readState(): Promise<StateEnvelope> {
  if (driver === "redis") return redisGet();
  if (driver === "file") return readFileState();
  return memoryState;
}

export async function writeState(state: unknown): Promise<StateEnvelope> {
  const current = await readState();
  const next: StateEnvelope = { rev: current.rev + 1, ts: Date.now(), state };

  if (driver === "redis") await redisSet(next);
  else if (driver === "file") writeFileState(next);
  else memoryState = next;

  return next;
}
