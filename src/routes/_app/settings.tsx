import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usePos, MODULE_LIST } from "@/lib/pos-store";
import { checkServer, onSyncStatus, pullStateOnce, pushStateNow, type SyncStatus } from "@/lib/sync";
import { Receipt, Building, CheckCircle2, Smartphone, Printer, Palette, Cloud, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { settings, updateSettings } = usePos();
  const [tested, setTested] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [storage, setStorage] = useState<{ storage: string; durable: boolean } | null>(null);
  const [syncNote, setSyncNote] = useState<string>("");

  useEffect(() => onSyncStatus(setSyncStatus), []);

  useEffect(() => {
    checkServer().then((h) => setStorage(h ? { storage: h.storage, durable: h.durable } : null));
  }, []);

  const syncNow = async () => {
    setSyncNote("Syncing…");
    await pushStateNow();
    const ok = await pullStateOnce();
    setSyncNote(ok ? `✅ Synced at ${new Date().toLocaleTimeString()}` : "❌ Server unreachable — data stays on this device");
  };

  const testFbr = async () => {
    setTested("Testing connection…");
    await new Promise((r) => setTimeout(r, 800));
    if (!settings.fbr.posId || !settings.fbr.apiKey) {
      setTested("❌ Missing POS ID or API key");
      return;
    }
    setTested(`✅ Connected to ${settings.fbr.mode === "live" ? "FBR Live" : "FBR Sandbox"} · POS ${settings.fbr.posId}`);
  };

  return (
    <div className="p-4 lg:p-6 max-w-4xl space-y-4">
      <Card icon={Building} title="Restaurant Profile">
        <Field label="Name"><input value={settings.restaurantName} onChange={(e) => updateSettings({ restaurantName: e.target.value })} className={inp} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="NTN"><input value={settings.ntn || ""} onChange={(e) => updateSettings({ ntn: e.target.value })} placeholder="1234567-8" className={inp} /></Field>
          <Field label="STRN"><input value={settings.strn || ""} onChange={(e) => updateSettings({ strn: e.target.value })} placeholder="32-77-9876-543-21" className={inp} /></Field>
        </div>
        <Field label="Address"><input value={settings.address || ""} onChange={(e) => updateSettings({ address: e.target.value })} className={inp} /></Field>
        <Field label="Phone"><input value={settings.phone || ""} onChange={(e) => updateSettings({ phone: e.target.value })} className={inp} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Currency"><input value={settings.currency} onChange={(e) => updateSettings({ currency: e.target.value })} className={inp} /></Field>
          <Field label="Sales Tax %"><input type="number" value={settings.taxRate} onChange={(e) => updateSettings({ taxRate: +e.target.value })} className={inp} /></Field>
          <Field label="Service %"><input type="number" value={settings.serviceCharge} onChange={(e) => updateSettings({ serviceCharge: +e.target.value })} className={inp} /></Field>
        </div>
        <Field label="Loyalty: points per PKR 100"><input type="number" value={settings.pointsPer100} onChange={(e) => updateSettings({ pointsPer100: +e.target.value })} className={inp} /></Field>
        <Field label="Receipt Footer"><input value={settings.receiptFooter} onChange={(e) => updateSettings({ receiptFooter: e.target.value })} className={inp} /></Field>
        <Field label="Urdu Header (optional)"><input value={settings.receiptHeaderUrdu || ""} onChange={(e) => updateSettings({ receiptHeaderUrdu: e.target.value })} className={inp} dir="rtl" /></Field>
      </Card>

      <Card icon={Cloud} title="Cloud Sync">
        <p className="text-sm text-muted-foreground -mt-1">
          Every device that opens this website shares the same data — no IP addresses or setup needed.
          Changes push automatically and other devices pick them up within a few seconds. If the
          connection drops, the POS keeps working on this device and re-syncs when it returns.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${SYNC_BADGE[syncStatus]}`}>
            {SYNC_LABEL[syncStatus]}
          </span>
          {storage && (
            <span className="text-xs text-muted-foreground">
              Storage: <code>{storage.storage}</code>
              {storage.durable ? " · persistent" : " · temporary (configure a Redis/KV store for permanent shared data)"}
            </span>
          )}
          {!storage && <span className="text-xs text-muted-foreground">Server not reachable — working offline</span>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={syncNow} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
            Sync now
          </button>
          <span className="text-sm">{syncNote}</span>
        </div>
      </Card>

      <Card icon={Receipt} title="FBR POS Integration (Pakistan)">
        <p className="text-sm text-muted-foreground -mt-1">
          Push every sale to FBR's Invoice Management System (IMS). Your receipts will print with a verifiable FBR invoice number and QR code.
        </p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={settings.fbr.enabled} onChange={(e) => updateSettings({ fbr: { ...settings.fbr, enabled: e.target.checked } })} />
          Enable FBR live invoice push
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="POS Registration ID"><input value={settings.fbr.posId} onChange={(e) => updateSettings({ fbr: { ...settings.fbr, posId: e.target.value } })} placeholder="e.g. 1234567" className={inp} /></Field>
          <Field label="Mode">
            <select value={settings.fbr.mode} onChange={(e) => updateSettings({ fbr: { ...settings.fbr, mode: e.target.value as any } })} className={inp}>
              <option value="sandbox">Sandbox (Test)</option>
              <option value="live">Live (Production)</option>
            </select>
          </Field>
        </div>
        <Field label="API Key / Bearer Token"><input type="password" value={settings.fbr.apiKey} onChange={(e) => updateSettings({ fbr: { ...settings.fbr, apiKey: e.target.value } })} className={inp} /></Field>
        <Field label="Endpoint URL"><input value={settings.fbr.endpoint} onChange={(e) => updateSettings({ fbr: { ...settings.fbr, endpoint: e.target.value } })} className={inp} /></Field>
        <button onClick={testFbr} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium w-fit">Test Connection</button>
        {tested && <div className="text-sm">{tested}</div>}
        {settings.fbr.enabled && (
          <div className="rounded-lg bg-success/10 border border-success/30 p-3 text-sm text-success flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> FBR integration is active. Invoices push automatically on payment, with QR-coded receipts.
          </div>
        )}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">FBR Setup Guide</summary>
          <ol className="list-decimal ml-5 mt-2 space-y-1">
            <li>Apply for POS integration via IRIS portal at <code>iris.fbr.gov.pk</code>.</li>
            <li>Receive your unique POS Registration ID (7 digits).</li>
            <li>Generate Bearer token from FBR Tier-1 portal.</li>
            <li>Paste credentials above and switch mode to Live.</li>
            <li>Every paid invoice is pushed and a QR code is printed for customer verification.</li>
          </ol>
        </details>
      </Card>

      <Card icon={Smartphone} title="Payment Methods">
        <p className="text-sm text-muted-foreground -mt-1">Enable methods you accept.</p>
        <div className="grid grid-cols-2 gap-2">
          {(["cash", "card", "jazzcash", "easypaisa", "sadapay", "nayapay"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 p-2 rounded-lg bg-secondary text-sm capitalize">
              <input type="checkbox" checked={settings.paymentMethods[k]} onChange={(e) => updateSettings({ paymentMethods: { ...settings.paymentMethods, [k]: e.target.checked } })} />
              {k}
            </label>
          ))}
        </div>
      </Card>

      <Card icon={ShoppingCart} title="POS behavior">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.blockPOSWhenOutOfStock === true}
            onChange={(e) => updateSettings({ blockPOSWhenOutOfStock: e.target.checked })}
            className="mt-0.5"
          />
          <span>
            Block adding items when stock is zero (strict). When off, you can still sell and stock may go
            negative — this is the default for most restaurants.
          </span>
        </label>
      </Card>

      <Card icon={Printer} title="Receipt Printer">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Width">
            <select value={settings.printer.width} onChange={(e) => updateSettings({ printer: { ...settings.printer, width: +e.target.value as 58 | 80 } })} className={inp}>
              <option value={58}>58 mm</option>
              <option value={80}>80 mm</option>
            </select>
          </Field>
          <Field label="Copies"><input type="number" min={1} max={5} value={settings.printer.copies} onChange={(e) => updateSettings({ printer: { ...settings.printer, copies: +e.target.value || 1 } })} className={inp} /></Field>
          <Field label="Auto-open Drawer">
            <select value={settings.printer.autoOpenDrawer ? "1" : "0"} onChange={(e) => updateSettings({ printer: { ...settings.printer, autoOpenDrawer: e.target.value === "1" } })} className={inp}>
              <option value="1">Yes</option><option value="0">No</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card icon={Palette} title="Theme">
        <div className="flex gap-2">
          {(["light", "dark"] as const).map((t) => (
            <button key={t} onClick={() => { updateSettings({ theme: t }); document.documentElement.classList.toggle("dark", t === "dark"); }}
              className={`flex-1 py-3 rounded-lg border-2 capitalize ${settings.theme === t ? "border-primary bg-primary/5" : "border-border"}`}>
              {t}
            </button>
          ))}
        </div>
      </Card>

      <Card icon={CheckCircle2} title="My Active Modules">
        <p className="text-sm text-muted-foreground -mt-1">Modules currently enabled in your subscription.</p>
        <div className="grid gap-2 md:grid-cols-2">
          {MODULE_LIST.map((m) => (
            <div key={m.key} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary">
              <span className="text-sm">{m.label}</span>
              <span className={`text-xs font-bold ${settings.modules[m.key] ? "text-success" : "text-muted-foreground"}`}>
                {settings.modules[m.key] ? "Enabled" : "—"}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const inp = "w-full px-3 py-2 rounded-lg border border-input bg-background text-sm";

const SYNC_LABEL: Record<SyncStatus, string> = {
  idle: "Not started",
  connecting: "Connecting…",
  online: "✅ Connected",
  syncing: "Syncing…",
  offline: "⚠️ Offline (local only)",
};

const SYNC_BADGE: Record<SyncStatus, string> = {
  idle: "bg-secondary text-secondary-foreground",
  connecting: "bg-secondary text-secondary-foreground",
  online: "bg-success/10 text-success",
  syncing: "bg-primary/10 text-primary",
  offline: "bg-warning/10 text-warning",
};

function Card({ icon: Icon, title, children }: any) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-3">
      <h3 className="font-semibold flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{title}</h3>
      {children}
    </div>
  );
}
function Field({ label, children }: any) {
  return <label className="block"><div className="text-xs font-medium mb-1 text-muted-foreground">{label}</div>{children}</label>;
}
