import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

let routerInstance: ReturnType<typeof createRouter> | null = null;

/**
 * Plain SPA router: real browser URLs (`/pos`, `/rooms`, …) rather than the hash
 * history the old desktop/`file://` shell needed. Deep links work because the host
 * rewrites unknown paths to `index.html` (see vercel.json).
 */
export const getRouter = () => {
  if (routerInstance) return routerInstance;

  const queryClient = new QueryClient();

  routerInstance = createRouter({
    routeTree,
    context: { queryClient },
    basepath: "/",
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  });

  return routerInstance;
};
