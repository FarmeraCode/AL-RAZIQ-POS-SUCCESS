import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";

function AppShell() {
  const loc = useLocation();
  // License screen is a sibling file route under `/_app`; skip POS chrome so we never touch LAN/store hooks here.
  if (loc.pathname === "/unlicensed") {
    return <Outlet />;
  }
  return <AppLayout />;
}

export const Route = createFileRoute("/_app")({
  component: AppShell,
});
