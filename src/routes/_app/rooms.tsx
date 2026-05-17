import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { usePos, fmtMoney } from "@/lib/pos-store";
import type { RoomCategory, Room, RoomReservation, BedSize } from "@/lib/pos-store";
import {
  BedDouble, Plus, Edit2, Trash2, Check, X, Search, CalendarCheck,
  Phone, Mail, User, Tag, DollarSign, Clock, CheckCircle, XCircle, LogIn, LogOut,
} from "lucide-react";

export const Route = createFileRoute("/_app/rooms")({ component: RoomsPage });

type RTab = "categories" | "rooms" | "reservations" | "availability";

const STATUS_COLORS: Record<string, string> = {
  available: "text-success bg-success/10",
  occupied: "text-destructive bg-destructive/10",
  maintenance: "text-warning bg-warning/10",
  cleaning: "text-primary bg-primary/10",
  pending: "text-warning bg-warning/10",
  confirmed: "text-primary bg-primary/10",
  "checked-in": "text-success bg-success/10",
  "checked-out": "text-muted-foreground bg-secondary",
  cancelled: "text-destructive bg-destructive/10",
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[status] ?? "bg-secondary text-muted-foreground"}`}>
      {status}
    </span>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <input {...props} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
    </label>
  );
}

function Sel({ label, children, ...props }: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <select {...props} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
        {children}
      </select>
    </label>
  );
}

// ─── Categories Tab ──────────────────────────────────────────────────────────
function CategoriesTab() {
  const { roomCategories, upsertRoomCategory, deleteRoomCategory } = usePos();
  const [editing, setEditing] = useState<Partial<RoomCategory> | null>(null);

  function save() {
    if (!editing?.name?.trim()) return;
    upsertRoomCategory({ id: editing.id ?? crypto.randomUUID(), name: editing.name.trim(), icon: editing.icon ?? "🛏️", description: editing.description });
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <Card title="Room Categories" action={<button onClick={() => setEditing({ icon: "🛏️" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm"><Plus className="h-4 w-4" />Add Category</button>}>
        {editing && (
          <div className="mb-4 p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Category Name" value={editing.name ?? ""} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Deluxe" />
              <Input label="Icon (emoji)" value={editing.icon ?? ""} onChange={e => setEditing(p => ({ ...p, icon: e.target.value }))} placeholder="🛏️" />
            </div>
            <Input label="Description (optional)" value={editing.description ?? ""} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} />
            <div className="flex gap-2">
              <button onClick={save} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-1"><Check className="h-3.5 w-3.5" />Save</button>
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-secondary text-sm flex items-center gap-1"><X className="h-3.5 w-3.5" />Cancel</button>
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roomCategories.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/30">
              <span className="text-2xl">{c.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{c.name}</div>
                {c.description && <div className="text-xs text-muted-foreground truncate">{c.description}</div>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(c)} className="p-1.5 rounded-lg hover:bg-accent"><Edit2 className="h-3.5 w-3.5" /></button>
                <button onClick={() => deleteRoomCategory(c.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
          {roomCategories.length === 0 && <p className="col-span-3 text-sm text-muted-foreground py-4">No categories yet.</p>}
        </div>
      </Card>
    </div>
  );
}

// ─── Rooms Tab ───────────────────────────────────────────────────────────────
const BED_SIZES: BedSize[] = ["single", "double", "queen", "king", "twin"];

function RoomsTab() {
  const { rooms, roomCategories, upsertRoom, deleteRoom, settings } = usePos();
  const [editing, setEditing] = useState<Partial<Room> | null>(null);
  const [q, setQ] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const filtered = rooms.filter(r =>
    (filterCat === "all" || r.categoryId === filterCat) &&
    r.name.toLowerCase().includes(q.toLowerCase())
  );

  const blank: Partial<Room> = { bedSize: "double", capacity: 2, beds: 1, pricePerNight: 3000, status: "available", amenities: [] };

  function save() {
    if (!editing?.name?.trim() || !editing.categoryId) return;
    upsertRoom({ ...blank, ...editing, id: editing.id ?? crypto.randomUUID() } as Room);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search rooms…" className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
          <option value="all">All Categories</option>
          {roomCategories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <button onClick={() => setEditing({ ...blank })} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
          <Plus className="h-4 w-4" />Add Room
        </button>
      </div>

      {editing && (
        <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
          <h4 className="font-semibold">{editing.id ? "Edit Room" : "New Room"}</h4>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Input label="Room Name" value={editing.name ?? ""} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Room 101" />
            <Sel label="Category" value={editing.categoryId ?? ""} onChange={e => setEditing(p => ({ ...p, categoryId: e.target.value }))}>
              <option value="">Select…</option>
              {roomCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Sel>
            <Input label="Floor" value={editing.floor ?? ""} onChange={e => setEditing(p => ({ ...p, floor: e.target.value }))} placeholder="1st" />
            <Sel label="Status" value={editing.status ?? "available"} onChange={e => setEditing(p => ({ ...p, status: e.target.value as Room["status"] }))}>
              {["available","occupied","maintenance","cleaning"].map(s => <option key={s} value={s}>{s}</option>)}
            </Sel>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Input label="Max Persons" type="number" value={editing.capacity ?? 2} onChange={e => setEditing(p => ({ ...p, capacity: +e.target.value }))} />
            <Input label="Number of Beds" type="number" value={editing.beds ?? 1} onChange={e => setEditing(p => ({ ...p, beds: +e.target.value }))} />
            <Sel label="Bed Size" value={editing.bedSize ?? "double"} onChange={e => setEditing(p => ({ ...p, bedSize: e.target.value as BedSize }))}>
              {BED_SIZES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </Sel>
            <Input label={`Price / Night (${settings.currency})`} type="number" value={editing.pricePerNight ?? 0} onChange={e => setEditing(p => ({ ...p, pricePerNight: +e.target.value }))} />
          </div>
          <Input label="Amenities (comma-separated)" value={(editing.amenities ?? []).join(", ")} onChange={e => setEditing(p => ({ ...p, amenities: e.target.value.split(",").map(a => a.trim()).filter(Boolean) }))} placeholder="AC, TV, WiFi, Mini Bar" />
          <Input label="Description" value={editing.description ?? ""} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} />
          <div className="flex gap-2">
            <button onClick={save} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-1"><Check className="h-3.5 w-3.5" />Save</button>
            <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-secondary text-sm flex items-center gap-1"><X className="h-3.5 w-3.5" />Cancel</button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map(r => {
          const cat = roomCategories.find(c => c.id === r.categoryId);
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{cat?.icon} {cat?.name} {r.floor ? `· ${r.floor} floor` : ""}</div>
                </div>
                <Badge status={r.status} />
              </div>
              <div className="p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><BedDouble className="h-4 w-4" />{r.beds} × {r.bedSize} bed · {r.capacity} persons</div>
                <div className="flex items-center gap-2 text-muted-foreground"><DollarSign className="h-4 w-4" />{fmtMoney(r.pricePerNight, settings.currency)} / night</div>
                {r.amenities?.length ? <div className="flex flex-wrap gap-1">{r.amenities.map(a => <span key={a} className="px-1.5 py-0.5 bg-secondary rounded text-xs">{a}</span>)}</div> : null}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setEditing(r)} className="flex-1 py-1.5 rounded-lg bg-secondary text-xs flex items-center justify-center gap-1 hover:bg-accent"><Edit2 className="h-3 w-3" />Edit</button>
                  <button onClick={() => deleteRoom(r.id)} className="flex-1 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center justify-center gap-1 hover:bg-destructive/20"><Trash2 className="h-3 w-3" />Delete</button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="col-span-4 py-12 text-center text-sm text-muted-foreground">No rooms found.</div>}
      </div>
    </div>
  );
}

// ─── Reservation Form ────────────────────────────────────────────────────────
function isoToday() { return new Date().toISOString().slice(0,10); }
function calcNights(ci: string, co: string) {
  const diff = new Date(co).getTime() - new Date(ci).getTime();
  return Math.max(1, Math.round(diff / 86400000));
}

function ReservationForm({ initial, onSave, onCancel }: { initial: Partial<RoomReservation>; onSave: (r: RoomReservation) => void; onCancel: () => void }) {
  const { rooms, roomCategories, settings, currentStaffId } = usePos();
  const [f, setF] = useState<Partial<RoomReservation>>({ status: "pending", checkIn: isoToday(), checkOut: isoToday(), discount: 0, paidAmount: 0, paymentMethod: "cash", ...initial });

  const room = rooms.find(r => r.id === f.roomId);
  const nights = f.checkIn && f.checkOut ? calcNights(f.checkIn, f.checkOut) : 1;
  const pricePerNight = f.pricePerNight ?? room?.pricePerNight ?? 0;
  const total = nights * pricePerNight - (f.discount ?? 0);

  function handleSave() {
    if (!f.roomId || !f.guestName?.trim() || !f.guestPhone?.trim() || !f.checkIn || !f.checkOut) return alert("Please fill in all required fields.");
    const now = Date.now();
    onSave({
      id: f.id ?? crypto.randomUUID(), number: f.number ?? 0,
      roomId: f.roomId!, guestName: f.guestName.trim(), guestPhone: f.guestPhone.trim(),
      guestEmail: f.guestEmail, guestAddress: f.guestAddress, guestIdType: f.guestIdType, guestIdNumber: f.guestIdNumber,
      checkIn: f.checkIn!, checkOut: f.checkOut!, nights, pricePerNight, discount: f.discount ?? 0,
      totalAmount: total, paidAmount: f.paidAmount ?? 0, paymentMethod: f.paymentMethod,
      status: f.status ?? "pending", notes: f.notes, staffId: currentStaffId,
      createdAt: f.createdAt ?? now, updatedAt: now,
    });
  }

  return (
    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-4">
      <h4 className="font-semibold">{f.id ? "Edit Reservation" : "New Reservation"}</h4>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Sel label="Room *" value={f.roomId ?? ""} onChange={e => { const rm = rooms.find(r => r.id === e.target.value); setF(p => ({ ...p, roomId: e.target.value, pricePerNight: rm?.pricePerNight ?? p.pricePerNight })); }}>
          <option value="">Select room…</option>
          {rooms.filter(r => r.status === "available" || r.id === f.roomId).map(r => { const cat = roomCategories.find(c => c.id === r.categoryId); return <option key={r.id} value={r.id}>{r.name} — {cat?.name} ({fmtMoney(r.pricePerNight, settings.currency)}/night)</option>; })}
        </Sel>
        <Input label="Check-In *" type="date" value={f.checkIn ?? ""} onChange={e => setF(p => ({ ...p, checkIn: e.target.value }))} />
        <Input label="Check-Out *" type="date" value={f.checkOut ?? ""} onChange={e => setF(p => ({ ...p, checkOut: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Input label="Guest Name *" value={f.guestName ?? ""} onChange={e => setF(p => ({ ...p, guestName: e.target.value }))} placeholder="Full name" />
        <Input label="Phone *" value={f.guestPhone ?? ""} onChange={e => setF(p => ({ ...p, guestPhone: e.target.value }))} placeholder="03XX-XXXXXXX" />
        <Input label="Email" value={f.guestEmail ?? ""} onChange={e => setF(p => ({ ...p, guestEmail: e.target.value }))} placeholder="guest@email.com" />
        <Input label="Address" value={f.guestAddress ?? ""} onChange={e => setF(p => ({ ...p, guestAddress: e.target.value }))} placeholder="City, Country" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Input label="ID Type" value={f.guestIdType ?? ""} onChange={e => setF(p => ({ ...p, guestIdType: e.target.value }))} placeholder="CNIC / Passport" />
        <Input label="ID Number" value={f.guestIdNumber ?? ""} onChange={e => setF(p => ({ ...p, guestIdNumber: e.target.value }))} placeholder="42101-XXXXXXX-X" />
        <Input label={`Price/Night (${settings.currency})`} type="number" value={pricePerNight} onChange={e => setF(p => ({ ...p, pricePerNight: +e.target.value }))} />
        <Input label="Discount" type="number" value={f.discount ?? 0} onChange={e => setF(p => ({ ...p, discount: +e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Sel label="Payment Method" value={f.paymentMethod ?? "cash"} onChange={e => setF(p => ({ ...p, paymentMethod: e.target.value }))}>
          {["cash","card","jazzcash","easypaisa","bank transfer"].map(m => <option key={m} value={m}>{m}</option>)}
        </Sel>
        <Input label="Amount Paid" type="number" value={f.paidAmount ?? 0} onChange={e => setF(p => ({ ...p, paidAmount: +e.target.value }))} />
        <Sel label="Status" value={f.status ?? "pending"} onChange={e => setF(p => ({ ...p, status: e.target.value as RoomReservation["status"] }))}>
          {["pending","confirmed","checked-in","checked-out","cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
        </Sel>
        <div className="rounded-lg border border-border bg-card p-3 flex flex-col justify-center">
          <div className="text-xs text-muted-foreground">{nights} night{nights !== 1 ? "s" : ""} · Total</div>
          <div className="font-bold text-lg">{fmtMoney(total, settings.currency)}</div>
        </div>
      </div>
      <Input label="Notes" value={f.notes ?? ""} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} placeholder="Special requests, remarks…" />
      <div className="flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-1"><Check className="h-3.5 w-3.5" />Save Reservation</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-secondary text-sm flex items-center gap-1"><X className="h-3.5 w-3.5" />Cancel</button>
      </div>
    </div>
  );
}

// ─── Print Receipt ───────────────────────────────────────────────────────────
function printRoomReceipt(res: RoomReservation, roomName: string, catName: string, settings: any) {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Room Receipt #${res.number}</title>
<style>
@page{size:80mm auto;margin:2mm}
*{box-sizing:border-box}
body{font-family:'Courier New',monospace;width:80mm;margin:0;padding:4mm 2mm;color:#000;font-size:11px;line-height:1.35}
.center{text-align:center}.right{text-align:right}.bold{font-weight:700}
.lg{font-size:14px}.xl{font-size:16px}.muted{color:#555}
hr{border:none;border-top:1px dashed #000;margin:4px 0}
table{width:100%;border-collapse:collapse}td{padding:1px 0;vertical-align:top}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.noprint{display:none}}
</style></head><body>
<div class="center bold xl">${settings.restaurantName}</div>
${settings.address ? `<div class="center muted">${settings.address}</div>` : ""}
${settings.phone ? `<div class="center muted">Tel: ${settings.phone}</div>` : ""}
<hr/>
<div class="center bold lg">ROOM RESERVATION RECEIPT</div>
<hr/>
<table>
  <tr><td>Receipt #</td><td class="right bold">${res.number}</td></tr>
  <tr><td>Date</td><td class="right">${new Date(res.createdAt).toLocaleString()}</td></tr>
  <tr><td>Room</td><td class="right bold">${roomName} (${catName})</td></tr>
  <tr><td>Check-In</td><td class="right">${res.checkIn}</td></tr>
  <tr><td>Check-Out</td><td class="right">${res.checkOut}</td></tr>
  <tr><td>Nights</td><td class="right">${res.nights}</td></tr>
</table>
<hr/>
<div class="bold">Guest Information</div>
<table>
  <tr><td>Name</td><td class="right">${res.guestName}</td></tr>
  <tr><td>Phone</td><td class="right">${res.guestPhone}</td></tr>
  ${res.guestEmail ? `<tr><td>Email</td><td class="right">${res.guestEmail}</td></tr>` : ""}
  ${res.guestAddress ? `<tr><td>Address</td><td class="right">${res.guestAddress}</td></tr>` : ""}
  ${res.guestIdType ? `<tr><td>${res.guestIdType}</td><td class="right">${res.guestIdNumber ?? ""}</td></tr>` : ""}
</table>
<hr/>
<table>
  <tr><td>Price/Night</td><td class="right">${settings.currency} ${res.pricePerNight.toLocaleString()}</td></tr>
  <tr><td>Nights</td><td class="right">× ${res.nights}</td></tr>
  ${res.discount > 0 ? `<tr><td>Discount</td><td class="right">- ${settings.currency} ${res.discount.toLocaleString()}</td></tr>` : ""}
  <tr class="bold lg"><td>TOTAL</td><td class="right">${settings.currency} ${res.totalAmount.toLocaleString()}</td></tr>
  <tr><td>Paid</td><td class="right">${settings.currency} ${res.paidAmount.toLocaleString()}</td></tr>
  <tr><td>Balance</td><td class="right bold">${settings.currency} ${(res.totalAmount - res.paidAmount).toLocaleString()}</td></tr>
  <tr><td>Payment</td><td class="right">${(res.paymentMethod ?? "").toUpperCase()}</td></tr>
  <tr><td>Status</td><td class="right">${res.status.toUpperCase()}</td></tr>
</table>
${res.notes ? `<hr/><div><b>Notes:</b> ${res.notes}</div>` : ""}
<hr/>
<div class="center muted">${settings.receiptFooter}</div>
<div class="center muted" style="margin-top:6px">Al Raziq POS</div>
<div class="noprint center" style="margin-top:10px"><button onclick="window.print()">Print</button></div>
<script>setTimeout(()=>window.print(),300);</script>
</body></html>`;
  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) return alert("Popup blocked. Allow popups to print.");
  w.document.open(); w.document.write(html); w.document.close();
}

