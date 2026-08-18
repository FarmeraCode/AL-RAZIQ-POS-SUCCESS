// NOTE: `.js` specifiers are required — Vercel transpiles each api/*.ts file
// in place (no bundling), and Node's ESM loader rejects extensionless imports.
import { readJsonBody, sendJson, type ApiRequest, type ApiResponse } from "./_http.js";
import { readState, writeState } from "./_store.js";

/**
 * Shared POS snapshot.
 *
 *   GET  /api/state → { rev, ts, state }
 *   PUT  /api/state ← { clientId, state } → { ok, rev, ts }
 *
 * Same contract the LAN server exposed, so the client sync logic is unchanged in
 * behaviour: last write wins, and `rev` tells other devices to pull.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === "GET") {
    const current = await readState();
    return sendJson(res, 200, { rev: current.rev, ts: current.ts, state: current.state });
  }

  if (req.method === "PUT" || req.method === "POST") {
    const body = await readJsonBody<{ clientId?: string; state?: unknown }>(req);
    const incoming = body?.state;
    if (!incoming || typeof incoming !== "object") {
      return sendJson(res, 400, { error: "Missing state" });
    }
    const next = await writeState(incoming);
    return sendJson(res, 200, { ok: true, rev: next.rev, ts: next.ts });
  }

  res.setHeader("Allow", "GET, PUT");
  return sendJson(res, 405, { error: "Method not allowed" });
}
