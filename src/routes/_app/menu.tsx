import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { usePos, fmtMoney, type MenuItem, type Category } from "@/lib/pos-store";
import { Plus, Pencil, Trash2, FolderPlus, Download } from "lucide-react";
import { exportCsv } from "@/lib/export";

export const Route = createFileRoute("/_app/menu")({
  component: Menu,
});

function Menu() {
  const { items, categories, settings, upsertItem, deleteItem, upsertCategory, deleteCategory } = usePos();
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  const blank = (): MenuItem => ({
    id: crypto.randomUUID(), name: "", categoryId: categories[0]?.id ?? "", price: 0, available: true,
  });
  const blankCat = (): Category => ({ id: crypto.randomUUID(), name: "", icon: "🍽️" });

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Categories management */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-semibold">Categories</h3>
            <p className="text-xs text-muted-foreground">Add / edit / delete menu categories</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                exportCsv(
                  "menu_categories",
                  categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
                )
              }
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-sm"
            >
              <Download className="h-4 w-4" /> Export categories CSV
            </button>
            <button onClick={() => setEditingCat(blankCat())} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-sm">
              <FolderPlus className="h-4 w-4" /> New Category
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <div key={c.id} className="inline-flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-full border border-border bg-background text-sm">
              <span>{c.icon}</span><span>{c.name}</span>
              <button onClick={() => setEditingCat(c)} className="p-1 hover:bg-accent rounded-full"><Pencil className="h-3 w-3" /></button>
              <button onClick={() => confirm(`Delete "${c.name}" and all its items?`) && deleteCategory(c.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded-full"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      </section>

      {/* Items management */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Menu Items</h2>
          <p className="text-sm text-muted-foreground">{items.length} items across {categories.length} categories</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              exportCsv(
                "menu_items",
                items.map((i) => ({
                  id: i.id,
                  name: i.name,
                  category: categories.find((c) => c.id === i.categoryId)?.name ?? "",
                  price: i.price,
                  cost: i.cost ?? "",
                  available: i.available ? "yes" : "no",
                  sku: i.sku ?? "",
                  prep_minutes: i.prepTime ?? "",
                })),
              )
            }
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-sm"
          >
            <Download className="h-4 w-4" /> Export menu CSV
          </button>
          <button onClick={() => setEditing(blank())} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-elegant">
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr><th className="p-3">Name</th><th>Category</th><th>Price</th><th>Cost</th><th>Available</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="p-3 font-medium">{i.name}</td>
                <td>{categories.find((c) => c.id === i.categoryId)?.name}</td>
                <td>{fmtMoney(i.price, settings.currency)}</td>
                <td className="text-muted-foreground">{i.cost ? fmtMoney(i.cost, settings.currency) : "—"}</td>
                <td>
                  <span className={`text-xs px-2 py-0.5 rounded ${i.available ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {i.available ? "Yes" : "No"}
                  </span>
                </td>
                <td className="text-right pr-3">
                  <button onClick={() => setEditing(i)} className="p-1.5 hover:bg-accent rounded"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => confirm("Delete?") && deleteItem(i.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={`${items.find((x) => x.id === editing.id) ? "Edit" : "New"} Item`}>
          <div className="space-y-3">
            <Field label="Name"><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></Field>
            <Field label="Category">
              <select value={editing.categoryId} onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price"><input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: +e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></Field>
              <Field label="Cost"><input type="number" value={editing.cost ?? 0} onChange={(e) => setEditing({ ...editing, cost: +e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></Field>
            </div>
            <Field label="SKU"><input value={editing.sku ?? ""} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.available} onChange={(e) => setEditing({ ...editing, available: e.target.checked })} />
              Available
            </label>
          </div>
          <Footer onCancel={() => setEditing(null)} onSave={() => { if (!editing.name || !editing.categoryId) return alert("Name & category required"); upsertItem(editing); setEditing(null); }} />
        </Modal>
      )}

      {editingCat && (
        <Modal onClose={() => setEditingCat(null)} title={`${categories.find((x) => x.id === editingCat.id) ? "Edit" : "New"} Category`}>
          <div className="space-y-3">
            <Field label="Name"><input value={editingCat.name} onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></Field>
            <Field label="Icon (emoji)"><input value={editingCat.icon} onChange={(e) => setEditingCat({ ...editingCat, icon: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" /></Field>
          </div>
          <Footer onCancel={() => setEditingCat(null)} onSave={() => { if (!editingCat.name) return alert("Name required"); upsertCategory(editingCat); setEditingCat(null); }} />
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
function Footer({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  return (
    <div className="mt-5 flex gap-2 justify-end">
      <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-secondary text-sm">Cancel</button>
      <button onClick={onSave} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Save</button>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-xs font-medium mb-1 text-muted-foreground">{label}</div>{children}</label>;
}
