import { QueryClient } from "@tanstack/react-query";
import { createHashHistory, createRouter, createMemoryHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

let routerInstance: ReturnType<typeof createRouter> | null = null;

// Initialize history early and explicitly to prevent "Invariant failed" in file:// environments.
const hashHistory = typeof window !== "undefined" ? createHashHistory() : null;
const memoryHistory = typeof window !== "undefined" ? null : createMemoryHistory();

export const getRouter = () => {
  if (routerInstance) return routerInstance;

  const queryClient = new QueryClient();

  routerInstance = createRouter({
    routeTree,
    context: { queryClient },
    // Use hash history for Electron/Android file:// compatibility.
    history: hashHistory || memoryHistory!,
    // Explicitly set basepath to '/' as requested.
    basepath: "/",
    // Hash + static Electron shell: scroll restoration can fight the router; keep off for stable .exe loads.
    scrollRestoration: false,
    defaultPreloadStaleTime: 0,
  });

  return routerInstance;
};
