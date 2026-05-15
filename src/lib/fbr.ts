import type { Order, Settings } from "./pos-store";
import { generateFbrInvoice } from "./pos-store";

/**
 * FBR POS Integration (Pakistan).
 *
 * In sandbox mode this generates a deterministic invoice number and QR payload
 * locally so the full receipt flow works end-to-end without network access.
 *
 * In live mode it POSTs to the configured FBR endpoint with the connected
 * POS-ID + Bearer token. Replace the request body with the schema published
 * for your assigned FBR Tier (Tier-1 retailer / restaurant integration).
 *
 * Docs: https://www.fbr.gov.pk/categ/pos-integration/
 */
export async function pushInvoiceToFbr(order: Order, settings: Settings): Promise<{
  invoiceNumber: string;
  qrPayload: string;
  raw?: any;
}> {
  const { fbr } = settings;
  const invoiceNumber = generateFbrInvoice(fbr.posId || "0000000");

  // QR payload per FBR guidelines: invoice no. + datetime + total + tax
  const qrPayload = [
    `IRN:${invoiceNumber}`,
    `DT:${new Date(order.createdAt).toISOString()}`,
    `TOT:${order.total.toFixed(2)}`,
    `TAX:${order.tax.toFixed(2)}`,
    `POS:${fbr.posId}`,
    `NTN:${settings.ntn || ""}`,
  ].join("|");

  if (!fbr.enabled || fbr.mode === "sandbox") {
    return { invoiceNumber, qrPayload };
  }

  const body = {
    InvoiceNumber: "",
    POSID: Number(fbr.posId) || 0,
    USIN: invoiceNumber,
    DateTime: new Date(order.createdAt).toISOString(),
    BuyerNTN: "",
    BuyerCNIC: "",
    BuyerName: "Walk-in",
    BuyerPhoneNumber: "",
    TotalSaleValue: order.total,
    TotalQuantity: order.items.reduce((s, i) => s + i.qty, 0),
    Discount: order.discount,
    FurtherTax: 0,
    PaymentMode: order.paymentMethod === "cash" ? 1 : 2,
    InvoiceType: 1,
    Items: order.items.map((i) => ({
      ItemCode: i.itemId,
      ItemName: i.name,
      Quantity: i.qty,
      PCTCode: "",
      TaxRate: settings.taxRate,
      SaleValue: i.price * i.qty,
      TotalAmount: i.price * i.qty * (1 + settings.taxRate / 100),
      TaxCharged: i.price * i.qty * (settings.taxRate / 100),
      Discount: 0,
      FurtherTax: 0,
      InvoiceType: 1,
      RefUSIN: null,
    })),
  };

  try {
    const res = await fetch(fbr.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${fbr.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const raw = await res.json().catch(() => ({}));
    return {
      invoiceNumber: raw.InvoiceNumber || invoiceNumber,
      qrPayload,
      raw,
    };
  } catch (e) {
    console.error("[FBR] push failed, falling back to offline IRN:", e);
    return { invoiceNumber, qrPayload };
  }
}