// ─── Checkout Payment Modal ──────────────────────────────────────────────────
function CheckoutPaymentModal({
  res, settings, onPay, onCancel,
}: {
  res: RoomReservation;
  settings: any;
  onPay: (extraPaid: number, method: string) => void;
  onCancel: () => void;
}) {
  const balance = res.totalAmount - res.paidAmount;
  const [paying, setPaying] = useState(balance);
  const [method, setMethod] = useState(res.paymentMethod ?? "cash");
  const [err, setErr] = useState("");

  function confirm() {
    if (paying < balance) {
      setErr(`Guest still owes ${fmtMoney(balance - paying, settings.currency)}. Full payment required before checkout.`);
      return;
    }
    onPay(paying, method);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-elegant p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <LogOut className="h-5 w-5 text-primary" /> Checkout — Payment Required
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">#{res.number} · {res.guestName}</p>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        {/* Balance summary */}
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Charges</span>
            <span className="font-semibold">{fmtMoney(res.totalAmount, settings.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Already Paid</span>
            <span className="font-semibold text-success">{fmtMoney(res.paidAmount, settings.currency)}</span>
          </div>
          <div className="border-t border-destructive/20 pt-2 flex justify-between">
            <span className="font-bold text-destructive">Balance Due</span>
            <span className="font-bold text-destructive text-lg">{fmtMoney(balance, settings.currency)}</span>
          </div>
        </div>

        {/* Collect payment */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs text-muted-foreground mb-1">Amount Collecting ({settings.currency})</div>
              <input
                type="number" min={0} value={paying}
                onChange={e => { setPaying(+e.target.value); setErr(""); }}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <label className="block">
              <div className="text-xs text-muted-foreground mb-1">Payment Method</div>
              <select value={method} onChange={e => setMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                {["cash","card","jazzcash","easypaisa","bank transfer"].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          </div>
          {paying > balance && (
            <div className="text-xs text-success font-medium">
              Change to return: {fmtMoney(paying - balance, settings.currency)}
            </div>
          )}
          {err && <div className="text-xs text-destructive font-medium bg-destructive/10 px-3 py-2 rounded-lg">{err}</div>}
        </div>

        <div className="flex gap-3">
          <button
            onClick={confirm}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Check className="h-4 w-4" /> Collect &amp; Checkout
          </button>
          <button onClick={onCancel} className="px-4 py-2.5 rounded-xl bg-secondary text-sm font-medium">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reservations Tab ────────────────────────────────────────────────────────
function ReservationsTab() {
  const pos = usePos();
  const { roomReservations, rooms, roomCategories, upsertRoomReservation, deleteRoomReservation, checkInReservation, checkOutReservation, settings } = pos;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RoomReservation | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<RoomReservation | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = roomReservations.filter(r =>
    (statusFilter === "all" || r.status === statusFilter) &&
    (r.guestName.toLowerCase().includes(q.toLowerCase()) || r.guestPhone.includes(q) || String(r.number).includes(q))
  );

  function getRoom(id: string) { return rooms.find(r => r.id === id); }
  function getCat(catId: string) { return roomCategories.find(c => c.id === catId); }

  // Checkout gate: if balance > 0, show payment modal first
  function handleCheckout(res: RoomReservation) {
    const balance = res.totalAmount - res.paidAmount;
    if (balance > 0) {
      setCheckoutTarget(res);
    } else {
      checkOutReservation(res.id);
    }
  }

  // Called from modal when payment collected
  function finaliseCheckout(extraPaid: number, method: string) {
    if (!checkoutTarget) return;
    const updated: RoomReservation = {
      ...checkoutTarget,
      paidAmount: checkoutTarget.paidAmount + extraPaid,
      paymentMethod: method,
      status: "checked-out",
      updatedAt: Date.now(),
    };
    upsertRoomReservation(updated);
    setCheckoutTarget(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, phone, #…" className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
          <option value="all">All Statuses</option>
          {["pending","confirmed","checked-in","checked-out","cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => { setEditing(null); setCreating(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
          <Plus className="h-4 w-4" />New Reservation
        </button>
      </div>

      {creating && !editing && (
        <ReservationForm initial={{}} onSave={r => { upsertRoomReservation(r); setCreating(false); }} onCancel={() => setCreating(false)} />
      )}
      {editing && (
        <ReservationForm initial={editing} onSave={r => { upsertRoomReservation(r); setEditing(null); }} onCancel={() => setEditing(null)} />
      )}

      {/* Checkout payment modal */}
      {checkoutTarget && (
        <CheckoutPaymentModal
          res={checkoutTarget}
          settings={settings}
          onPay={finaliseCheckout}
          onCancel={() => setCheckoutTarget(null)}
        />
      )}

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr>
              {["#","Room","Guest","Phone","Check-In","Check-Out","Nights","Total","Paid","Balance","Status","Actions"].map(c => (
                <th key={c} className="p-3 whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">No reservations found.</td></tr>
            )}
            {filtered.map(res => {
              const room = getRoom(res.roomId);
              const cat = room ? getCat(room.categoryId) : null;
              return (
                <tr key={res.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                  <td className="p-2.5 font-mono">#{res.number}</td>
                  <td className="p-2.5">
                    <div className="font-medium">{room?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{cat?.name}</div>
                  </td>
                  <td className="p-2.5">
                    <div className="font-medium">{res.guestName}</div>
                    {res.guestEmail && <div className="text-xs text-muted-foreground">{res.guestEmail}</div>}
                  </td>
                  <td className="p-2.5">{res.guestPhone}</td>
                  <td className="p-2.5">{res.checkIn}</td>
                  <td className="p-2.5">{res.checkOut}</td>
                  <td className="p-2.5 text-center">{res.nights}</td>
                  <td className="p-2.5">{fmtMoney(res.totalAmount, settings.currency)}</td>
                  <td className="p-2.5">{fmtMoney(res.paidAmount, settings.currency)}</td>
                  <td className="p-2.5">
                    {res.totalAmount - res.paidAmount > 0 && res.status !== "cancelled" && res.status !== "checked-out" ? (
                      <span className="text-xs font-semibold text-destructive">
                        -{fmtMoney(res.totalAmount - res.paidAmount, settings.currency)}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-2.5"><Badge status={res.status} /></td>
                  <td className="p-2.5">
                    <div className="flex gap-1">
                      {res.status === "confirmed" && (
                        <button onClick={() => checkInReservation(res.id)} title="Check In" className="p-1.5 rounded-lg hover:bg-success/10 text-success"><LogIn className="h-3.5 w-3.5" /></button>
                      )}
                      {res.status === "checked-in" && (
                        <button
                          onClick={() => handleCheckout(res)}
                          title={res.totalAmount - res.paidAmount > 0 ? `Balance due: ${fmtMoney(res.totalAmount - res.paidAmount, settings.currency)}` : "Check Out"}
                          className={`p-1.5 rounded-lg ${res.totalAmount - res.paidAmount > 0 ? "hover:bg-destructive/10 text-destructive" : "hover:bg-primary/10 text-primary"}`}
                        >
                          <LogOut className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => { setCreating(false); setEditing(res); }} title="Edit" className="p-1.5 rounded-lg hover:bg-accent"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => printRoomReceipt(res, room?.name ?? "Room", cat?.name ?? "", settings)} title="Print Receipt" className="p-1.5 rounded-lg hover:bg-primary/10 text-primary"><Tag className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if (confirm("Delete this reservation?")) deleteRoomReservation(res.id); }} title="Delete" className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Availability Tab ────────────────────────────────────────────────────────
function AvailabilityTab() {
  const { rooms, roomCategories, roomReservations, settings } = usePos();
  const [date, setDate] = useState(isoToday());

  const occupiedRoomIds = useMemo(() => {
    return new Set(
      roomReservations
        .filter(r => !["cancelled","checked-out"].includes(r.status) && r.checkIn <= date && r.checkOut > date)
        .map(r => r.roomId)
    );
  }, [roomReservations, date]);

  const byCategory = useMemo(() => {
    const map: Record<string, { cat: RoomCategory; rooms: (Room & { free: boolean; reservation?: RoomReservation })[] }> = {};
    rooms.forEach(room => {
      const cat = roomCategories.find(c => c.id === room.categoryId);
      if (!cat) return;
      if (!map[cat.id]) map[cat.id] = { cat, rooms: [] };
      const free = !occupiedRoomIds.has(room.id) && room.status === "available";
      const reservation = roomReservations.find(r => r.roomId === room.id && !["cancelled","checked-out"].includes(r.status) && r.checkIn <= date && r.checkOut > date);
      map[cat.id].rooms.push({ ...room, free, reservation });
    });
    return Object.values(map);
  }, [rooms, roomCategories, occupiedRoomIds, roomReservations, date]);

  const totalFree = rooms.filter(r => !occupiedRoomIds.has(r.id) && r.status === "available").length;
  const totalOccupied = occupiedRoomIds.size;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="block">
          <div className="text-xs text-muted-foreground mb-1">Check availability for date</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm" />
        </label>
        <div className="flex gap-3 mt-4">
          <div className="px-4 py-2 rounded-xl border border-border bg-card text-center shadow-card">
            <div className="text-xs text-muted-foreground">Available</div>
            <div className="text-2xl font-bold text-success">{totalFree}</div>
          </div>
          <div className="px-4 py-2 rounded-xl border border-border bg-card text-center shadow-card">
            <div className="text-xs text-muted-foreground">Occupied</div>
            <div className="text-2xl font-bold text-destructive">{totalOccupied}</div>
          </div>
          <div className="px-4 py-2 rounded-xl border border-border bg-card text-center shadow-card">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-2xl font-bold">{rooms.length}</div>
          </div>
        </div>
      </div>

      {byCategory.map(({ cat, rooms: catRooms }) => (
        <div key={cat.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-semibold mb-3">{cat.icon} {cat.name}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {catRooms.map(r => (
              <div key={r.id} className={`p-3 rounded-xl border-2 ${r.free ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{r.name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.free ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                    {r.free ? "Free" : "Occupied"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>{r.beds}× {r.bedSize} · {r.capacity} persons</div>
                  <div>{fmtMoney(r.pricePerNight, settings.currency)}/night</div>
                  {r.reservation && (
                    <div className="mt-1 p-2 rounded-lg bg-background border border-border">
                      <div className="font-medium text-foreground flex items-center gap-1"><User className="h-3 w-3" />{r.reservation.guestName}</div>
                      <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.reservation.guestPhone}</div>
                      <div className="flex items-center gap-1"><CalendarCheck className="h-3 w-3" />{r.reservation.checkIn} → {r.reservation.checkOut}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
const TABS: { key: RTab; label: string; icon: React.ElementType }[] = [
  { key: "categories", label: "Room Categories", icon: Tag },
  { key: "rooms", label: "Rooms", icon: BedDouble },
  { key: "reservations", label: "Reservations", icon: CalendarCheck },
  { key: "availability", label: "Availability", icon: CheckCircle },
];

function RoomsPage() {
  const { rooms, roomReservations } = usePos();
  const [tab, setTab] = useState<RTab>("reservations");
  const todayStr = isoToday();

  const todayCheckIns = roomReservations.filter(r => r.checkIn === todayStr && r.status !== "cancelled").length;
  const todayCheckOuts = roomReservations.filter(r => r.checkOut === todayStr && r.status !== "cancelled").length;
  const occupiedCount = rooms.filter(r => r.status === "occupied").length;
  const availableCount = rooms.filter(r => r.status === "available").length;

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header banner */}
      <div className="rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 p-6 text-primary-foreground shadow-elegant">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1"><BedDouble className="h-5 w-5 opacity-80" /><span className="text-sm opacity-80">Room Reservation Management</span></div>
            <h2 className="text-2xl font-bold">Hotel & Rooms</h2>
          </div>
          <div className="flex gap-4">
            <div className="text-center"><div className="text-2xl font-bold">{availableCount}</div><div className="text-xs opacity-80">Available</div></div>
            <div className="text-center"><div className="text-2xl font-bold">{occupiedCount}</div><div className="text-xs opacity-80">Occupied</div></div>
            <div className="text-center"><div className="text-2xl font-bold">{todayCheckIns}</div><div className="text-xs opacity-80">Check-ins Today</div></div>
            <div className="text-center"><div className="text-2xl font-bold">{todayCheckOuts}</div><div className="text-xs opacity-80">Check-outs Today</div></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" />{t.label}
            </button>
          );
        })}
      </div>

      {tab === "categories" && <CategoriesTab />}
      {tab === "rooms" && <RoomsTab />}
      {tab === "reservations" && <ReservationsTab />}
      {tab === "availability" && <AvailabilityTab />}
    </div>
  );
}
