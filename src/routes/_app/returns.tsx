import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { usePos, fmtMoney, type Order, type OrderItem, type PaymentMethod } from "@/lib/pos-store";
import { exportCsv, inDateRange, todayIso } from "@/lib/export";
import { RotateCcw, Plus } from "lucide-react";

export const Route = createFileRoute("/_app/returns")({ component: Returns });

function Returns() {
  const { orders, salesReturns, settings, addSalesReturn, addManualSalesReturn } = usePos();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pickingOrder, setPickingOrder] = useState<Order | null>(null);
  const [retQty, setRetQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>("cash");
  const [orderQuery, setOrderQuery] = useState("");
  const [manualItems, setManualItems] = useState<OrderItem[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState(1);
  const [manualAmount, setManualAmount] = useState(0);

  const filtered = useMemo(() => inDateRange(salesReturns, from, to), [salesReturns, from, to]);
  const totalRefund = filtered.reduce((s, r) => s + r.refundAmount, 0);

  const returnableStatuses = new Set<Order["status"]>(["sent", "preparing", "ready", "served", "paid"]);
  const paidOrders = orders.filter((o) => returnableStatuses.has(o.status));
  const matchOrders = paidOrders.filter((o) =>
    !orderQuery || String(o.number).includes(orderQuery) || o.id.includes(orderQuery)
  ).slice(0, 8);

  const submit = () => {
    if (!pickingOrder) return;
    const itemsToReturn: OrderItem[] = pickingOrder.items
      .filter((it) => (retQty[it.id] ?? 0) > 0)
      .map((it) => ({ ...it, qty: Math.min(it.qty, retQty[it.id]) }));
    if (itemsToReturn.length === 0) return alert("Pick at least one item & qty");
    const r = addSalesReturn({ orderId: pickingOrder.id, items: itemsToReturn, reason, refundMethod });
    if (r) {
      alert(`Return #${r.number} created. Refund: ${fmtMoney(r.refundAmount, settings.currency)}`);
      setPickingOrder(null); setRetQty({}); setReason("");
    }
  };

  const addManualItem = () => {
    const name = manualName.trim();
    const qty = Math.max(1, manualQty || 1);
    const amount = Math.max(0, manualAmount || 0);
    if (!name || amount <= 0) return;
    const unit = amount / qty;
    setManualItems((prev) => [...prev, {
      id: crypto.randomUUID(),
      itemId: `manual-${Date.now()}`,
      name,
      qty,
      price: unit,
    }]);
    setManualName("");
    setManualQty(1);
    setManualAmount(0);
  };

  const removeManualItem = (id: string) => {
    setManualItems((prev) => prev.filter((x) => x.id !== id));
  };

  const processManualReturn = () => {
    if (manualItems.length === 0) return alert("Add at least one manual return item.");
    const refundAmount = manualItems.reduce((s, it) => s + it.price * it.qty, 0);
    const r = addManualSalesReturn({ items: manualItems, refundAmount, reason, refundMethod });
    if (r) {
      alert(`Manual return #${r.number} created. Refund: ${fmtMoney(r.refundAmount, settings.currency)}`);
      setManualItems([]);
      setReason("");
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><RotateCcw className="h-5 w-5" /> Sales Returns</h2>
          <p className="text-sm text-muted-foreground">Refund items and restore stock automatically</p>
        </div>
        <button onClick={() => { setOrderQuery(""); setPickingOrder(null); setRetQty({}); document.getElementById("ret-search")?.focus(); }} className="hidden" />
      </div>

      {/* New return */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> New Return</h3>
        <input id="ret-search" value={orderQuery} onChange={(e) => { setOrderQuery(e.target.value); setPickingOrder(null); }} placeholder="Search order # or ID…" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />

        {!pickingOrder && orderQuery && (
          <div className="border border-border rounded-lg overflow-hidden">
            {matchOrders.length === 0 ? <div className="p-3 text-sm text-muted-foreground">No matching paid orders.</div> :
              matchOrders.map((o) => (
                <button key={o.id} onClick={() => setPickingOrder(o)} className="w-full text-left p-3 hover:bg-accent text-sm flex justify-between border-b border-border last:border-b-0">
                  <span>#{o.number} · {new Date(o.createdAt).toLocaleString()}</span>
                  <span className="font-medium">{fmtMoney(o.total, settings.currency)}</span>
                </button>
              ))}
          </div>
        )}

        {pickingOrder && (
          <div className="space-y-3">
            <div className="text-sm">Order <b>#{pickingOrder.number}</b> · {fmtMoney(pickingOrder.total, settings.currency)}</div>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr><th>Item</th><th>Sold qty</th><th>Return qty</th><th>Subtotal</th></tr></thead>
              <tbody>
                {pickingOrder.items.map((it) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="py-2">{it.name}</td>
                    <td>{it.qty}</td>
                    <td><input type="number" min={0} max={it.qty} value={retQty[it.id] ?? 0} onChange={(e) => setRetQty({ ...retQty, [it.id]: Math.max(0, Math.min(it.qty, +e.target.value || 0)) })} className="w-20 px-2 py-1 rounded border border-input bg-background" /></td>
                    <td>{fmtMoney(it.price * (retQty[it.id] ?? 0), settings.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="grid grid-cols-2 gap-3">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value as PaymentMethod)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="cash">Refund Cash</option>
                <option value="card">Refund Card</option>
                <option value="wallet">Refund Wallet</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setPickingOrder(null); setRetQty({}); }} className="px-3 py-2 rounded-lg bg-secondary text-sm">Cancel</button>
              <button onClick={submit} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Process Return</button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="font-semibold">Manual Return (without linked order)</h3>
        <div className="grid md:grid-cols-4 gap-2">
          <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Item name" className="px-3 py-2 rounded-lg border border-input bg-background text-sm" />
          <input type="number" min={1} value={manualQty} onChange={(e) => setManualQty(Math.max(1, +e.target.value || 1))} placeholder="Qty" className="px-3 py-2 rounded-lg border border-input bg-background text-sm" />
          <input type="number" min={0} value={manualAmount || ""} onChange={(e) => setManualAmount(Math.max(0, +e.target.value || 0))} placeholder="Total amount" className="px-3 py-2 rounded-lg border border-input bg-background text-sm" />
          <button onClick={addManualItem} className="px-3 py-2 rounded-lg bg-secondary text-sm">Add Item</button>
        </div>
        <div className="space-y-2">
          {manualItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">No manual items added.</div>
          ) : manualItems.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded-lg bg-secondary p-2 text-sm">
              <span>{it.qty}x {it.name}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{fmtMoney(it.price * it.qty, settings.currency)}</span>
                <button onClick={() => removeManualItem(it.id)} className="px-2 py-1 rounded bg-background">Remove</button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-border text-sm">
          <span>Total refund</span>
          <span className="font-semibold text-destructive">
            {fmtMoney(manualItems.reduce((s, it) => s + it.price * it.qty, 0), settings.currency)}
          </span>
        </div>
        <div className="flex justify-end">
          <button onClick={processManualReturn} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
            Process Manual Return
          </button>
        </div>
      </div>

      {/* Filters & list */}
      <div className="flex items-end gap-2 flex-wrap">
        <DateFld label="From" value={from} onChange={setFrom} />
        <DateFld label="To" value={to} onChange={setTo} />
        <button onClick={() => { setFrom(todayIso()); setTo(todayIso()); }} className="px-3 py-2 rounded-lg bg-secondary text-sm">Today</button>
        <button onClick={() => { setFrom(""); setTo(""); }} className="px-3 py-2 rounded-lg bg-secondary text-sm">All</button>
        <button onClick={() => exportCsv(`returns_${from || "all"}_${to || "all"}`, filtered.map((r) => ({ date: new Date(r.createdAt).toLocaleString(), return_no: r.number, order_no: r.orderNumber, items: r.items.map((i) => `${i.qty}x ${i.name}`).join(" | "), refund: r.refundAmount, method: r.refundMethod, reason: r.reason ?? "" })))} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Export CSV</button>
        <button onClick={() => window.print()} className="px-3 py-2 rounded-lg bg-secondary text-sm">Print</button>
        <div className="ml-auto text-sm text-muted-foreground">Total refund in range: <b className="text-destructive">{fmtMoney(totalRefund, settings.currency)}</b></div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr><th className="p-3">Return #</th><th>Date</th><th>Order #</th><th>Items</th><th>Refund</th><th>Method</th><th>Reason</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No returns yet.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 font-mono">#{r.number}</td>
                <td className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="font-mono">{r.orderNumber ? `#${r.orderNumber}` : "Manual"}</td>
                <td className="text-xs">{r.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</td>
                <td className="font-semibold text-destructive">-{fmtMoney(r.refundAmount, settings.currency)}</td>
                <td className="capitalize">{r.refundMethod}</td>
                <td className="text-xs text-muted-foreground">{r.reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
