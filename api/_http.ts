/**
 * Tiny helpers so the same handler code runs on Vercel Functions and behind the
 * local Vite dev middleware. Both give us a plain Node req/res pair.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

export type ApiRequest = IncomingMessage & { body?: unknown };
export type ApiResponse = ServerResponse;

export function sendJson(res: ApiResponse, status: number, payload: unknown) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  // Shared POS state must never be served from a CDN/browser cache.
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(body);
}

const MAX_BODY_BYTES = 8 * 1024 * 1024; // full POS snapshots stay well under this

/** Read and parse a JSON body, whether or not the host pre-parsed it. */
export async function readJsonBody<T = Record<string, unknown>>(
  req: ApiRequest,
): Promise<T | null> {
  if (req.body && typeof req.body === "object") return req.body as T;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as T;
    } catch {
      return null;
    }
  }

  const raw = await new Promise<string>((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  }).catch(() => null);

  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
