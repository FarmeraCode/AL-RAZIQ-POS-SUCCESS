import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, ShoppingCart, ChefHat, UtensilsCrossed, BookOpen, Package,
  Users, Tag, BarChart3, Settings, Menu as MenuIcon, X,
  ListOrdered, UserCog, Banknote, Wallet, LogOut, Lock, RotateCcw, BedDouble,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePos, staffCanAccess } from "@/lib/pos-store";
import alRaziqLogo from "@/assets/al-raziq-logo.png";
import { startLanSync, pullLanStateOnce } from "@/lib/lan-sync";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, mod: null as string | null },
  { to: "/pos", label: "POS", icon: ShoppingCart, mod: "pos" },
  { to: "/rooms", label: "Room Reservations", icon: BedDouble, mod: "rooms" },
  { to: "/kds", label: "Kitchen", icon: ChefHat, mod: "kds" },
  { to: "/tables", label: "Tables", icon: UtensilsCrossed, mod: "tables" },
  { to: "/orders", label: "Orders", icon: ListOrdered, mod: "orders" },
  { to: "/returns", label: "Sales Returns", icon: RotateCcw, mod: "orders" },
  { to: "/menu", label: "Menu", icon: BookOpen, mod: "menu" },
  { to: "/inventory", label: "Inventory", icon: Package, mod: "inventory" },
  { to: "/customers", label: "Customers", icon: Users, mod: "customers" },
  { to: "/promotions", label: "Promotions", icon: Tag, mod: "promotions" },
  { to: "/shifts", label: "Shifts", icon: Banknote, mod: "shifts" },
  { to: "/expenses", label: "Expenses", icon: Wallet, mod: "expenses" },
  { to: "/staff", label: "Staff & Access", icon: UserCog, mod: "staff" },
  { to: "/reports", label: "Reports", icon: BarChart3, mod: "reports" },
  { to: "/settings", label: "Settings", icon: Settings, mod: "settings" },
] as const;

