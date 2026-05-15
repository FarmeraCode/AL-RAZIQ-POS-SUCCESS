import { getRouter } from "./router";
import type { AnyRouter } from "@tanstack/react-router";

/**
 * Bypasses TanStack Start's SSR hydration logic for static Electron/Android builds.
 * This prevents "Invariant failed" errors caused by missing SSR contexts.
 */
export async function bootstrapPosRouter(): Promise<AnyRouter> {
  // Use our local router factory directly instead of the #tanstack-router-entry alias
  const router = getRouter();

  // Ensure the router is ready for the current URL/hash
  if (!router.stores.matchesId.get().length) {
    try {
      await router.load();
    } catch (err) {
      console.error("[bootstrap] router.load failed:", err);
    }
  }

  return router;
}
