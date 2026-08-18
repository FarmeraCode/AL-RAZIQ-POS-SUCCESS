// NOTE: `.js` specifiers are required — Vercel transpiles each api/*.ts file
// in place (no bundling), and Node's ESM loader rejects extensionless imports.
import { sendJson, type ApiRequest, type ApiResponse } from "./_http.js";
import { driver, durable } from "./_store.js";

/** Liveness + which storage driver this deployment resolved to. */
export default async function handler(_req: ApiRequest, res: ApiResponse) {
  sendJson(res, 200, {
    ok: true,
    name: "Al Raziq POS API",
    storage: driver,
    durable,
    time: Date.now(),
  });
}
