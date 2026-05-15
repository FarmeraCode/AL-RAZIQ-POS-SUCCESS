import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { usePos, fmtMoney } from "@/lib/pos-store";
import { Plus, Trash2, FolderPlus } from "lucide-react";
import { exportCsv, inDateRange, todayIso } from "@/lib/export";

export const Route = createFileRoute("/_app/expenses")({ component: Expenses });

function Expenses() {
  const { expenses, settings, addExpense, currentShiftId, expenseCategories, addExpenseCategory, deleteExpenseCategory } = usePos();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: expenseCategories[0] ?? "Misc", amount: 0, note: "" });
  const [newCat, setNewCat] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = inDateRange(expenses, from, to);
  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const today = expenses.filter((e) => new Date(e.createdAt).toDateString() === new Date().toDateString()).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Expenses</h2>
          <p className="text-sm text-muted-foreground">Track daily operating costs</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          <Plus className="h-4 w-4" /> Add Expense
        </button>
      </div>

      {/* Categories management */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <FolderPlus className="h-4 w-4" /><h3 className="font-semibold text-sm">Expense Categories</h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {expenseCategories.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-secondary text-xs">
              {c}
              <button onClick={() => confirm(`Remove category "${c}"?`) && deleteExpenseCategory(c)} className="p-0.5 hover:bg-destructive/15 text-destructive rounded-full"><Trash2 className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category…" className="flex-1 px-3 py-1.5 rounded-lg border border-input bg-background text-sm" />
          <button onClick={() => { if (newCat.trim()) { addExpenseCategory(newCat.trim()); setNewCat(""); } }} className="px-3 py-1.5 rounded-lg bg-secondary text-sm">Add</button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <Stat label="Today" value={fmtMoney(today, settings.currency)} />
        <Stat label="In Range" value={fmtMoney(total, settings.currency)} />
        <Stat label="Entries" value={filtered.length} />
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <DateFld label="From" value={from} onChange={setFrom} />
        <DateFld label="To" value={to} onChange={setTo} />
        <button onClick={() => { setFrom(todayIso()); setTo(todayIso()); }} className="px-3 py-2 rounded-lg bg-secondary text-sm">Today</button>
        <button onClick={() => { setFrom(""); setTo(""); }} className="px-3 py-2 rounded-lg bg-secondary text-sm">All</button>
        <button onClick={() => exportCsv(`expenses_${from || "all"}_${to || "all"}`, filtered.map((e) => ({ date: new Date(e.createdAt).toLocaleString(), number: e.number, category: e.category, amount: e.amount, note: e.note ?? "" })))} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Export CSV</button>
        <button onClick={() => window.print()} className="px-3 py-2 rounded-lg bg-secondary text-sm">Print</button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr><th className="p-3">#</th><th>Date</th><th>Category</th><th>Amount</th><th>Note</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No expenses recorded.</td></tr>
            ) : filtered.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="p-3 font-mono text-xs">#{e.number}</td>
                <td className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</td>
                <td className="font-medium">{e.category}</td>
                <td className="font-semibold text-destructive">-{fmtMoney(e.amount, settings.currency)}</td>
                <td className="text-muted-foreground">{e.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">New Expense</h3>
            <div className="space-y-3">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                {expenseCategories.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input type="number" placeholder="Amount" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: +e.target.value || 0 })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              <textarea placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" rows={2} />
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg bg-secondary text-sm">Cancel</button>
              <button onClick={() => { if (!form.amount) return alert("Amount required"); addExpense({ id: crypto.randomUUID(), ...form, shiftId: currentShiftId, createdAt: Date.now() }); setOpen(false); setForm({ category: expenseCategories[0] ?? "Misc", amount: 0, note: "" }); }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
function DateFld({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm" />
    </label>
  );
}
