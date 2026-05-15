import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Component, type ErrorInfo, type ReactNode } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. You can try again or reload the app. If this persists, contact support with the message below.
        </p>
        <pre className="mt-3 max-h-32 overflow-auto rounded-md border border-border bg-muted p-2 text-left text-xs text-muted-foreground">
          {String(error?.message || error)}
        </pre>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              try {
                reset();
              } catch {
                /* ignore */
              }
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                window.location.hash = "#/";
              } catch {
                /* ignore */
              }
              try {
                window.location.reload();
              } catch {
                /* ignore */
              }
            }}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Reload app
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Al Raziq POS — Restaurant POS Suite" },
      { name: "description", content: "Al Raziq POS — restaurant point of sale for dine-in, delivery, and retail." },
      { name: "author", content: "Al Raziq POS" },
      { property: "og:title", content: "Al Raziq POS" },
      { property: "og:description", content: "Restaurant POS suite — orders, kitchen, inventory, and reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function isStaticSpaShell() {
  return (
    typeof window !== "undefined" &&
    !(window as Window & { $_TSR?: { router?: unknown } }).$_TSR?.router
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  // Electron / generated `dist/index.html` mounts into `#root` without SSR; avoid nesting `<html>` inside the mount node.
  if (isStaticSpaShell()) {
    return (
      <>
        {children}
      </>
    );
  }
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

class RootCatchBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state: { err: Error | null } = { err: null };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("[root] uncaught render error", err, info?.componentStack);
  }

  render() {
    if (this.state.err) {
      const msg = String(this.state.err?.message || this.state.err);
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
          <div className="max-w-lg w-full rounded-xl border border-border bg-card p-6 shadow-card text-center">
            <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The app hit an unexpected error. You can try reloading. If you are unlicensed, close the app, add{" "}
              <code className="rounded bg-muted px-1">license.key</code> next to the executable, then open again.
            </p>
            <pre className="mt-3 max-h-28 overflow-auto rounded-md border border-border bg-muted p-2 text-left text-xs text-muted-foreground">
              {msg}
            </pre>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => this.setState({ err: null })}
              >
                Try again
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
                onClick={() => {
                  try {
                    window.location.reload();
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <RootCatchBoundary>
        <Outlet />
      </RootCatchBoundary>
    </QueryClientProvider>
  );
}
