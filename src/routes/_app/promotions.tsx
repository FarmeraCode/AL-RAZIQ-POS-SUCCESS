import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { usePos, type Promotion } from "@/lib/pos-store";
import { Plus, Tag } from "lucide-react";

export const Route = createFileRoute("/_app/promotions")({
  component: Promotions,
});

function Promotions() {
  const { promotions, upsertPromotion } = usePos();
  const [open, setOpen] = useState<Promotion | null>(null);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Promotions & Discounts</h2>
          <p className="text-sm text-muted-foreground">Manage coupons, happy hours, and BOGO deals</p>
        </div>
        <button onClick={() => setOpen({ id: crypto.randomUUID(), name: "", code: "", type: "percent", value: 10, active: true })} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          <Plus className="h-4 w-4" /> New Promotion
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {promotions.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center"><Tag className="h-4 w-4 text-primary-foreground" /></div>
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">{p.code}</code>
                </div>
              </div>
              <button onClick={() => upsertPromotion({ ...p, active: !p.active })} className={`text-xs font-medium px-2 py-1 rounded ${p.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                {p.active ? "Active" : "Off"}
              </button>
            </div>
            <div className="mt-3 text-2xl font-bold text-primary">
              {p.type === "percent" && `${p.value}% off`}
              {p.type === "flat" && `Flat ${p.value} off`}
              {p.type === "bogo" && `Buy 1 Get 1 (${p.value}% off)`}
            </div>
            <button onClick={() => setOpen(p)} className="mt-3 text-xs text-primary underline">Edit</button>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Promotion</h3>
            <div className="space-y-3">
              <input placeholder="Name" value={open.name} onChange={(e) => setOpen({ ...open, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              <input placeholder="Code" value={open.code || ""} onChange={(e) => setOpen({ ...open, code: e.target.value.toUpperCase() })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm uppercase" />
              <div className="grid grid-cols-2 gap-3">
                <select value={open.type} onChange={(e) => setOpen({ ...open, type: e.target.value as any })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value="percent">Percent</option>
                  <option value="flat">Flat amount</option>
                  <option value="bogo">BOGO</option>
                </select>
                <input type="number" placeholder="Value" value={open.value} onChange={(e) => setOpen({ ...open, value: +e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={open.active} onChange={(e) => setOpen({ ...open, active: e.target.checked })} /> Active
              </label>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setOpen(null)} className="px-4 py-2 rounded-lg bg-secondary text-sm">Cancel</button>
              <button onClick={() => { upsertPromotion(open); setOpen(null); }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
