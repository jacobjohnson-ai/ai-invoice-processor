import type { Invoice, Status } from "./types";

export const n = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));
export const money = (v: string | number | null | undefined, cur = "USD") => {
  const x = n(v);
  return x === null ? "–" : x.toLocaleString("en-US", { style: "currency", currency: cur });
};
export const day = (d: string | null) => (d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "–");

export const STATUS: Record<Status, { label: string; tone: string }> = {
  ready: { label: "Ready to pay", tone: "ok" },
  needs_review: { label: "Needs review", tone: "warn" },
  needs_approval: { label: "Needs approval", tone: "warn" },
  duplicate: { label: "Possible duplicate", tone: "bad" },
  approved: { label: "Approved", tone: "ok" },
  rejected: { label: "Rejected", tone: "muted" },
  paid: { label: "Paid", tone: "muted" },
};

export function toCsv(rows: Invoice[]): string {
  const cols = ["id", "vendor", "invoice_number", "invoice_date", "due_date", "currency", "subtotal", "tax", "total", "status"] as const;
  const cell = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}
