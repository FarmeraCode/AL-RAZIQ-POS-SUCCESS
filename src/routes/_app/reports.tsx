import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { usePos, fmtMoney, type Promotion, type InventoryItem, type Category } from "@/lib/pos-store";
import type { RoomReservation } from "@/lib/pos-store";
import { exportCsv, inDateRange, todayIso } from "@/lib/export";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line } from "recharts";

export const Route = createFileRoute("/_app/reports")({ component: Reports });

const COLORS = ["var(--primary)", "var(--primary-glow)", "var(--success)", "var(--warning)", "var(--destructive)", "var(--muted-foreground)"];

type Tab = "sales" | "returns" | "inventory" | "expenses" | "items" | "categories" | "payments" | "customers" | "staff" | "hourly" | "shifts" | "promotions" | "rooms";
const TABS: { key: Tab; label: string }[] = [
  { key: "sales", label: "Sales" },
  { key: "returns", label: "Sales Returns" },
  { key: "items", label: "Item-wise" },
  { key: "categories", label: "Category-wise" },
  { key: "promotions", label: "Promotions" },
  { key: "payments", label: "Payment Methods" },
  { key: "hourly", label: "Hourly" },
  { key: "customers", label: "Customers" },
  { key: "staff", label: "Staff" },
  { key: "shifts", label: "Shifts" },
  { key: "expenses", label: "Expenses" },
  { key: "inventory", label: "Inventory" },
  { key: "rooms", label: "Room Reservations" },
];

