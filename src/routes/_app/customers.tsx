import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { usePos, fmtMoney, type Customer } from "@/lib/pos-store";
import { Plus, Star, Phone, Mail } from "lucide-react";

export const Route = createFileRoute("/_app/customers")({
  component: Customers,
});

const TIER_STYLE: Record<Customer["tier"], string> = {
  bronze: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  silver: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  gold: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  platinum: "bg-gradient-primary text-primary-foreground",
};

function Customers() {
  const { customers, settings, upsertCustomer } = usePos();
  const [open, setOpen] = useState<Customer | null>(null);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Customers & Loyalty</h2>
          <p className="text-sm text-muted-foreground">{customers.length} customers · Earn 1 point per {settings.currency} 100</p>
        </div>
        <button onClick={() => setOpen({ id: crypto.randomUUID(), name: "", phone: "", points: 0, tier: "bronze", totalSpent: 0, visits: 0, joinedAt: Date.now() })} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          <Plus className="h-4 w-4" /> New Customer
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {customers.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{c.phone}</div>
                {c.email && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3" />{c.email}</div>}
              </div>
              <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${TIER_STYLE[c.tier]}`}>{c.tier}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div><div className="text-lg font-bold text-primary flex items-center justify-center gap-1"><Star className="h-3.5 w-3.5 fill-current" />{c.points}</div><div className="text-[10px] text-muted-foreground uppercase">Points</div></div>
              <div><div className="text-lg font-bold">{c.visits}</div><div className="text-[10px] text-muted-foreground uppercase">Visits</div></div>
              <div><div className="text-sm font-bold">{fmtMoney(c.totalSpent, settings.currency)}</div><div className="text-[10px] text-muted-foreground uppercase">Spent</div></div>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">New Customer</h3>
            <div className="space-y-3">
              <input placeholder="Name" value={open.name} onChange={(e) => setOpen({ ...open, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              <input placeholder="Phone" value={open.phone} onChange={(e) => setOpen({ ...open, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              <input placeholder="Email (optional)" value={open.email || ""} onChange={(e) => setOpen({ ...open, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setOpen(null)} className="px-4 py-2 rounded-lg bg-secondary text-sm">Cancel</button>
              <button onClick={() => { upsertCustomer(open); setOpen(null); }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
