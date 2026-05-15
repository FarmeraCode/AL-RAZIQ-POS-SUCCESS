import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { usePos, fmtMoney, type OrderItem, type Order, type PaymentMethod } from "@/lib/pos-store";
import { printReceipt, printKOT } from "@/lib/receipt";
import { pushInvoiceToFbr } from "@/lib/fbr";
import { Plus, Minus, Trash2, Search, CreditCard, Banknote, Wallet, Receipt, Percent, Printer } from "lucide-react";

export const Route = createFileRoute("/_app/pos")({
  component: POS,
});

function POS() {
  const {
    categories, items, settings, addOrder, orderCounter, customers, promotions, tables,
    setTableStatus, currentStaffId, currentShiftId, staff, stock,
  } = usePos();
  const blockOutOfStock = settings.blockPOSWhenOutOfStock === true;
  const [activeCat, setActiveCat] = useState(categories[0]?.id);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<"dine-in" | "takeaway" | "delivery">("dine-in");
  const [tableId, setTableId] = useState<string>();
  const [customerId, setCustomerId] = useState<string>();
  const [promoCode, setPromoCode] = useState("");
  const [manualDiscount, setManualDiscount] = useState<number>(0);
  const [manualDiscountType, setManualDiscountType] = useState<"flat" | "percent">("flat");
  const [showPay, setShowPay] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [paid, setPaid] = useState({ cash: 0, card: 0, wallet: 0 });
  const [orderNote, setOrderNote] = useState("");

  useEffect(() => {
    if (categories.length === 0) return;
    if (!activeCat || !categories.some((c) => c.id === activeCat)) {
      setActiveCat(categories[0].id);
    }
  }, [categories, activeCat]);

  const filtered = useMemo(() => {
    let list = items.filter((i) => i.available);
    if (search) list = list.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()) || i.sku?.toLowerCase().includes(search.toLowerCase()));
    else if (activeCat) list = list.filter((i) => i.categoryId === activeCat);
    return list;
  }, [items, activeCat, search]);

  const stockMap = useMemo(() => Object.fromEntries(stock.map((s) => [s.itemId, s.stock])), [stock]);

  const addToCart = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setCart((c) => {
      const ex = c.find((x) => x.itemId === id && !x.notes);
      if (ex) return c.map((x) => (x === ex ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { id: crypto.randomUUID(), itemId: id, name: item.name, price: item.price, qty: 1 }];
    });
  };
  const updateQty = (id: string, delta: number) =>
    setCart((c) => c.flatMap((x) => (x.id === id ? (x.qty + delta <= 0 ? [] : [{ ...x, qty: x.qty + delta }]) : [x])));
  const removeItem = (id: string) => setCart((c) => c.filter((x) => x.id !== id));
  const addNote = (id: string) => {
    const note = prompt("Item note (e.g., No onion, extra spicy)") || "";
    setCart((c) => c.map((x) => (x.id === id ? { ...x, notes: note } : x)));
  };

  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0);
  const promo = promotions.find((p) => p.active && p.code?.toLowerCase() === promoCode.toLowerCase());
  const minOk = !promo?.minOrder || subtotal >= promo.minOrder;
  const promoDiscount = !promo || !minOk ? 0 : promo.type === "percent" ? (subtotal * promo.value) / 100 : promo.type === "flat" ? promo.value : 0;
  const manualDiscountAmount =
    manualDiscount > 0
      ? manualDiscountType === "percent"
        ? (subtotal * Math.min(manualDiscount, 100)) / 100
        : Math.min(manualDiscount, subtotal)
      : 0;
  const discount = Math.min(subtotal, promoDiscount + manualDiscountAmount);
  const taxable = Math.max(0, subtotal - discount);
  const tax = (taxable * settings.taxRate) / 100;
  const service = orderType === "dine-in" ? (taxable * settings.serviceCharge) / 100 : 0;
  const total = taxable + tax + service;
  const totalPaid = paid.cash + paid.card + paid.wallet;
  const change = Math.max(0, totalPaid - total);

  const buildOrder = (status: Order["status"], paymentMethod?: PaymentMethod): Order => ({
    id: crypto.randomUUID(),
    number: orderCounter,
    type: orderType,
    tableId: orderType === "dine-in" ? tableId : undefined,
    customerId,
    items: cart,
    status,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    subtotal,
    discount,
    tax,
    service,
    total,
    paymentMethod,
    paidCash: paid.cash || undefined,
    paidCard: paid.card || undefined,
    paidWallet: paid.wallet || undefined,
    change: change || undefined,
    notes: orderNote || undefined,
    staffId: currentStaffId,
    shiftId: currentShiftId,
  });

  const completeOrder = async (paymentMethod: PaymentMethod) => {
    if (cart.length === 0) return;
    // Payment is captured upfront, but the order is sent to the kitchen
    // (status: "sent") so it appears on the KDS until the kitchen marks it served.
    const order = buildOrder("sent", paymentMethod);
    if (settings.fbr.enabled) {
      try {
        const fbr = await pushInvoiceToFbr(order, settings);
        order.fbrInvoiceNumber = fbr.invoiceNumber;
        order.fbrQrPayload = fbr.qrPayload;
      } catch (e) {
        console.error("[POS] FBR push failed; sale still recorded.", e);
      }
    }
    addOrder(order);
    if (orderType === "dine-in" && tableId) setTableStatus(tableId, "occupied", order.id);
    const cust = customers.find((c) => c.id === order.customerId);
    const tbl = tables.find((t) => t.id === order.tableId);
    const staffName = staff.find((s) => s.id === currentStaffId)?.name;
    // Print BOTH the kitchen ticket and the customer receipt.
    // Sequential opens with a small gap so most browsers/popup blockers
    // treat them as user-initiated and don't block the second window.
    await printKOT(order, tbl);
    await new Promise((r) => setTimeout(r, 350));
    await printReceipt({ order, settings, customer: cust, table: tbl, staffName });
    reset();
  };

  const reset = () => {
    setCart([]); setPromoCode(""); setManualDiscount(0); setManualDiscountType("flat");
    setTableId(undefined); setCustomerId(undefined);
    setShowPay(false); setSplitMode(false); setPaid({ cash: 0, card: 0, wallet: 0 }); setOrderNote("");
  };

  return (
    <div className="grid lg:grid-cols-[1fr_400px] h-[calc(100vh-3.5rem)]">
      {/* Items */}
      <div className="flex flex-col overflow-hidden border-r border-border">
        <div className="p-4 border-b border-border bg-card flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items or scan barcode…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 p-3 overflow-x-auto border-b border-border bg-card">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => { setActiveCat(c.id); setSearch(""); }}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeCat === c.id && !search ? "bg-primary text-primary-foreground shadow-elegant" : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              <span className="mr-1.5">{c.icon}</span>{c.name}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {filtered.map((it) => {
              const stk = stockMap[it.id] ?? 999;
              const out = blockOutOfStock && stk <= 0;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => !out && addToCart(it.id)}
                  disabled={out}
                  className={`group relative rounded-xl border p-3 text-left shadow-card transition active:scale-[0.98] ${
                    out ? "border-border bg-muted opacity-60 cursor-not-allowed" : "border-border bg-card hover:shadow-elegant hover:border-primary"
                  }`}
                >
                  <div className="aspect-square rounded-lg bg-gradient-to-br from-accent to-secondary mb-2 flex items-center justify-center text-4xl">
                    {categories.find((c) => c.id === it.categoryId)?.icon || "🍴"}
                  </div>
                  <div className="font-medium text-sm leading-tight">{it.name}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-primary font-semibold text-sm">{fmtMoney(it.price, settings.currency)}</div>
                    <div className={`text-[10px] ${stk <= 0 ? "text-destructive" : stk <= 5 ? "text-destructive" : "text-muted-foreground"}`}>
                      {out ? "OUT" : `${stk} left`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-12">No items found</p>}
        </div>
      </div>

      {/* Cart */}
      <div className="flex flex-col bg-card max-h-[calc(100vh-3.5rem)]">
        <div className="p-4 border-b border-border space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {(["dine-in", "takeaway", "delivery"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={`py-2 rounded-lg text-xs font-medium capitalize ${orderType === t ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
              >
                {t}
              </button>
            ))}
          </div>
          {orderType === "dine-in" && (
            <select value={tableId || ""} onChange={(e) => setTableId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="">Select table…</option>
              {tables.filter((t) => t.status === "available" || t.id === tableId).map((t) => (
                <option key={t.id} value={t.id}>{t.name} · {t.zone} · {t.seats} seats</option>
              ))}
            </select>
          )}
          <select value={customerId || ""} onChange={(e) => setCustomerId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
            <option value="">Walk-in customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} · {c.tier} · {c.points}pt</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Cart is empty. Tap items to add.</div>
          ) : cart.map((c) => (
            <div key={c.id} className="rounded-lg bg-secondary p-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{fmtMoney(c.price, settings.currency)} × {c.qty} = <strong>{fmtMoney(c.price * c.qty, settings.currency)}</strong></div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(c.id, -1)} className="h-7 w-7 rounded-md bg-background flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                  <span className="w-6 text-center text-sm font-medium">{c.qty}</span>
                  <button onClick={() => updateQty(c.id, +1)} className="h-7 w-7 rounded-md bg-background flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                </div>
                <button onClick={() => addNote(c.id)} className="h-7 w-7 rounded-md text-primary hover:bg-primary/10 flex items-center justify-center text-xs">📝</button>
                <button onClick={() => removeItem(c.id)} className="h-7 w-7 rounded-md text-destructive hover:bg-destructive/10 flex items-center justify-center"><Trash2 className="h-3 w-3" /></button>
              </div>
              {c.notes && <div className="mt-1 text-[11px] italic text-muted-foreground pl-1">📌 {c.notes}</div>}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-border space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Promo code" className="w-full pl-8 pr-3 py-2 rounded-lg border border-input bg-background text-sm" />
            </div>
            <input value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder="Order note" className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm" />
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground w-16">Discount</span>
            <input
              type="number"
              min={0}
              value={manualDiscount || ""}
              onChange={(e) => setManualDiscount(Math.max(0, +e.target.value || 0))}
              placeholder="0"
              className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm"
            />
            <div className="flex rounded-lg border border-input overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setManualDiscountType("flat")}
                className={`px-3 py-2 ${manualDiscountType === "flat" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
              >
                {settings.currency}
              </button>
              <button
                type="button"
                onClick={() => setManualDiscountType("percent")}
                className={`px-3 py-2 ${manualDiscountType === "percent" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
              >
                %
              </button>
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmtMoney(subtotal, settings.currency)}</span></div>
            {discount > 0 && <div className="flex justify-between text-success"><span>Discount</span><span>-{fmtMoney(discount, settings.currency)}</span></div>}
            <div className="flex justify-between text-muted-foreground"><span>Sales Tax ({settings.taxRate}%)</span><span>{fmtMoney(tax, settings.currency)}</span></div>
            {service > 0 && <div className="flex justify-between text-muted-foreground"><span>Service ({settings.serviceCharge}%)</span><span>{fmtMoney(service, settings.currency)}</span></div>}
            <div className="flex justify-between text-base font-bold pt-2 border-t border-border"><span>Total</span><span>{fmtMoney(total, settings.currency)}</span></div>
          </div>
          <button
            disabled={cart.length === 0}
            onClick={() => setShowPay(true)}
            className="w-full py-3 rounded-lg bg-gradient-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 shadow-elegant hover:shadow-glow transition flex items-center justify-center gap-2"
          >
            <Printer className="h-4 w-4" /> Pay, Print &amp; Send to Kitchen
          </button>
        </div>
      </div>

      {showPay && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPay(false)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-elegant" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold">Choose Payment</h3>
                <p className="text-sm text-muted-foreground">Total: <strong className="text-foreground">{fmtMoney(total, settings.currency)}</strong></p>
              </div>
              <button onClick={() => setSplitMode((v) => !v)} className={`text-xs px-2 py-1 rounded ${splitMode ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                {splitMode ? "Single" : "Split"}
              </button>
            </div>

            {!splitMode ? (
              <div className="grid gap-3">
                {settings.paymentMethods.cash && (
                  <button onClick={() => completeOrder("cash")} className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition">
                    <Banknote className="h-5 w-5 text-success" /><span className="font-medium">Cash</span>
                  </button>
                )}
                {settings.paymentMethods.card && (
                  <button onClick={() => completeOrder("card")} className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition">
                    <CreditCard className="h-5 w-5 text-primary" /><span className="font-medium">Card (Debit / Credit)</span>
                  </button>
                )}
                {(settings.paymentMethods.jazzcash || settings.paymentMethods.easypaisa || settings.paymentMethods.sadapay || settings.paymentMethods.nayapay) && (
                  <button onClick={() => completeOrder("wallet")} className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition">
                    <Wallet className="h-5 w-5 text-warning" /><span className="font-medium">Mobile Wallet
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({[settings.paymentMethods.jazzcash && "JazzCash", settings.paymentMethods.easypaisa && "Easypaisa", settings.paymentMethods.sadapay && "SadaPay", settings.paymentMethods.nayapay && "NayaPay"].filter(Boolean).join(" / ")})
                      </span>
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <Split label="Cash" value={paid.cash} onChange={(v) => setPaid({ ...paid, cash: v })} />
                <Split label="Card" value={paid.card} onChange={(v) => setPaid({ ...paid, card: v })} />
                <Split label="Wallet" value={paid.wallet} onChange={(v) => setPaid({ ...paid, wallet: v })} />
                <div className="flex justify-between text-sm pt-2 border-t border-border">
                  <span>Paid</span><span className="font-bold">{fmtMoney(totalPaid, settings.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Change</span><span className="font-bold text-success">{fmtMoney(change, settings.currency)}</span>
                </div>
                <button disabled={totalPaid < total} onClick={() => completeOrder("split")} className="w-full py-3 rounded-lg bg-gradient-primary text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  <Printer className="h-4 w-4" /> Confirm Split & Print
                </button>
              </div>
            )}
            {settings.fbr.enabled && (
              <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5">
                <Receipt className="h-3 w-3" /> FBR invoice will be generated and printed with QR code
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Split({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-16 text-sm">{label}</span>
      <input type="number" min={0} value={value || ""} onChange={(e) => onChange(+e.target.value || 0)} className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm" />
    </label>
  );
}