export function AppLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState("");

  // Start LAN sync once (no-op if server URL isn't configured).
  useEffect(() => {
    startLanSync();
  }, []);

  const settings = usePos((s) => s.settings);
  const staff = usePos((s) => s.staff);
  const currentStaffId = usePos((s) => s.currentStaffId);
  const signInStaff = usePos((s) => s.signInStaff);
  const setCurrentStaff = usePos((s) => s.setCurrentStaff);
  const me = staff.find((s) => s.id === currentStaffId);

  // Filter nav by tenant-enabled module AND staff permission.
  // Owner sees ALL enabled modules regardless of per-staff permissions.
  // NOTE: owner check comes first so module flags never hide items from the owner.
  const visibleNav = NAV.filter((n) => {
    if (!me) return false;
    if (me.role === "owner") return true;  // owner sees everything
    // Non-owners: check module is enabled in tenant settings
    if (n.mod && !settings.modules[n.mod] && n.mod !== "staff" && n.mod !== "settings") return false;
    // staff/settings are owner-only
    if (n.mod === "staff" || n.mod === "settings") return false;
    return staffCanAccess(me, n.mod);
  });

  // If signed-in staff lands on a section they don't have access to, bounce to dashboard.
  useEffect(() => {
    if (!me) return;
    const current = NAV.find((n) => loc.pathname === n.to || (n.to !== "/" && loc.pathname.startsWith(n.to)));
    if (!current) return;
    const allowed = me.role === "owner"
      ? true
      : current.mod === "staff" || current.mod === "settings"
        ? false
        : staffCanAccess(me, current.mod);
    if (!allowed) navigate({ to: "/" });
  }, [me, loc.pathname, navigate]);

  const tryPin = async () => {
    setPinErr("");
    try {
      await pullLanStateOnce();
    } catch {
      // LAN optional — still allow offline PIN
    }
    const s = signInStaff(pin);
    if (s) { setPin(""); setPinErr(""); }
    else setPinErr("Invalid PIN. Try again.");
  };

  // ===== Lock screen — full app blocked until a valid PIN is entered =====
  // TanStack Router requires every parent of an active child route to render `<Outlet />`
  // even when the UI is "full screen". Omitting it caused packaged Electron builds to throw
  // `Uncaught Error: Invariant failed` (minified) while dev sometimes masked the issue.
  if (!me) {
    return (
      <div className="relative min-h-screen">
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gradient-primary">
          <div className="bg-card rounded-3xl p-8 w-full max-w-sm shadow-elegant">
            <div className="flex flex-col items-center mb-6">
              <div className="w-full max-w-[240px] rounded-2xl bg-white px-4 py-3 flex items-center justify-center shadow-glow mb-3">
                <img src={alRaziqLogo} alt="Al Raziq POS" className="max-h-28 w-full object-contain" />
              </div>
              <h1 className="text-xl font-bold">{settings.restaurantName}</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Lock className="h-3 w-3" /> Enter your 4-digit PIN to continue
              </p>
            </div>
            <input
              type="password" inputMode="numeric" maxLength={4} value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setPinErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && tryPin()}
              className="w-full px-3 py-3 rounded-lg border border-input bg-background text-center text-3xl tracking-[0.6em] font-mono mb-3"
              autoFocus
            />
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button key={n} type="button" onClick={() => setPin((p) => (p.length < 4 ? p + n : p))}
                  className="py-4 rounded-lg bg-secondary hover:bg-accent text-xl font-medium">{n}</button>
              ))}
              <button type="button" onClick={() => setPin("")} className="py-4 rounded-lg bg-secondary hover:bg-accent text-sm">Clear</button>
              <button type="button" onClick={() => setPin((p) => (p.length < 4 ? p + "0" : p))}
                className="py-4 rounded-lg bg-secondary hover:bg-accent text-xl font-medium">0</button>
              <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} className="py-4 rounded-lg bg-secondary hover:bg-accent text-sm">⌫</button>
            </div>
            {pinErr && <p className="text-xs text-destructive mt-3 text-center">{pinErr}</p>}
            <button type="button" onClick={tryPin} className="w-full mt-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium">
              Sign In
            </button>
            <p className="text-[10px] text-muted-foreground mt-3 text-center">
              Demo PINs · Owner: 1234 · Cashier: 1111 · Waiter: 2222 · Kitchen: 3333
            </p>
          </div>
        </div>
        {/* Required for TanStack Router: child routes (/ , /pos, …) stay mounted under the lock overlay */}
        <div className="pointer-events-none invisible absolute left-0 top-0 -z-10 h-px w-px overflow-hidden" aria-hidden>
          <Outlet />
        </div>
      </div>
    );
  }

  // ===== Authenticated app shell =====
  return (
    <div className="flex min-h-screen bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform lg:translate-x-0 lg:static lg:flex ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex w-64 flex-col">
          <div className="space-y-2 px-5 py-5 border-b border-sidebar-border">
            <img src={alRaziqLogo} alt="Al Raziq POS" className="h-14 w-full max-w-[220px] object-contain object-left drop-shadow-[0_0_10px_rgba(255,255,255,0.25)]" />
            <div>
              <div className="font-semibold text-sm truncate">{settings.restaurantName}</div>
              <div className="text-xs opacity-60">Al Raziq POS</div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {visibleNav.map((n) => {
              const active = loc.pathname === n.to || (n.to !== "/" && loc.pathname.startsWith(n.to));
              const Icon = n.icon;
              return (
                <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-elegant" : "hover:bg-sidebar-accent/50"}`}>
                  <Icon className="h-4 w-4" />{n.label}
                </Link>
              );
            })}
          </nav>
          <div className="px-4 py-3 border-t border-sidebar-border text-[11px] opacity-70 leading-tight">
            <div className="font-medium">Al Raziq POS · v3.0</div>
            <div className="opacity-80">Restaurant point of sale</div>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card/80 backdrop-blur px-4 lg:px-6">
          <button className="lg:hidden p-2 -ml-2 rounded-md hover:bg-accent" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
            {open ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
          <h1 className="text-base font-semibold">{NAV.find((n) => n.to === loc.pathname)?.label ?? "Dashboard"}</h1>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary">
              <span className="h-6 w-6 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-[10px]">{me.name.charAt(0)}</span>
              <span className="font-medium">{me.name}</span>
              <span className="text-muted-foreground capitalize">· {me.role}</span>
            </div>
            <button
              onClick={() => setCurrentStaff(undefined)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20"
              title="Sign out">
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto"><Outlet /></main>
      </div>
    </div>
  );
}
