import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { usePos, fmtMoney } from "@/lib/pos-store";
import { printReceipt } from "@/lib/receipt";
import { Search, Printer, Undo2, Eye } from "lucide-react";

export const Route = createFileRoute("/_app/orders")({ component: Orders });

function Orders() {
  const { orders, settings, customers, tables, staff, refundOrder } = usePos();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [view, setView] = useState<string | null>(null);

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (q && !`${o.number} ${o.fbrInvoiceNumber || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const reprint = async (id: string) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    await printReceipt({
      order: o, settings,
      customer: customers.find((c) => c.id === o.customerId),
      table: tables.find((t) => t.id === o.tableId),
      staffName: staff.find((s) => s.id === o.staffId)?.name,
    });
  };

  const detail = orders.find((o) => o.id === view);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice / FBR #" className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
          <option value="all">All statuses</option>
          {["paid", "sent", "preparing", "ready", "served", "refunded", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="ml-auto text-sm text-muted-foreground">{filtered.length} orders</div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr><th className="p-3">#</th><th>Date</th><th>Type</th><th>Items</th><th>Total</th><th>Pay</th><th>FBR</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No orders yet.</td></tr>
            ) : filtered.map((o) => (
              <tr key={o.id} className="border-t border-border hover:bg-accent/30">
                <td className="p-3 font-mono">#{o.number}</td>
                <td className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</td>
                <td className="capitalize">{o.type}</td>
                <td>{o.items.length}</td>
                <td className="font-medium">{fmtMoney(o.total, settings.currency)}</td>
                <td className="text-xs uppercase">{o.paymentMethod || "—"}</td>
                <td className="text-xs font-mono">{o.fbrInvoiceNumber ? <span className="text-success">{o.fbrInvoiceNumber.slice(-8)}</span> : "—"}</td>
                <td><span className={`text-xs px-2 py-0.5 rounded capitalize ${o.status === "refunded" ? "bg-destructive/15 text-destructive" : o.status === "paid" ? "bg-success/15 text-success" : "bg-accent text-accent-foreground"}`}>{o.status}</span></td>
                <td className="text-right pr-3 whitespace-nowrap">
                  <button onClick={() => setView(o.id)} className="p-1.5 hover:bg-accent rounded" title="View"><Eye className="h-3.5 w-3.5" /></button>
                  <button onClick={() => reprint(o.id)} className="p-1.5 hover:bg-accent rounded" title="Reprint"><Printer className="h-3.5 w-3.5" /></button>
                  {o.paymentMethod && !["refunded", "cancelled"].includes(o.status) && (
                    <button onClick={() => confirm(`Refund order #${o.number}?`) && refundOrder(o.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded" title="Refund"><Undo2 className="h-3.5 w-3.5" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setView(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-elegant" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Order #{detail.number}</h3>
            <p className="text-xs text-muted-foreground mb-4">{new Date(detail.createdAt).toLocaleString()} · {detail.type}</p>
            {detail.fbrInvoiceNumber && (
              <div className="rounded-lg bg-success/10 border border-success/30 p-2 mb-3 text-xs">
                <div className="font-semibold">FBR Invoice</div>
                <div className="font-mono">{detail.fbrInvoiceNumber}</div>
              </div>
            )}
            <table className="w-full text-sm mb-3">
              <tbody>
                {detail.items.map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="py-2">{i.name}{i.notes && <div className="text-xs italic text-muted-foreground">{i.notes}</div>}</td>
                    <td className="text-center">{i.qty}×</td>
                    <td className="text-right">{fmtMoney(i.price * i.qty, settings.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-sm space-y-1">
              <Row label="Subtotal" v={fmtMoney(detail.subtotal, settings.currency)} />
              {detail.discount > 0 && <Row label="Discount" v={`-${fmtMoney(detail.discount, settings.currency)}`} />}
              {detail.service ? <Row label="Service" v={fmtMoney(detail.service, settings.currency)} /> : null}
              <Row label="Tax" v={fmtMoney(detail.tax, settings.currency)} />
              <div className="flex justify-between font-bold border-t border-border pt-2"><span>Total</span><span>{fmtMoney(detail.total, settings.currency)}</span></div>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => reprint(detail.id)} className="px-4 py-2 rounded-lg bg-secondary text-sm flex items-center gap-1.5"><Printer className="h-4 w-4" /> Reprint</button>
              <button onClick={() => setView(null)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return <div className="flex justify-between text-muted-foreground"><span>{label}</span><span>{v}</span></div>;
}
