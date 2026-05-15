import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/unlicensed")({
  component: UnlicensedRoute,
});

/**
 * License gate (nested under `/_app` so the route tree has a single root branch).
 * The desktop shell opens `/#/unlicensed` when no valid `license.key` is present.
 */
function UnlicensedRoute() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-lg w-full rounded-xl border border-border bg-card p-6 shadow-card">
        <h1 className="text-xl font-semibold text-foreground">License required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This device is not activated. Contact support for a valid <code className="rounded bg-muted px-1">license.key</code> file,
          or continue in trial/demo mode once a key has been issued for this machine.
        </p>
        <div className="mt-4 text-sm">
          <div className="font-medium text-foreground">What to do</div>
          <ol className="ml-5 mt-2 list-decimal space-y-1 text-muted-foreground">
            <li>Close the app.</li>
            <li>
              Place <code className="rounded bg-muted px-1">license.key</code> next to the desktop{" "}
              <code className="rounded bg-muted px-1">.exe</code> (same folder as the installer shortcut target, or the portable
              folder).
            </li>
            <li>Re-open the app.</li>
          </ol>
        </div>
        <div className="mt-5 rounded-lg border border-border bg-secondary p-3 text-xs text-muted-foreground">
          The file name must be exactly <code className="rounded bg-muted px-1">license.key</code> — not{" "}
          <code className="rounded bg-muted px-1">license.key.txt</code> (disable &quot;Hide extensions&quot; in Windows Explorer if
          unsure).
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Support: use the contact channel from your purchase or deployment agreement and include your machine ID from the
          installer logs if requested.
        </p>
      </div>
    </div>
  );
}
