import { createFileRoute, Link } from "@tanstack/react-router";
import { usePos, fmtMoney } from "@/lib/pos-store";
import {
  TrendingUp, Users, DollarSign, ChefHat, ArrowRight,
  Percent, Receipt, RotateCcw, Wallet, PiggyBank, Coins, BedDouble, CalendarCheck,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Dashboard() {
  const { orders, customers, items, salesReturns, expenses, settings, rooms, roomReservations } = usePos();
  const isToday = (t: number) => new Date(t).toDateString() === new Date().toDateString();
  // "today" = all non-cancelled orders for the day. Each order keeps its own
  // payment fields, so totals stay consistent with how POS records them.
  const today = orders.filter((o) => isToday(o.createdAt) && o.status !== "cancelled");

  const itemCostMap = new Map(items.map((i) => [i.id, i.cost ?? 0]));
  const orderCost = (o: typeof today[number]) =>
    o.items.reduce((s, it) => s + (itemCostMap.get(it.itemId) ?? 0) * it.qty, 0);

  const totalSales      = today.reduce((s, o) => s + (o.total || 0), 0);
  const totalCost       = today.reduce((s, o) => s + orderCost(o), 0);
  const totalDiscount   = today.reduce((s, o) => s + (o.discount || 0), 0);
  const totalTax        = today.reduce((s, o) => s + (o.tax || 0), 0);
  const totalReturns    = salesReturns.filter((r) => isToday(r.createdAt)).reduce((s, r) => s + r.refundAmount, 0);
  const totalExpenses   = expenses.filter((e) => isToday(e.createdAt)).reduce((s, e) => s + e.amount, 0);
  // Gross profit = (sales − tax − cost − returns). Tax is excluded because it's
  // pass-through to FBR and isn't restaurant revenue.
  const grossProfit     = totalSales - totalTax - totalCost - totalReturns;
  const profitAfterExp  = grossProfit - totalExpenses;
  const openOrders      = orders.filter((o) => ["open", "sent", "preparing", "ready"].includes(o.status)).length;

  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    const dayOrders = orders.filter((o) => new Date(o.createdAt).toDateString() === d.toDateString() && o.status !== "cancelled");
    return {
      day: d.toLocaleDateString(undefined, { weekday: "short" }),
      sales: dayOrders.reduce((s, o) => s + o.total, 0),
    };
  });

  const itemSales: Record<string, number> = {};
  today.forEach((o) => o.items.forEach((it) => { itemSales[it.itemId] = (itemSales[it.itemId] || 0) + it.qty; }));
  const topItems = Object.entries(itemSales)
    .map(([id, sold]) => ({ name: (items.find((i) => i.id === id)?.name ?? id).slice(0, 14), sold }))
    .sort((a, b) => b.sold - a.sold).slice(0, 6);

  const cur = settings.currency;
  const stats = [
    { label: "Total Sales",            value: fmtMoney(totalSales, cur),     icon: DollarSign, hint: `${today.length} orders`,                color: "text-success" },
    { label: "Total Cost",             value: fmtMoney(totalCost, cur),      icon: Coins,      hint: "Item cost (COGS)",                       color: "text-warning" },
    { label: "Total Discount",         value: fmtMoney(totalDiscount, cur),  icon: Percent,    hint: "Promos + manual",                        color: "text-primary" },
    { label: "Gross Profit",           value: fmtMoney(grossProfit, cur),    icon: TrendingUp, hint: "Sales − tax − cost − returns",           color: grossProfit >= 0 ? "text-success" : "text-destructive" },
    { label: "Total Tax",              value: fmtMoney(totalTax, cur),       icon: Receipt,    hint: `${settings.taxRate}% sales tax`,         color: "text-primary" },
    { label: "Total Returns",          value: fmtMoney(totalReturns, cur),   icon: RotateCcw,  hint: "Refunded today",                         color: "text-destructive" },
    { label: "Total Expenses",         value: fmtMoney(totalExpenses, cur),  icon: Wallet,     hint: "Operating expenses",                     color: "text-warning" },
    { label: "Profit after Expenses",  value: fmtMoney(profitAfterExp, cur), icon: PiggyBank,  hint: `Open orders: ${openOrders}`,             color: profitAfterExp >= 0 ? "text-success" : "text-destructive" },
  ];
  void Users; void ChefHat; void customers;

  const todayStr = new Date().toISOString().slice(0,10);
  const availableRooms = rooms.filter(r => r.status === "available").length;
  const occupiedRooms  = rooms.filter(r => r.status === "occupied").length;
  const todayCheckIns  = roomReservations.filter(r => r.checkIn  === todayStr && r.status !== "cancelled").length;
  const todayCheckOuts = roomReservations.filter(r => r.checkOut === todayStr && r.status !== "cancelled").length;
  const roomRevenue    = roomReservations.filter(r => ["confirmed","checked-in","checked-out"].includes(r.status)).reduce((s,r) => s + r.paidAmount, 0);
  const pendingBalance = roomReservations.filter(r => ["confirmed","checked-in"].includes(r.status)).reduce((s,r) => s + (r.totalAmount - r.paidAmount), 0);

  // Room revenue last 7 days
  const roomTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    const ds = d.toISOString().slice(0, 10);
    const rev = roomReservations
      .filter(r => r.checkIn === ds && r.status !== "cancelled")
      .reduce((s, r) => s + r.totalAmount, 0);
    return { day: d.toLocaleDateString(undefined, { weekday: "short" }), revenue: rev };
  });

  // Top booked rooms (by number of reservations)
  const roomBookings: Record<string, number> = {};
  roomReservations.filter(r => r.status !== "cancelled").forEach(r => {
    roomBookings[r.roomId] = (roomBookings[r.roomId] || 0) + 1;
  });
  const topRooms = Object.entries(roomBookings)
    .map(([id, count]) => ({ name: (rooms.find(r => r.id === id)?.name ?? id).slice(0, 12), count }))
    .sort((a, b) => b.count - a.count).slice(0, 6);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="rounded-2xl bg-gradient-hero p-6 lg:p-8 text-primary-foreground shadow-elegant">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm opacity-90">Welcome back 👋</p>
            <h2 className="text-2xl lg:text-3xl font-bold mt-1">{settings.restaurantName}</h2>
            <p className="text-sm opacity-80 mt-1">Here's how your restaurant is performing today.</p>
          </div>
          <Link to="/pos" className="inline-flex items-center gap-2 rounded-lg bg-white/15 backdrop-blur px-4 py-2.5 text-sm font-medium hover:bg-white/25 transition">
            Open POS <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* ── Existing POS stat boxes (unchanged) ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <Icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div className="mt-2 text-2xl font-bold">{s.value}</div>
              <div className={`mt-1 text-xs ${s.color} flex items-center gap-1`}>
                <TrendingUp className="h-3 w-3" /> {s.hint}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Room stat boxes (new row, below POS stats) ── */}
      {rooms.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <BedDouble className="h-4 w-4" /> Room Statistics
          </h3>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Rooms Available",    value: availableRooms,                              hint: `${rooms.length} total rooms`,            color: "text-success",     icon: BedDouble },
              { label: "Rooms Occupied",     value: occupiedRooms,                               hint: "Currently occupied",                    color: "text-destructive", icon: BedDouble },
              { label: "Check-ins Today",    value: todayCheckIns,                               hint: "Arriving today",                         color: "text-primary",    icon: CalendarCheck },
              { label: "Check-outs Today",   value: todayCheckOuts,                              hint: "Departing today",                        color: "text-warning",    icon: CalendarCheck },
              { label: "Revenue Collected",  value: fmtMoney(roomRevenue, cur),                  hint: "All time paid",                          color: "text-success",    icon: DollarSign },
              { label: "Pending Balance",    value: fmtMoney(pendingBalance, cur),               hint: "Active bookings unpaid",                 color: "text-warning",    icon: Wallet },
              { label: "Active Bookings",    value: roomReservations.filter(r => ["confirmed","checked-in"].includes(r.status)).length, hint: "Confirmed + checked-in", color: "text-primary", icon: CalendarCheck },
              { label: "Total Reservations", value: roomReservations.filter(r => r.status !== "cancelled").length, hint: "All time bookings", color: "text-foreground", icon: BedDouble },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between">
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                    <Icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                  <div className="mt-2 text-2xl font-bold">{s.value}</div>
                  <div className={`mt-1 text-xs ${s.color} flex items-center gap-1`}>
                    <TrendingUp className="h-3 w-3" /> {s.hint}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Existing charts (Sales 7 days + Top Items) — unchanged ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-2">
          <h3 className="font-semibold mb-4">Sales (Last 7 days)</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="sales" stroke="var(--primary)" strokeWidth={3} dot={{ fill: "var(--primary)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-semibold mb-4">Top Items</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={topItems}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="sold" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Room charts (new row, below existing charts) ── */}
      {rooms.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-2">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><BedDouble className="h-4 w-4 text-primary" />Room Revenue (Last 7 days)</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={roomTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="revenue" stroke="var(--success)" strokeWidth={3} dot={{ fill: "var(--success)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><BedDouble className="h-4 w-4 text-primary" />Top Booked Rooms</h3>
            <div className="h-64">
              {topRooms.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No bookings yet</div>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={topRooms}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="var(--success)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Orders (unchanged) ── */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-semibold mb-3">Recent Orders</h3>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet. <Link to="/pos" className="text-primary underline">Create your first order</Link>.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-2">#</th><th>Type</th><th>Items</th><th>Total</th><th>Status</th></tr>
              </thead>
              <tbody>
                {orders.slice(0, 8).map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="py-2 font-mono">#{o.number}</td>
                    <td className="capitalize">{o.type}</td>
                    <td>{o.items.length}</td>
                    <td>{fmtMoney(o.total, settings.currency)}</td>
                    <td><span className="inline-block px-2 py-0.5 rounded-md bg-accent text-accent-foreground text-xs capitalize">{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Bottom row: Today's Sales + Room Overview side by side ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Today's Sales summary */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4 text-success" />Today's Sales Summary</h3>
            <Link to="/pos" className="text-xs text-primary hover:underline flex items-center gap-1">Open POS <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Gross Sales",     value: fmtMoney(totalSales, cur),      color: "text-success" },
              { label: "Orders",          value: today.length,                    color: "text-primary" },
              { label: "Gross Profit",    value: fmtMoney(grossProfit, cur),     color: grossProfit >= 0 ? "text-success" : "text-destructive" },
              { label: "Total Tax",       value: fmtMoney(totalTax, cur),        color: "text-muted-foreground" },
              { label: "Total Discount",  value: fmtMoney(totalDiscount, cur),   color: "text-warning" },
              { label: "Total Returns",   value: fmtMoney(totalReturns, cur),    color: "text-destructive" },
              { label: "Expenses",        value: fmtMoney(totalExpenses, cur),   color: "text-warning" },
              { label: "Net Profit",      value: fmtMoney(profitAfterExp, cur),  color: profitAfterExp >= 0 ? "text-success" : "text-destructive" },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <span className={`text-sm font-semibold ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Room Overview */}
        {rooms.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><BedDouble className="h-4 w-4 text-primary" />Room Overview</h3>
              <Link to="/rooms" className="text-xs text-primary hover:underline flex items-center gap-1">Manage Rooms <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Available Rooms",  value: availableRooms,                    color: "text-success" },
                { label: "Occupied Rooms",   value: occupiedRooms,                     color: "text-destructive" },
                { label: "Check-ins Today",  value: todayCheckIns,                     color: "text-primary" },
                { label: "Check-outs Today", value: todayCheckOuts,                    color: "text-warning" },
                { label: "Total Rooms",      value: rooms.length,                      color: "text-foreground" },
                { label: "Active Bookings",  value: roomReservations.filter(r => ["confirmed","checked-in"].includes(r.status)).length, color: "text-primary" },
                { label: "Revenue Collected",value: fmtMoney(roomRevenue, cur),        color: "text-success" },
                { label: "Pending Balance",  value: fmtMoney(pendingBalance, cur),     color: "text-warning" },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <span className={`text-sm font-semibold ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-5 shadow-card flex items-center justify-center">
            <div className="text-center">
              <BedDouble className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No rooms configured yet.</p>
              <Link to="/rooms" className="mt-2 text-xs text-primary hover:underline">Set up rooms →</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
