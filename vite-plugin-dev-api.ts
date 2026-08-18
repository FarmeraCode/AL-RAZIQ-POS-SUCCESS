import type { Plugin } from "vite";

/**
 * Runs the `/api/*` serverless handlers inside the Vite dev server.
 *
 * On Vercel each file in `api/` becomes its own function; locally there is no
 * such runtime, so this middleware maps `/api/<name>` to `api/<name>.ts` and
 * calls the same default export with the same (req, res) pair. One `npm run dev`
 * therefore serves the UI *and* the API on a single localhost port.
 */
export function devApi(): Plugin {
  return {
    name: "al-raziq-dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        if (!url.startsWith("/api/")) return next();

        const pathname = url.split("?")[0].replace(/\/+$/, "");
        const name = pathname.slice("/api/".length);
        // `_`-prefixed modules are shared helpers, not routes (same rule as Vercel).
        if (!name || name.startsWith("_") || name.includes("..")) return next();

        void (async () => {
          try {
            const mod = await server.ssrLoadModule(`/api/${name}.ts`);
            const handler = (mod as { default?: (req: unknown, res: unknown) => unknown }).default;
            if (typeof handler !== "function") return next();
            await handler(req, res);
          } catch (err) {
            server.config.logger.error(`[dev-api] /api/${name} failed: ${String(err)}`);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
            }
            res.end(JSON.stringify({ error: "API handler failed", detail: String(err) }));
          }
        })();
      });
    },
  };
}
