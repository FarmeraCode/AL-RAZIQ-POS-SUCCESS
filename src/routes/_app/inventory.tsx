import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { usePos, fmtMoney, type MenuItem, type InventoryItem, type InventoryMove } from "@/lib/pos-store";
import { Package, AlertTriangle, Plus, Minus, RotateCcw, Trash, Pencil, Trash2 } from "lucide-react";
import { exportCsv } from "@/lib/export";

export const Route = createFileRoute("/_app/inventory")({ component: Inventory });

function Inventory() {
  const {
    inventoryItems: inv, settings, inventoryMoves, adjustInventoryStock, setInventoryStock, upsertInventoryItem, deleteInventoryItem,
    inventoryCategories: invCatsRaw, addInventoryCategory, renameInventoryCategory, deleteInventoryCategory,
  } = usePos();
  const inventoryCategories = invCatsRaw ?? [];
  const [adjusting, setAdjusting] = useState<{ itemId: string; type: "in" | "out" | "waste" | "adjust" } | null>(null);
  const [qty, setQty] = useState(0);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [newInvCategory, setNewInvCategory] = useState("");

  const blank = (): InventoryItem => ({
    id: crypto.randomUUID(),
    name: "",
    category: inventoryCategories[0] ?? "Misc",
    sku: "",
    unit: "pcs",
    stock: 0,
    reorder: 10,
    cost: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const lowStock = inv.filter((i) => i.stock <= i.reorder).length;
  const value = inv.reduce((s, i) => s + (i.cost || 0) * i.stock, 0);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Inventory</h2>
          <p className="text-sm text-muted-foreground">Track stock & ingredient items (independent of menu)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv("inventory", inv.map((i) => ({ name: i.name, sku: i.sku ?? "", category: i.category, stock: i.stock, reorder: i.reorder, unit: i.unit, cost: i.cost ?? 0, value: (i.cost ?? 0) * i.stock })))} className="px-3 py-2 rounded-lg bg-secondary text-sm">Export CSV</button>
          <button onClick={() => setEditing(blank())} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat icon={Package} label="Total Items" value={inv.length} />
        <Stat icon={AlertTriangle} label="Low Stock" value={lowStock} accent="text-warning" />
        <Stat icon={Package} label="Inventory Value" value={fmtMoney(value, settings.currency)} />
        <Stat icon={Package} label="Out of Stock" value={inv.filter((i) => i.stock === 0).length} accent="text-destructive" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr><th className="p-3">Item</th><th>Category</th><th>SKU</th><th>Stock</th><th>Reorder</th><th>Unit</th><th>Cost</th><th>Value</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {inv.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No inventory items found. Add some to get started.</td></tr>
              ) : inv.map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="p-3 font-medium">{i.name}</td>
                  <td className="text-xs text-muted-foreground">{i.category}</td>
                  <td className="text-xs text-muted-foreground font-mono">{i.sku || "—"}</td>
                  <td>
                    <input type="number" value={i.stock} onChange={(e) => setInventoryStock(i.id, { stock: +e.target.value || 0 })} className="w-20 px-2 py-1 rounded border border-input bg-background text-sm" />
                  </td>
                  <td>
                    <input type="number" value={i.reorder} onChange={(e) => setInventoryStock(i.id, { reorder: +e.target.value || 0 })} className="w-16 px-2 py-1 rounded border border-input bg-background text-sm" />
                  </td>
                  <td>
                    <input value={i.unit} onChange={(e) => setInventoryStock(i.id, { unit: e.target.value })} className="w-16 px-2 py-1 rounded border border-input bg-background text-sm" />
                  </td>
                  <td>{fmtMoney(i.cost || 0, settings.currency)}</td>
                  <td>{fmtMoney((i.cost || 0) * i.stock, settings.currency)}</td>
                  <td>
                    {i.stock === 0 ? <span className="text-xs px-2 py-0.5 rounded bg-destructive/15 text-destructive">Out</span>
                      : i.stock <= i.reorder ? <span className="text-xs px-2 py-0.5 rounded bg-warning/15 text-warning-foreground">Low</span>
                      : <span className="text-xs px-2 py-0.5 rounded bg-success/15 text-success">OK</span>}
                  </td>
                  <td className="whitespace-nowrap px-3">
                    <button onClick={() => setEditing(i)} className="p-1 hover:bg-accent rounded" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { setAdjusting({ itemId: i.id, type: "in" }); setQty(0); setNote(""); }} className="p-1 hover:bg-success/10 text-success rounded" title="Stock In"><Plus className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { setAdjusting({ itemId: i.id, type: "out" }); setQty(0); setNote(""); }} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Stock Out"><Minus className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { setAdjusting({ itemId: i.id, type: "waste" }); setQty(0); setNote(""); }} className="p-1 hover:bg-warning/10 text-warning rounded" title="Waste"><Trash className="h-3.5 w-3.5" /></button>
                    <button onClick={() => confirm(`Delete ${i.name}?`) && deleteInventoryItem(i.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-semibold flex items-center gap-2 mb-3"><RotateCcw className="h-4 w-4" /> Recent Inventory Movements</h3>
        {inventoryMoves.length === 0 ? <p className="text-sm text-muted-foreground">No movements yet.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th>Date</th><th>Item</th><th>Type</th><th>Qty</th><th>Note</th></tr></thead>
            <tbody>
              {inventoryMoves.slice(0, 30).map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="py-2 text-xs">{new Date(m.createdAt).toLocaleString()}</td>
                  <td>{inv.find((i) => i.id === m.inventoryItemId)?.name || "Unknown"}</td>
                  <td><span className={`text-xs px-2 py-0.5 rounded uppercase ${m.type === "in" ? "bg-success/15 text-success" : m.type === "waste" ? "bg-warning/15 text-warning-foreground" : "bg-destructive/15 text-destructive"}`}>{m.type}</span></td>
                  <td>{m.qty}</td>
                  <td className="text-xs text-muted-foreground">{m.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-3">
        <h3 className="font-semibold">Inventory Categories</h3>
        <div className="flex gap-2">
          <input
            value={newInvCategory}
            onChange={(e) => setNewInvCategory(e.target.value)}
            placeholder="Add inventory category"
            className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm"
          />
          <button
            onClick={() => {
              const v = newInvCategory.trim();
              if (!v) return;
              addInventoryCategory(v);
              setNewInvCategory("");
            }}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
          >
            Add
          </button>
        </div>
        <div className="space-y-2">
          {inventoryCategories.map((cat) => (
            <div key={cat} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
              <span className="text-sm">{cat}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const n = prompt("Rename inventory category", cat)?.trim();
                    if (!n || n === cat) return;
                    renameInventoryCategory(cat, n);
                  }}
                  className="text-xs px-2 py-1 rounded bg-background"
                >
                  Rename
                </button>
                <button
                  onClick={() => confirm(`Delete "${cat}"?`) && deleteInventoryCategory(cat)}
                  className="text-xs px-2 py-1 rounded bg-destructive/10 text-destructive"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {adjusting && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setAdjusting(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Stock {adjusting.type.toUpperCase()}</h3>
            <p className="text-sm text-muted-foreground mb-4">{inv.find((i) => i.id === adjusting.itemId)?.name}</p>
            <div className="space-y-3">
              <input type="number" placeholder="Quantity" value={qty || ""} onChange={(e) => setQty(+e.target.value || 0)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              <input placeholder="Note (e.g., Supplier delivery, expired)" value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setAdjusting(null)} className="px-4 py-2 rounded-lg bg-secondary text-sm">Cancel</button>
              <button onClick={() => { adjustInventoryStock(adjusting.itemId, qty, adjusting.type, note); setAdjusting(null); }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{inv.find((x) => x.id === editing.id) ? "Edit" : "New"} Inventory Item</h3>
            <div className="space-y-3">
              <Field label="Name"><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></Field>
              <Field label="Inventory Category">
                <select
                  value={editing.category ?? ""}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                >
                  {inventoryCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Initial Stock"><input type="number" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: +e.target.value || 0 })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></Field>
                <Field label="Cost Price"><input type="number" value={editing.cost ?? 0} onChange={(e) => setEditing({ ...editing, cost: +e.target.value || 0 })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Reorder Level"><input type="number" value={editing.reorder} onChange={(e) => setEditing({ ...editing, reorder: +e.target.value || 0 })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></Field>
                <Field label="Unit (kg, pcs, etc.)"><input value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></Field>
              </div>
              <Field label="SKU"><input value={editing.sku ?? ""} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></Field>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-secondary text-sm">Cancel</button>
              <button onClick={() => { if (!editing.name) return alert("Name is required"); upsertInventoryItem(editing); setEditing(null); }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between"><div className="text-xs text-muted-foreground">{label}</div><Icon className={`h-4 w-4 ${accent || "text-primary"}`} /></div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-xs font-medium mb-1 text-muted-foreground">{label}</div>{children}</label>;
}
