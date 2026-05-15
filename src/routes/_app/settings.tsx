import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usePos, MODULE_LIST } from "@/lib/pos-store";
import { getServerUrl, setServerUrl, pingServer } from "@/lib/lan-client";
import { startLanSync, stopLanSync } from "@/lib/lan-sync";
import { Receipt, Building, CheckCircle2, Smartphone, Printer, Palette, Wifi, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { settings, updateSettings } = usePos();
  const [tested, setTested] = useState<string>("");
  const [serverUrl, setServerUrlState] = useState(getServerUrl() || "");
  const [serverStatus, setServerStatus] = useState<string>("");

  useEffect(() => {
    const url = getServerUrl();
    if (!url) { setServerStatus("Not configured"); return; }
    pingServer(url).then((ok) => setServerStatus(ok ? "✅ Online" : "❌ Unreachable"));
  }, []);

  const saveServer = async () => {
    const cleaned = serverUrl.trim();
    if (!cleaned) return;
    setServerUrl(cleaned);
    setServerStatus("Testing…");
    const ok = await pingServer(cleaned);
    setServerStatus(ok ? "✅ Online" : "❌ Unreachable — check the IP and that the desktop app is running");
    // Reconnect LAN sync immediately to the newly-saved URL.
    stopLanSync();
    startLanSync();
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

      <Card icon={Wifi} title="LAN Server (for Android cashier app)">
        <p className="text-sm text-muted-foreground -mt-1">
          On the desktop running the POS, this is auto-set to <code>http://127.0.0.1:7000</code>.
          On phones, paste the desktop's LAN IP (shown when the desktop app starts), e.g.{" "}
          <code>http://192.168.1.50:7000</code>.
          On the <strong>native Android APK</strong> (same shop Wi‑Fi), the app can also{" "}
          <strong>discover the desktop automatically</strong> over UDP; if that fails, use the URL field below.
        </p>
        <Field label="Server URL">
          <input value={serverUrl} onChange={(e) => setServerUrlState(e.target.value)}
            placeholder="http://192.168.1.50:7000" className={inp} />
        </Field>
        <div className="flex items-center gap-3">
          <button onClick={saveServer} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
            Save & Test
          </button>
          <span className="text-sm">{serverStatus}</span>
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
