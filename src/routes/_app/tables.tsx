import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { usePos, type Table } from "@/lib/pos-store";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/tables")({
  component: Tables,
});

const STATUS_STYLE: Record<string, string> = {
  available: "bg-success/15 border-success text-success",
  occupied: "bg-destructive/15 border-destructive text-destructive",
  reserved: "bg-warning/15 border-warning text-warning-foreground",
  cleaning: "bg-muted border-border text-muted-foreground",
};

function Tables() {
  const { tables, setTableStatus, orders, upsertTable, deleteTable } = usePos();
  const zones = Array.from(new Set(tables.map((t) => t.zone)));
  const [editing, setEditing] = useState<Table | null>(null);

  const blank = (): Table => ({ id: crypto.randomUUID(), name: "", seats: 4, zone: "Indoor", status: "available" });

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-wrap gap-3 text-xs">
          {(["available", "occupied", "reserved", "cleaning"] as const).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded ${STATUS_STYLE[s].split(" ")[0]}`} />
              <span className="capitalize text-muted-foreground">{s}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setEditing(blank())} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm">
          <Plus className="h-4 w-4" /> Add Table
        </button>
      </div>

      {zones.map((zone) => (
        <div key={zone}>
          <h3 className="font-semibold mb-3">{zone}</h3>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {tables.filter((t) => t.zone === zone).map((t) => {
              const order = orders.find((o) => o.id === t.orderId);
              return (
                <div key={t.id} className={`rounded-xl border-2 p-4 ${STATUS_STYLE[t.status]} bg-card`}>
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-lg">{t.name}</div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditing(t)} className="p-1 hover:bg-accent rounded"><Pencil className="h-3 w-3" /></button>
                      <button onClick={() => confirm(`Delete ${t.name}?`) && deleteTable(t.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <div className="text-xs">{t.seats} seats</div>
                  <div className="mt-2 text-xs capitalize">{t.status}</div>
                  {order && <div className="mt-1 text-xs text-foreground">Order #{order.number}</div>}
                  <div className="mt-3 grid grid-cols-2 gap-1">
                    <Link to="/pos" className="text-[11px] py-1.5 rounded bg-primary text-primary-foreground text-center">Order</Link>
                    <select
                      value={t.status}
                      onChange={(e) => setTableStatus(t.id, e.target.value as Table["status"])}
                      className="text-[11px] py-1 rounded bg-background border border-border text-foreground"
                    >
                      <option value="available">Available</option>
                      <option value="occupied">Occupied</option>
                      <option value="reserved">Reserved</option>
                      <option value="cleaning">Cleaning</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{tables.find((x) => x.id === editing.id) ? "Edit" : "New"} Table</h3>
            <div className="space-y-3">
              <Field label="Name"><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Seats"><input type="number" value={editing.seats} onChange={(e) => setEditing({ ...editing, seats: +e.target.value || 0 })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></Field>
                <Field label="Zone"><input value={editing.zone} onChange={(e) => setEditing({ ...editing, zone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></Field>
              </div>
              <Field label="Status">
                <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as Table["status"] })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                  <option value="cleaning">Cleaning</option>
                </select>
              </Field>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-secondary text-sm">Cancel</button>
              <button onClick={() => { if (!editing.name) return alert("Name required"); upsertTable(editing); setEditing(null); }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-xs font-medium mb-1 text-muted-foreground">{label}</div>{children}</label>;
}
