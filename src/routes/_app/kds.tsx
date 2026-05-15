import { createFileRoute } from "@tanstack/react-router";
import { usePos } from "@/lib/pos-store";
import { printKOT } from "@/lib/receipt";
import { Clock, CheckCircle2, Bell, Printer } from "lucide-react";

export const Route = createFileRoute("/_app/kds")({
  component: KDS,
});

function KDS() {
  const { orders, tables, updateOrder, setTableStatus } = usePos();
  const active = orders.filter((o) => ["sent", "preparing", "ready"].includes(o.status));

  const colorFor = (s: string) =>
    s === "sent" ? "border-warning" : s === "preparing" ? "border-primary" : "border-success";

  const elapsed = (t: number) => {
    const m = Math.floor((Date.now() - t) / 60000);
    return m < 1 ? "just now" : `${m}m ago`;
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Kitchen Display</h2>
          <p className="text-sm text-muted-foreground">{active.length} active tickets</p>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No active tickets. Orders sent from POS will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {active.map((o) => {
            const table = tables.find((t) => t.id === o.tableId);
            return (
              <div key={o.id} className={`rounded-xl bg-card border-2 ${colorFor(o.status)} shadow-card overflow-hidden`}>
                <div className="px-4 py-3 bg-secondary flex items-center justify-between">
                  <div>
                    <div className="font-bold">#{o.number}</div>
                    <div className="text-xs text-muted-foreground capitalize">{o.type} {table && `· ${table.name}`}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-medium uppercase ${o.status === "ready" ? "text-success" : o.status === "preparing" ? "text-primary" : "text-warning"}`}>
                      {o.status}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-0.5">
                      <Clock className="h-3 w-3" />{elapsed(o.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  {o.items.map((it) => (
                    <div key={it.id} className="flex items-start gap-2 text-sm">
                      <span className="font-bold text-primary w-6">{it.qty}×</span>
                      <div className="flex-1">
                        <div className="font-medium">{it.name}</div>
                        {it.notes && <div className="text-xs text-muted-foreground italic">{it.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-border flex gap-2">
                  <button onClick={() => printKOT(o, table)} className="px-2 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm" title="Reprint KOT"><Printer className="h-4 w-4" /></button>
                  {o.status === "sent" && (
                    <button onClick={() => updateOrder(o.id, { status: "preparing" })} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
                      Start Preparing
                    </button>
                  )}
                  {o.status === "preparing" && (
                    <button onClick={() => updateOrder(o.id, { status: "ready" })} className="flex-1 py-2 rounded-lg bg-success text-success-foreground text-sm font-medium">
                      Mark Ready
                    </button>
                  )}
                  {o.status === "ready" && (
                    <button
                      onClick={() => {
                        updateOrder(o.id, { status: "served" });
                        if (o.tableId) setTableStatus(o.tableId, "available");
                      }}
                      className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Served
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
