import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usePos, MODULE_LIST, type Staff } from "@/lib/pos-store";
import { Plus, Pencil, Trash2, UserCog, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_app/staff")({ component: StaffPage });

// Modules that are owner-only and cannot be granted to cashiers/waiters/etc.
const OWNER_ONLY = new Set(["staff", "settings"]);

const ASSIGNABLE = MODULE_LIST.filter((m) => !OWNER_ONLY.has(m.key));

function StaffPage() {
  const navigate = useNavigate();
  const { staff, upsertStaff, deleteStaff, currentStaffId } = usePos();
  const me = staff.find((s) => s.id === currentStaffId);
  const [editing, setEditing] = useState<Staff | null>(null);

  // Hard guard: only owners may visit this page
  useEffect(() => {
    if (me && me.role !== "owner") navigate({ to: "/" });
  }, [me, navigate]);

  if (!me || me.role !== "owner") return null;

  const blank = (): Staff => ({
    id: crypto.randomUUID(),
    name: "",
    pin: "",
    role: "cashier",
    active: true,
    permissions: ["pos", "orders"],
  });

  const togglePerm = (key: string) => {
    if (!editing) return;
    const cur = editing.permissions ?? [];
    setEditing({
      ...editing,
      permissions: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
    });
  };

  const isPinTaken = editing
    ? staff.some((s) => s.pin === editing.pin && s.id !== editing.id)
    : false;

  const canSave = editing
    ? editing.name.trim().length > 0 && /^\d{4}$/.test(editing.pin) && !isPinTaken
    : false;

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Staff & Access</h2>
          <p className="text-sm text-muted-foreground">
            Owner Admin can create cashiers and choose exactly which sections each one sees.
          </p>
        </div>
        <button
          onClick={() => setEditing(blank())}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {staff.map((s) => (
          <div key={s.id} className={`rounded-xl border p-4 shadow-card ${currentStaffId === s.id ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                  {s.name.charAt(0) || "?"}
                </div>
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                    <UserCog className="h-3 w-3" />{s.role}
                  </div>
                </div>
              </div>
              <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${s.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                {s.active ? "Active" : "Off"}
              </span>
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1 mb-1">
                <ShieldCheck className="h-3 w-3" /> Sections
              </div>
              <div className="flex flex-wrap gap-1">
                {s.role === "owner" ? (
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">All sections</span>
                ) : (s.permissions ?? []).length === 0 ? (
                  <span className="italic">None</span>
                ) : (
                  (s.permissions ?? []).map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded bg-secondary">{p}</span>
                  ))
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">PIN: <code className="bg-secondary px-1.5 py-0.5 rounded">••••</code></span>
              <div className="flex gap-1">
                <button onClick={() => setEditing(s)} className="p-1.5 hover:bg-accent rounded">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {s.id !== currentStaffId && s.role !== "owner" && (
                  <button
                    onClick={() => confirm(`Delete ${s.name}?`) && deleteStaff(s.id)}
                    className="p-1.5 hover:bg-destructive/10 text-destructive rounded">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-lg my-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">
              {staff.find((x) => x.id === editing.id) ? "Edit" : "New"} Staff Member
            </h3>
            <div className="space-y-3">
              <input placeholder="Full name" value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              <input placeholder="Phone (optional)" value={editing.phone || ""}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              <div>
                <input placeholder="4-digit PIN" maxLength={4} value={editing.pin}
                  onChange={(e) => setEditing({ ...editing, pin: e.target.value.replace(/\D/g, "") })}
                  className={`w-full px-3 py-2 rounded-lg border bg-background text-sm font-mono tracking-widest ${isPinTaken ? "border-destructive" : "border-input"}`} />
                {isPinTaken && <p className="text-xs text-destructive mt-1">This PIN is already used by another staff member.</p>}
              </div>
              <select value={editing.role}
                onChange={(e) => setEditing({ ...editing, role: e.target.value as Staff["role"] })}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="cashier">Cashier</option>
                <option value="waiter">Waiter</option>
                <option value="kitchen">Kitchen</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner (full access)</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active
              </label>

              {editing.role !== "owner" && (
                <div className="border-t border-border pt-3">
                  <div className="text-sm font-semibold mb-1 flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4" /> Allowed Sections
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Pick which parts of the POS this user will see in their sidebar. Unchecked sections won't appear at all.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {ASSIGNABLE.map((m) => {
                      const checked = (editing.permissions ?? []).includes(m.key);
                      return (
                        <label key={m.key}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ${checked ? "border-primary bg-primary/5" : "border-input bg-background hover:bg-accent"}`}>
                          <input type="checkbox" checked={checked} onChange={() => togglePerm(m.key)} />
                          <span className="truncate">{m.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {editing.role === "owner" && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary">
                  Owners always have access to every section, including Staff & Access and Settings.
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-secondary text-sm">
                Cancel
              </button>
              <button
                disabled={!canSave}
                onClick={() => { upsertStaff(editing); setEditing(null); }}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
