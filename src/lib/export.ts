/** Tiny CSV exporter — CSV opens cleanly in Excel / Google Sheets. */
export function exportCsv(filename: string, rows: Record<string, string | number | undefined | null>[]) {
  if (rows.length === 0) {
    alert("Nothing to export.");
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  // BOM so Excel detects UTF-8 (Urdu support)
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Filter list by createdAt/timestamp inside [from, to] (inclusive of day boundaries). */
export function inDateRange<T extends { createdAt: number }>(list: T[], from?: string, to?: string): T[] {
  if (!from && !to) return list;
  const f = from ? new Date(from + "T00:00:00").getTime() : -Infinity;
  const t = to ? new Date(to + "T23:59:59.999").getTime() : Infinity;
  return list.filter((x) => x.createdAt >= f && x.createdAt <= t);
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
