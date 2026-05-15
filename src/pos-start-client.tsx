import { RouterProvider } from "@tanstack/react-router";
import type { AnyRouter } from "@tanstack/router-core";
import { useEffect, useState } from "react";

import { bootstrapPosRouter } from "./bootstrap-pos-router";

export function POSStartClient() {
  const [router, setRouter] = useState<AnyRouter | null>(null);

  useEffect(() => {
    bootstrapPosRouter()
      .then((r) => {
        // Notify TanStack Start hydration helper if present
        (window as Window & { $_TSR?: { h?: () => void } }).$_TSR?.h?.();
        setRouter(r);
      })
      .catch((err) => {
        console.error("[pos-start-client] bootstrap failed", err);
        // Force an error that can be caught by a root boundary if needed
        throw err;
      });
  }, []);

  if (!router) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-sm text-muted-foreground font-medium">
          Initializing Al Raziq POS...
        </div>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}