function Reports() {
  const pos = usePos();
  const { settings } = pos;
  const [tab, setTab] = useState<Tab>("sales");
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());

  const ordersInRange = useMemo(() => inDateRange(pos.orders, from, to).filter((o) => o.status !== "cancelled"), [pos.orders, from, to]);
  const returnsInRange = useMemo(() => inDateRange(pos.salesReturns, from, to), [pos.salesReturns, from, to]);
  const expensesInRange = useMemo(() => inDateRange(pos.expenses, from, to), [pos.expenses, from, to]);
  const shiftsInRange = useMemo(() => pos.shifts.filter((s) => {
    const f = from ? new Date(from + "T00:00:00").getTime() : -Infinity;
    const t = to ? new Date(to + "T23:59:59.999").getTime() : Infinity;
    return s.openedAt >= f && s.openedAt <= t;
  }), [pos.shifts, from, to]);
  const roomResInRange = useMemo(() => {
    const f = from || "";
    const t = to || "9999";
    return pos.roomReservations.filter(r => r.checkIn >= f && r.checkIn <= t);
  }, [pos.roomReservations, from, to]);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-end gap-2 flex-wrap">
        <DateFld label="From" value={from} onChange={setFrom} />
        <DateFld label="To" value={to} onChange={setTo} />
        <button onClick={() => { setFrom(todayIso()); setTo(todayIso()); }} className="px-3 py-2 rounded-lg bg-secondary text-sm">Today</button>
        <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 6); setFrom(iso(d)); setTo(todayIso()); }} className="px-3 py-2 rounded-lg bg-secondary text-sm">Last 7 days</button>
        <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 29); setFrom(iso(d)); setTo(todayIso()); }} className="px-3 py-2 rounded-lg bg-secondary text-sm">Last 30 days</button>
        <button onClick={() => { setFrom(""); setTo(""); }} className="px-3 py-2 rounded-lg bg-secondary text-sm">All Time</button>
        <button onClick={() => window.print()} className="ml-auto px-3 py-2 rounded-lg bg-secondary text-sm">Print</button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === t.key ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sales" && <SalesTab orders={ordersInRange} returns={returnsInRange} expenses={expensesInRange} settings={settings} />}
      {tab === "returns" && <ReturnsTab returns={returnsInRange} settings={settings} />}
      {tab === "items" && <ItemsTab orders={ordersInRange} items={pos.items} settings={settings} />}
      {tab === "categories" && <CategoriesTab orders={ordersInRange} items={pos.items} categories={pos.categories} settings={settings} />}
      {tab === "payments" && <PaymentsTab orders={ordersInRange} settings={settings} />}
      {tab === "hourly" && <HourlyTab orders={ordersInRange} settings={settings} />}
      {tab === "customers" && <CustomersTab orders={ordersInRange} customers={pos.customers} settings={settings} />}
      {tab === "staff" && <StaffTab orders={ordersInRange} staff={pos.staff} settings={settings} />}
      {tab === "shifts" && <ShiftsTab shifts={shiftsInRange} staff={pos.staff} orders={pos.orders} expenses={pos.expenses} settings={settings} />}
      {tab === "expenses" && <ExpensesTab expenses={expensesInRange} settings={settings} />}
      {tab === "inventory" && <InventoryTab inventoryItems={pos.inventoryItems} settings={settings} />}
      {tab === "promotions" && <PromotionsTab orders={ordersInRange} promotions={pos.promotions} settings={settings} />}
      {tab === "rooms" && <RoomsReportTab reservations={roomResInRange} rooms={pos.rooms} roomCategories={pos.roomCategories} settings={settings} />}
    </div>
  );
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ------------ TABS ------------ */
function SalesTab({ orders, returns: rets, expenses, settings }: any) {
  const gross = orders.reduce((s: number, o: any) => s + o.total, 0);
  const tax = orders.reduce((s: number, o: any) => s + (o.tax || 0), 0);
  const disc = orders.reduce((s: number, o: any) => s + (o.discount || 0), 0);
  const refund = rets.reduce((s: number, r: any) => s + r.refundAmount, 0);
  const exp = expenses.reduce((s: number, e: any) => s + e.amount, 0);
  const net = gross - refund - exp;
  const ticket = orders.length ? gross / orders.length : 0;

  // by day chart
  const byDay: Record<string, number> = {};
  orders.forEach((o: any) => {
    const k = new Date(o.createdAt).toLocaleDateString();
    byDay[k] = (byDay[k] || 0) + o.total;
  });
  const trend = Object.entries(byDay).map(([day, sales]) => ({ day, sales }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        <Stat label="Gross Sales" value={fmtMoney(gross, settings.currency)} />
        <Stat label="Discounts" value={fmtMoney(disc, settings.currency)} />
        <Stat label="Tax Collected" value={fmtMoney(tax, settings.currency)} />
        <Stat label="Refunds" value={fmtMoney(refund, settings.currency)} accent="text-destructive" />
        <Stat label="Expenses" value={fmtMoney(exp, settings.currency)} accent="text-destructive" />
        <Stat label="Net" value={fmtMoney(net, settings.currency)} accent="text-success" />
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <Stat label="Orders" value={orders.length} />
        <Stat label="Avg Ticket" value={fmtMoney(ticket, settings.currency)} />
        <Stat label="Items Sold" value={orders.reduce((s: number, o: any) => s + o.items.reduce((a: number, b: any) => a + b.qty, 0), 0)} />
      </div>

      <Card title="Sales Trend">
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="sales" stroke="var(--primary)" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <ExportRow filename="sales" rows={orders.map((o: any) => ({
        order_no: o.number, date: new Date(o.createdAt).toLocaleString(), type: o.type, status: o.status,
        items: o.items.length, subtotal: o.subtotal, discount: o.discount, tax: o.tax, total: o.total, payment: o.paymentMethod,
      }))} />

      <DataTable
        cols={["#", "Date", "Type", "Items", "Subtotal", "Disc", "Tax", "Total", "Payment", "Status"]}
        rows={orders.map((o: any) => [
          `#${o.number}`, new Date(o.createdAt).toLocaleString(), o.type, o.items.length,
          fmtMoney(o.subtotal, settings.currency), fmtMoney(o.discount, settings.currency),
          fmtMoney(o.tax, settings.currency), fmtMoney(o.total, settings.currency), o.paymentMethod ?? "—", o.status,
        ])}
      />
    </div>
  );
}

function ReturnsTab({ returns: rets, settings }: any) {
  const total = rets.reduce((s: number, r: any) => s + r.refundAmount, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <Stat label="Returns" value={rets.length} />
        <Stat label="Total Refund" value={fmtMoney(total, settings.currency)} accent="text-destructive" />
        <Stat label="Avg Refund" value={fmtMoney(rets.length ? total / rets.length : 0, settings.currency)} />
      </div>
      <ExportRow filename="returns" rows={rets.map((r: any) => ({ return_no: r.number, order_no: r.orderNumber, date: new Date(r.createdAt).toLocaleString(), items: r.items.map((i: any) => `${i.qty}x ${i.name}`).join("|"), refund: r.refundAmount, method: r.refundMethod, reason: r.reason ?? "" }))} />
      <DataTable cols={["Return #", "Date", "Order #", "Items", "Refund", "Method"]}
        rows={rets.map((r: any) => [`#${r.number}`, new Date(r.createdAt).toLocaleString(), `#${r.orderNumber}`, r.items.map((i: any) => `${i.qty}× ${i.name}`).join(", "), fmtMoney(r.refundAmount, settings.currency), r.refundMethod])} />
    </div>
  );
}

function ItemsTab({ orders, items, settings }: any) {
  const map: Record<string, { qty: number; revenue: number }> = {};
  orders.forEach((o: any) => o.items.forEach((it: any) => {
    if (!map[it.itemId]) map[it.itemId] = { qty: 0, revenue: 0 };
    map[it.itemId].qty += it.qty; map[it.itemId].revenue += it.qty * it.price;
  }));
  const rows = Object.entries(map).map(([id, v]) => ({ name: items.find((i: any) => i.id === id)?.name ?? id, ...v })).sort((a, b) => b.revenue - a.revenue);
  return (
    <div className="space-y-4">
      <Card title="Top Items by Revenue">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={rows.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip /><Bar dataKey="revenue" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <ExportRow filename="items" rows={rows.map((r) => ({ item: r.name, qty_sold: r.qty, revenue: r.revenue }))} />
      <DataTable cols={["Item", "Qty Sold", "Revenue"]} rows={rows.map((r) => [r.name, r.qty, fmtMoney(r.revenue, settings.currency)])} />
    </div>
  );
}

function CategoriesTab({ orders, items, categories, settings }: any) {
  const map: Record<string, number> = {};
  orders.forEach((o: any) => o.items.forEach((it: any) => {
    const cat = items.find((i: any) => i.id === it.itemId)?.categoryId;
    if (!cat) return;
    map[cat] = (map[cat] || 0) + it.qty * it.price;
  }));
  const rows = Object.entries(map).map(([id, v]) => ({ name: categories.find((c: any) => c.id === id)?.name ?? id, value: v }));
  return (
    <div className="space-y-4">
      <Card title="Sales by Category">
        <div className="h-72">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="name" outerRadius={100} label>
                {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <ExportRow filename="categories" rows={rows.map((r) => ({ category: r.name, revenue: r.value }))} />
      <DataTable cols={["Category", "Revenue"]} rows={rows.map((r) => [r.name, fmtMoney(r.value, settings.currency)])} />
    </div>
  );
}

function PaymentsTab({ orders, settings }: any) {
  const map: Record<string, number> = {};
  orders.forEach((o: any) => { const k = o.paymentMethod || "unspecified"; map[k] = (map[k] || 0) + o.total; });
  const rows = Object.entries(map).map(([name, value]) => ({ name, value }));
  return (
    <div className="space-y-4">
      <Card title="By Payment Method">
        <div className="h-72">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} label>
                {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <ExportRow filename="payments" rows={rows.map((r) => ({ method: r.name, total: r.value }))} />
      <DataTable cols={["Method", "Total"]} rows={rows.map((r) => [r.name, fmtMoney(r.value, settings.currency)])} />
    </div>
  );
}

function HourlyTab({ orders, settings }: any) {
  const map: Record<string, number> = {};
  for (let h = 0; h < 24; h++) map[`${String(h).padStart(2, "0")}:00`] = 0;
  orders.forEach((o: any) => { const k = `${String(new Date(o.createdAt).getHours()).padStart(2, "0")}:00`; map[k] += o.total; });
  const rows = Object.entries(map).map(([hour, sales]) => ({ hour, sales }));
  return (
    <div className="space-y-4">
      <Card title="Hourly Sales">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip /><Bar dataKey="sales" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <ExportRow filename="hourly" rows={rows.map((r) => ({ hour: r.hour, sales: r.sales }))} />
    </div>
  );
}

function CustomersTab({ orders, customers, settings }: any) {
  const map: Record<string, { spent: number; visits: number }> = {};
  orders.forEach((o: any) => {
    if (!o.customerId) return;
    if (!o.paymentMethod || ["cancelled", "refunded"].includes(o.status)) return;
    if (!map[o.customerId]) map[o.customerId] = { spent: 0, visits: 0 };
    map[o.customerId].spent += o.total; map[o.customerId].visits += 1;
  });
  const rows = customers.map((c: any) => ({
    name: c.name, phone: c.phone, tier: c.tier, points: c.points,
    spent: map[c.id]?.spent ?? 0, visits: map[c.id]?.visits ?? 0,
  })).sort((a: any, b: any) => b.spent - a.spent);
  return (
    <div className="space-y-4">
      <ExportRow filename="customers" rows={rows.map((r: any) => ({ name: r.name, phone: r.phone, tier: r.tier, points: r.points, visits_in_range: r.visits, spent_in_range: r.spent }))} />
      <DataTable cols={["Name", "Phone", "Tier", "Points", "Visits", "Spent"]}
        rows={rows.map((r: any) => [r.name, r.phone, r.tier, r.points, r.visits, fmtMoney(r.spent, settings.currency)])} />
    </div>
  );
}

function StaffTab({ orders, staff, settings }: any) {
  const map: Record<string, { sales: number; orders: number }> = {};
  orders.forEach((o: any) => {
    if (!o.staffId) return;
    if (!o.paymentMethod || ["cancelled", "refunded"].includes(o.status)) return;
    if (!map[o.staffId]) map[o.staffId] = { sales: 0, orders: 0 };
    map[o.staffId].sales += o.total; map[o.staffId].orders += 1;
  });
  const rows = staff.map((s: any) => ({ name: s.name, role: s.role, sales: map[s.id]?.sales ?? 0, orders: map[s.id]?.orders ?? 0 }));
  return (
    <div className="space-y-4">
      <ExportRow filename="staff" rows={rows.map((r: any) => ({ name: r.name, role: r.role, orders: r.orders, sales: r.sales }))} />
      <DataTable cols={["Name", "Role", "Orders", "Sales"]} rows={rows.map((r: any) => [r.name, r.role, r.orders, fmtMoney(r.sales, settings.currency)])} />
    </div>
  );
}

function ShiftsTab({ shifts, staff, orders, expenses, settings }: any) {
  const rows = shifts.map((s: any) => {
    const ords = orders.filter(
      (o: any) =>
        o.shiftId === s.id && o.paymentMethod && !["cancelled", "refunded"].includes(o.status),
    );
    const sales = ords.reduce((a: number, b: any) => a + b.total, 0);
    const exps = expenses.filter((e: any) => e.shiftId === s.id).reduce((a: number, b: any) => a + b.amount, 0);
    return {
      staff: staff.find((x: any) => x.id === s.staffId)?.name ?? s.staffId,
      opened: new Date(s.openedAt).toLocaleString(),
      closed: s.closedAt ? new Date(s.closedAt).toLocaleString() : "Open",
      open_cash: s.openingCash, close_cash: s.closingCash ?? "—", expected: s.expectedCash ?? "—", sales, expenses: exps,
    };
  });
  return (
    <div className="space-y-4">
      <ExportRow filename="shifts" rows={rows} />
      <DataTable cols={["Staff", "Opened", "Closed", "Opening", "Closing", "Expected", "Sales", "Expenses"]}
        rows={rows.map((r: any) => [r.staff, r.opened, r.closed, fmtMoney(+r.open_cash || 0, settings.currency), typeof r.close_cash === "number" ? fmtMoney(r.close_cash, settings.currency) : r.close_cash, typeof r.expected === "number" ? fmtMoney(r.expected, settings.currency) : r.expected, fmtMoney(r.sales, settings.currency), fmtMoney(r.expenses, settings.currency)])} />
    </div>
  );
}

function ExpensesTab({ expenses, settings }: any) {
  const map: Record<string, number> = {};
  expenses.forEach((e: any) => { map[e.category] = (map[e.category] || 0) + e.amount; });
  const rows = Object.entries(map).map(([name, value]) => ({ name, value }));
  const byDay: Record<string, number> = {};
  expenses.forEach((e: any) => {
    const d = new Date(e.createdAt).toLocaleDateString();
    byDay[d] = (byDay[d] || 0) + e.amount;
  });
  const trend = Object.entries(byDay).map(([day, amount]) => ({ day, amount }));
  return (
    <div className="space-y-4">
      <Card title="Expenses by Category">
        <div className="h-72">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="name" outerRadius={100} label>
                {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Expense Trend">
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="amount" stroke="var(--destructive)" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <ExportRow filename="expenses" rows={expenses.map((e: any) => ({ number: e.number, date: new Date(e.createdAt).toLocaleString(), category: e.category, amount: e.amount, note: e.note ?? "" }))} />
      <DataTable cols={["#", "Date", "Category", "Amount", "Note"]}
        rows={expenses.map((e: any) => [`#${e.number}`, new Date(e.createdAt).toLocaleString(), e.category, fmtMoney(e.amount, settings.currency), e.note ?? "—"])} />
    </div>
  );
}

function PromotionsTab({ orders, promotions, settings }: { orders: any[]; promotions: Promotion[]; settings: any }) {
  const totalDiscount = orders.reduce((s: number, o: any) => s + (o.discount || 0), 0);
  const ordersWithDisc = orders.filter((o: any) => (o.discount || 0) > 0);
  const gross = orders.reduce((s: number, o: any) => s + o.total, 0);
  const activePromos = promotions.filter((p) => p.active).length;
  const inactivePromos = promotions.length - activePromos;
  const discPct = gross > 0 ? (totalDiscount / gross) * 100 : 0;
  const now = Date.now();

  const byDay: Record<string, number> = {};
  ordersWithDisc.forEach((o: any) => {
    const k = new Date(o.createdAt).toLocaleDateString();
    byDay[k] = (byDay[k] || 0) + (o.discount || 0);
  });
  const discountTrend = Object.entries(byDay).map(([day, amount]) => ({ day, amount }));

  const promoCatalogRows = promotions.map((p) => ({
    name: p.name,
    code: p.code ?? "",
    type: p.type,
    value: p.value,
    active: p.active ? "yes" : "no",
    in_date_window:
      (!p.startsAt || now >= p.startsAt) && (!p.endsAt || now <= p.endsAt) ? "yes" : "no",
    min_order: p.minOrder ?? "",
    starts: p.startsAt ? new Date(p.startsAt).toLocaleString() : "",
    ends: p.endsAt ? new Date(p.endsAt).toLocaleString() : "",
  }));

  const discountOrderRows = ordersWithDisc.map((o: any) => ({
    order_no: o.number,
    date: new Date(o.createdAt).toLocaleString(),
    subtotal: o.subtotal,
    discount: o.discount ?? 0,
    total: o.total,
  }));

  const pieData = [
    { name: "Net ticket total", value: Math.max(0, gross - totalDiscount) },
    { name: "Discounts given", value: totalDiscount },
  ].filter((x) => x.value > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat label="Active promotions" value={activePromos} accent="text-success" />
        <Stat label="Inactive promotions" value={inactivePromos} />
        <Stat label="Total discounts (range)" value={fmtMoney(totalDiscount, settings.currency)} accent="text-warning" />
        <Stat label="Discount / gross sales" value={`${discPct.toFixed(1)}%`} />
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <Stat label="Orders with a discount" value={ordersWithDisc.length} />
        <Stat label="Avg discount / discounted order" value={fmtMoney(ordersWithDisc.length ? totalDiscount / ordersWithDisc.length : 0, settings.currency)} />
        <Stat label="Gross sales (range)" value={fmtMoney(gross, settings.currency)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Discounts vs sales (range)">
          <div className="h-64">
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No paid sales in this range.</p>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card title="Discount amount by day">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={discountTrend.length ? discountTrend : [{ day: "—", amount: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="amount" fill="var(--warning)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Promotion catalog">
        <div className="flex justify-end mb-3">
          <button onClick={() => exportCsv("promotions_catalog", promoCatalogRows)} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
            Download promotions CSV
          </button>
        </div>
        <DataTable
          cols={["Name", "Code", "Type", "Value", "Active", "In date window", "Min order"]}
          rows={promotions.map((p) => [
            p.name,
            p.code ?? "—",
            p.type,
            p.type === "percent" ? `${p.value}%` : p.type === "flat" ? fmtMoney(p.value, settings.currency) : `BOGO ${p.value}`,
            p.active ? "Yes" : "No",
            (!p.startsAt || now >= p.startsAt) && (!p.endsAt || now <= p.endsAt) ? "Yes" : "No",
            p.minOrder != null ? fmtMoney(p.minOrder, settings.currency) : "—",
          ])}
        />
      </Card>

      <Card title="Orders with discounts (detail)">
        <div className="flex justify-end mb-3">
          <button
            onClick={() => exportCsv("orders_with_discounts", discountOrderRows)}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
          >
            Download CSV
          </button>
        </div>
        <DataTable
          cols={["Order", "Date", "Subtotal", "Discount", "Total"]}
          rows={ordersWithDisc.map((o: any) => [
            `#${o.number}`,
            new Date(o.createdAt).toLocaleString(),
            fmtMoney(o.subtotal, settings.currency),
            fmtMoney(o.discount ?? 0, settings.currency),
            fmtMoney(o.total, settings.currency),
          ])}
        />
      </Card>
    </div>
  );
}

function InventoryTab({ inventoryItems, settings }: { inventoryItems: any[]; settings: any }) {
  const inv = inventoryItems.map((i) => ({
    name: i.name,
    sku: i.sku ?? "",
    inventoryCategory: i.category ?? "Uncategorized",
    stock: i.stock,
    reorder: i.reorder,
    unit: i.unit,
    cost: i.cost,
    value: i.cost * i.stock,
  }));
  const lowCount = inv.filter((i) => i.stock <= i.reorder).length;
  const totalValue = inv.reduce((s, i) => s + i.value, 0);
  const catMap: Record<string, number> = {};
  inv.forEach((i) => { catMap[i.inventoryCategory] = (catMap[i.inventoryCategory] || 0) + i.value; });
  const byCategory = Object.entries(catMap).map(([name, value]) => ({ name, value }));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat label="Inventory Items" value={inv.length} />
        <Stat label="Low Stock Items" value={lowCount} accent="text-warning" />
        <Stat label="Total Inventory Value" value={fmtMoney(totalValue, settings.currency)} />
        <Stat label="Out of Stock" value={inv.filter((i) => i.stock === 0).length} accent="text-destructive" />
      </div>
      <Card title="Inventory Value by Inventory Category">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={byCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <ExportRow filename="inventory" rows={inv} />
      <DataTable cols={["Item", "SKU", "Inv Category", "Stock", "Reorder", "Cost", "Value"]}
        rows={inv.map((i) => [i.name, i.sku, i.inventoryCategory, `${i.stock} ${i.unit}`, i.reorder, fmtMoney(i.cost, settings.currency), fmtMoney(i.value, settings.currency)])} />
    </div>
  );
}

/* ---------- shared UI bits ---------- */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card p-5 shadow-card"><h3 className="font-semibold mb-3">{title}</h3>{children}</div>;
}
function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${accent ?? ""}`}>{value}</div>
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
function ExportRow({ filename, rows }: { filename: string; rows: Record<string, any>[] }) {
  return (
    <div className="flex justify-end">
      <button onClick={() => exportCsv(filename, rows)} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Download CSV / Excel</button>
    </div>
  );
}
function DataTable({ cols, rows }: { cols: string[]; rows: (string | number)[][] }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-left"><tr>{cols.map((c) => <th key={c} className="p-3">{c}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={cols.length} className="p-8 text-center text-muted-foreground">No data in range.</td></tr>
            : rows.map((r, i) => <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className="p-2.5">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function RoomsReportTab({ reservations, rooms, roomCategories, settings }: { reservations: RoomReservation[]; rooms: any[]; roomCategories: any[]; settings: any }) {
  const active = reservations.filter(r => r.status !== "cancelled");
  const totalRevenue = active.reduce((s, r) => s + r.totalAmount, 0);
  const totalPaid = active.reduce((s, r) => s + r.paidAmount, 0);
  const totalNights = active.reduce((s, r) => s + r.nights, 0);
  const avgRevenue = active.length ? totalRevenue / active.length : 0;

  const byStatus: Record<string, number> = {};
  reservations.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
  const statusPie = Object.entries(byStatus).map(([name, value]) => ({ name, value }));

  const byRoom: Record<string, { nights: number; revenue: number }> = {};
  active.forEach(r => {
    if (!byRoom[r.roomId]) byRoom[r.roomId] = { nights: 0, revenue: 0 };
    byRoom[r.roomId].nights += r.nights;
    byRoom[r.roomId].revenue += r.totalAmount;
  });
  const roomRows = Object.entries(byRoom).map(([id, v]) => {
    const rm = rooms.find(r => r.id === id);
    const cat = roomCategories.find(c => c.id === rm?.categoryId);
    return { name: rm?.name ?? id, category: cat?.name ?? "", nights: v.nights, revenue: v.revenue };
  }).sort((a, b) => b.revenue - a.revenue);

  const exportRows = active.map(r => {
    const rm = rooms.find(x => x.id === r.roomId);
    return { number: r.number, guest: r.guestName, phone: r.guestPhone, room: rm?.name ?? "", checkIn: r.checkIn, checkOut: r.checkOut, nights: r.nights, total: r.totalAmount, paid: r.paidAmount, balance: r.totalAmount - r.paidAmount, payment: r.paymentMethod ?? "", status: r.status };
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card"><div className="text-xs text-muted-foreground">Reservations</div><div className="mt-1 text-xl font-bold">{active.length}</div></div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card"><div className="text-xs text-muted-foreground">Total Nights</div><div className="mt-1 text-xl font-bold">{totalNights}</div></div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card"><div className="text-xs text-muted-foreground">Total Revenue</div><div className="mt-1 text-xl font-bold text-success">{fmtMoney(totalRevenue, settings.currency)}</div></div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card"><div className="text-xs text-muted-foreground">Amount Collected</div><div className="mt-1 text-xl font-bold text-primary">{fmtMoney(totalPaid, settings.currency)}</div></div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card"><div className="text-xs text-muted-foreground">Avg / Booking</div><div className="mt-1 text-xl font-bold">{fmtMoney(avgRevenue, settings.currency)}</div></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-semibold mb-3">By Status</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart><Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={90} label>{statusPie.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-semibold mb-3">Revenue by Room</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={roomRows.slice(0,8)}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} /><YAxis stroke="var(--muted-foreground)" fontSize={11} /><Tooltip /><Bar dataKey="revenue" fill="var(--primary)" radius={[6,6,0,0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => exportCsv("room_reservations", exportRows)} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Download CSV / Excel</button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr>{["#","Guest","Phone","Room","Check-In","Check-Out","Nights","Total","Paid","Balance","Payment","Status"].map(c => <th key={c} className="p-3 whitespace-nowrap">{c}</th>)}</tr></thead>
          <tbody>
            {active.length === 0 && <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">No reservations in range.</td></tr>}
            {active.map(r => {
              const rm = rooms.find(x => x.id === r.roomId);
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2.5 font-mono">#{r.number}</td>
                  <td className="p-2.5 font-medium">{r.guestName}</td>
                  <td className="p-2.5">{r.guestPhone}</td>
                  <td className="p-2.5">{rm?.name ?? "—"}</td>
                  <td className="p-2.5">{r.checkIn}</td>
                  <td className="p-2.5">{r.checkOut}</td>
                  <td className="p-2.5 text-center">{r.nights}</td>
                  <td className="p-2.5">{fmtMoney(r.totalAmount, settings.currency)}</td>
                  <td className="p-2.5">{fmtMoney(r.paidAmount, settings.currency)}</td>
                  <td className="p-2.5">{fmtMoney(r.totalAmount - r.paidAmount, settings.currency)}</td>
                  <td className="p-2.5 capitalize">{r.paymentMethod ?? "—"}</td>
                  <td className="p-2.5"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary capitalize">{r.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
