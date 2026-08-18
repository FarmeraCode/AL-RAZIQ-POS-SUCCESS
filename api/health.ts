import { sendJson, type ApiRequest, type ApiResponse } from "./_http";
import { driver, durable } from "./_store";

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
