import QRCode from "qrcode";
import type { Order, Settings, Customer, Table } from "./pos-store";
import { fmtMoney } from "./pos-store";

export async function buildReceiptHtml(opts: {
  order: Order;
  settings: Settings;
  customer?: Customer;
  table?: Table;
  staffName?: string;
}) {
  const { order, settings, customer, table, staffName } = opts;
  const qrPayload = order.fbrQrPayload || JSON.stringify({
    fbr: order.fbrInvoiceNumber, total: order.total, date: new Date(order.createdAt).toISOString(),
  });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 160, margin: 1 });
  const width = settings.printer?.width || 80;
  const w = width === 58 ? "58mm" : "80mm";

  const fmt = (n: number) => fmtMoney(n, settings.currency);
  const dt = new Date(order.createdAt);

  return `<!doctype html><html><head><meta charset="utf-8"/><title>Receipt #${order.number}</title>
<style>
@page { size: ${w} auto; margin: 2mm; }
* { box-sizing: border-box; }
body { font-family: 'Courier New', monospace; width: ${w}; margin: 0; padding: 4mm 2mm; color: #000; font-size: 11px; line-height: 1.35; }
.center { text-align: center; }
.right { text-align: right; }
.bold { font-weight: 700; }
.lg { font-size: 14px; }
.xl { font-size: 16px; }
.muted { color: #555; }
hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
table { width: 100%; border-collapse: collapse; }
td { padding: 1px 0; vertical-align: top; }
.urdu { font-family: 'Noto Nastaliq Urdu', serif; font-size: 13px; direction: rtl; }
.qr { display: block; margin: 6px auto; }
.fbr-box { border: 1px solid #000; padding: 4px; margin-top: 4px; text-align: center; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .noprint { display: none; } }
</style></head><body>
<div class="center bold xl">${escapeHtml(settings.restaurantName)}</div>
${settings.receiptHeaderUrdu ? `<div class="center urdu">${escapeHtml(settings.receiptHeaderUrdu)}</div>` : ""}
${settings.address ? `<div class="center muted">${escapeHtml(settings.address)}</div>` : ""}
${settings.phone ? `<div class="center muted">Tel: ${escapeHtml(settings.phone)}</div>` : ""}
${settings.ntn ? `<div class="center muted">NTN: ${escapeHtml(settings.ntn)} ${settings.strn ? "· STRN: " + escapeHtml(settings.strn) : ""}</div>` : ""}
<hr/>
<table>
  <tr><td>Invoice #</td><td class="right bold">${order.number}</td></tr>
  <tr><td>Date</td><td class="right">${dt.toLocaleString()}</td></tr>
  <tr><td>Type</td><td class="right">${order.type}${table ? " · " + table.name : ""}</td></tr>
  ${staffName ? `<tr><td>Cashier</td><td class="right">${escapeHtml(staffName)}</td></tr>` : ""}
  ${customer ? `<tr><td>Customer</td><td class="right">${escapeHtml(customer.name)} (${escapeHtml(customer.phone)})</td></tr>` : ""}
</table>
<hr/>
<table>
  <tr class="bold"><td>Item</td><td class="right">Qty</td><td class="right">Amount</td></tr>
  ${order.items.map((i) => `<tr><td>${escapeHtml(i.name)}</td><td class="right">${i.qty}</td><td class="right">${fmt(i.price * i.qty)}</td></tr>`).join("")}
</table>
<hr/>
<table>
  <tr><td>Subtotal</td><td class="right">${fmt(order.subtotal)}</td></tr>
  ${order.discount > 0 ? `<tr><td>Discount</td><td class="right">-${fmt(order.discount)}</td></tr>` : ""}
  ${order.service ? `<tr><td>Service ${settings.serviceCharge}%</td><td class="right">${fmt(order.service)}</td></tr>` : ""}
  <tr><td>Sales Tax ${settings.taxRate}%</td><td class="right">${fmt(order.tax)}</td></tr>
  <tr class="bold lg"><td>TOTAL</td><td class="right">${fmt(order.total)}</td></tr>
  ${order.paymentMethod ? `<tr><td>Paid by</td><td class="right">${order.paymentMethod.toUpperCase()}</td></tr>` : ""}
  ${order.change ? `<tr><td>Change</td><td class="right">${fmt(order.change)}</td></tr>` : ""}
  ${order.pointsEarned ? `<tr><td>Loyalty earned</td><td class="right bold">+${order.pointsEarned} pts</td></tr>` : ""}
</table>
${order.fbrInvoiceNumber ? `
<div class="fbr-box">
  <div class="bold">FBR Verified Invoice</div>
  <div>${escapeHtml(order.fbrInvoiceNumber)}</div>
  <img class="qr" src="${qrDataUrl}" width="120" height="120" alt="FBR QR"/>
  <div class="muted">Verify at fbr.gov.pk</div>
</div>` : ""}
<hr/>
<div class="center muted">${escapeHtml(settings.receiptFooter)}</div>
<div class="center muted" style="margin-top:6px">Al Raziq POS</div>
<div class="noprint center" style="margin-top:10px"><button onclick="window.print()">Print</button></div>
<script>setTimeout(()=>window.print(),300);</script>
</body></html>`;
}

export async function printReceipt(opts: Parameters<typeof buildReceiptHtml>[0]) {
  const html = await buildReceiptHtml(opts);
  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) return alert("Popup blocked. Allow popups to print receipts.");
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export async function printKOT(order: Order, table?: Table) {
  const dt = new Date(order.createdAt);
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>KOT #${order.number}</title>
<style>@page{size:80mm auto;margin:2mm}body{font-family:'Courier New',monospace;font-size:14px;width:80mm;padding:4mm 2mm}
.center{text-align:center}.bold{font-weight:700}.xl{font-size:20px}hr{border:none;border-top:1px dashed #000;margin:4px 0}
table{width:100%}td{padding:2px 0;vertical-align:top}.qty{font-size:18px;font-weight:700;width:30px}
@media print{.noprint{display:none}}</style></head><body>
<div class="center bold xl">KITCHEN ORDER</div>
<div class="center">#${order.number} · ${order.type.toUpperCase()}${table ? " · " + table.name : ""}</div>
<div class="center">${dt.toLocaleTimeString()}</div>
<hr/>
<table>${order.items.map((i) => `<tr><td class="qty">${i.qty}×</td><td class="bold">${escapeHtml(i.name)}${i.notes ? `<br/><i style="font-size:11px">${escapeHtml(i.notes)}</i>` : ""}</td></tr>`).join("")}</table>
<hr/>${order.notes ? `<div><b>Note:</b> ${escapeHtml(order.notes)}</div>` : ""}
<div class="noprint center"><button onclick="window.print()">Print</button></div>
<script>setTimeout(()=>window.print(),200);</script></body></html>`;
  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) return alert("Popup blocked.");
  w.document.write(html); w.document.close();
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
