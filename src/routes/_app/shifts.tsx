import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { usePos, fmtMoney } from "@/lib/pos-store";
import { Banknote, LogIn, LogOut, Receipt as ReceiptIcon } from "lucide-react";

export const Route = createFileRoute("/_app/shifts")({ component: Shifts });

function Shifts() {
  const { shifts, staff, currentStaffId, currentShiftId, openShift, closeShift, orders, expenses, settings } = usePos();
  const [opening, setOpening] = useState(0);
  const [closing, setClosing] = useState(0);
  const [notes, setNotes] = useState("");

  const active = shifts.find((s) => s.id === currentShiftId && !s.closedAt);
  const me = staff.find((s) => s.id === currentStaffId);

  const ordersInShift = active
    ? orders.filter((o) => o.shiftId === active.id && o.paymentMethod && !["cancelled", "refunded"].includes(o.status))
    : [];
  const cashSales = ordersInShift.reduce((sum, o) => sum + (o.paymentMethod === "cash" ? o.total : o.paidCash || 0), 0);
  const cardSales = ordersInShift.reduce((sum, o) => sum + (o.paymentMethod === "card" ? o.total : o.paidCard || 0), 0);
  const walletSales = ordersInShift.reduce((sum, o) => sum + (o.paymentMethod === "wallet" ? o.total : o.paidWallet || 0), 0);
  const expensesInShift = active ? expenses.filter((e) => e.shiftId === active.id).reduce((s, e) => s + e.amount, 0) : 0;
  const expectedCash = active ? active.openingCash + cashSales - expensesInShift : 0;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {!active ? (
        <div className="rounded-xl border border-border bg-card p-6 shadow-card max-w-md">
          <h2 className="text-lg font-bold flex items-center gap-2"><LogIn className="h-5 w-5 text-primary" /> Open Shift</h2>
          <p className="text-sm text-muted-foreground mt-1">Start your shift by entering opening cash drawer amount.</p>
          {!currentStaffId && (
            <div className="mt-3 rounded-lg bg-warning/15 text-warning-foreground p-3 text-xs">
              Sign in as a staff member first from the top-right user menu.
            </div>
          )}
          <div className="mt-4 space-y-3">
            <label className="block">
              <div className="text-xs font-medium mb-1 text-muted-foreground">Opening cash ({settings.currency})</div>
              <input type="number" value={opening || ""} onChange={(e) => setOpening(+e.target.value || 0)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
            </label>
            <button
              disabled={!currentStaffId || opening < 0}
              onClick={() => { openShift(currentStaffId!, opening); setOpening(0); }}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
            >
              Open Shift
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-gradient-hero p-6 text-primary-foreground shadow-elegant">
            <p className="text-sm opacity-90">Active Shift · {me?.name}</p>
            <h2 className="text-2xl font-bold mt-1">Opened {new Date(active.openedAt).toLocaleString()}</h2>
            <p className="text-sm opacity-80 mt-1">Opening cash: <strong>{fmtMoney(active.openingCash, settings.currency)}</strong></p>
          </div>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Stat label="Orders" value={ordersInShift.length} />
            <Stat label="Cash Sales" value={fmtMoney(cashSales, settings.currency)} />
            <Stat label="Card Sales" value={fmtMoney(cardSales, settings.currency)} />
            <Stat label="Wallet Sales" value={fmtMoney(walletSales, settings.currency)} />
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h3 className="font-semibold flex items-center gap-2 mb-3"><LogOut className="h-4 w-4 text-destructive" /> Close Shift</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 text-sm">
                <Row label="Opening Cash" v={fmtMoney(active.openingCash, settings.currency)} />
                <Row label="Cash Sales" v={`+${fmtMoney(cashSales, settings.currency)}`} />
                <Row label="Expenses" v={`-${fmtMoney(expensesInShift, settings.currency)}`} />
                <div className="flex justify-between font-bold border-t border-border pt-2"><span>Expected in drawer</span><span>{fmtMoney(expectedCash, settings.currency)}</span></div>
              </div>
              <div className="space-y-3">
                <label className="block">
                  <div className="text-xs font-medium mb-1 text-muted-foreground">Counted cash ({settings.currency})</div>
                  <input type="number" value={closing || ""} onChange={(e) => setClosing(+e.target.value || 0)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                </label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" rows={2} />
                <div className="text-sm">
                  Variance: <strong className={closing - expectedCash === 0 ? "text-success" : "text-destructive"}>
                    {fmtMoney(closing - expectedCash, settings.currency)}
                  </strong>
                </div>
                <button onClick={() => { closeShift(active.id, closing, notes); setClosing(0); setNotes(""); }} className="w-full py-2.5 rounded-lg bg-destructive text-destructive-foreground font-medium">
                  Close Shift
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><ReceiptIcon className="h-4 w-4" /> Shift History</h3>
        {shifts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No shifts yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th>Staff</th><th>Opened</th><th>Closed</th><th>Open Cash</th><th>Closed</th><th>Expected</th><th>Variance</th></tr></thead>
            <tbody>
              {shifts.map((s) => {
                const sName = staff.find((x) => x.id === s.staffId)?.name;
                const variance = s.closingCash != null && s.expectedCash != null ? s.closingCash - s.expectedCash : null;
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-2">{sName}</td>
                    <td className="text-xs">{new Date(s.openedAt).toLocaleString()}</td>
                    <td className="text-xs">{s.closedAt ? new Date(s.closedAt).toLocaleString() : <span className="text-success">Active</span>}</td>
                    <td>{fmtMoney(s.openingCash, settings.currency)}</td>
                    <td>{s.closingCash != null ? fmtMoney(s.closingCash, settings.currency) : "—"}</td>
                    <td>{s.expectedCash != null ? fmtMoney(s.expectedCash, settings.currency) : "—"}</td>
                    <td className={variance == null ? "" : variance === 0 ? "text-success" : "text-destructive"}>
                      {variance == null ? "—" : fmtMoney(variance, settings.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: any) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between"><div className="text-xs text-muted-foreground">{label}</div><Banknote className="h-4 w-4 text-primary" /></div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
function Row({ label, v }: { label: string; v: string }) {
  return <div className="flex justify-between text-muted-foreground"><span>{label}</span><span>{v}</span></div>;
}
