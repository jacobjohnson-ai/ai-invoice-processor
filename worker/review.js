// Invoice checks. Pure functions, no network, so they're easy to test.

export const APPROVAL_LIMIT = 5000;   // totals at or above this need a manager's approval
const CENT = 0.02;                    // rounding tolerance

const usd = (v) => v.toLocaleString("en-US", { style: "currency", currency: "USD" });
const fmtDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
export const normVendor = (s) =>
  String(s || "").toLowerCase().replace(/[.,]/g, " ").replace(/\b(inc|llc|ltd|co|corp|corporation|company)\b/g, "").replace(/\s+/g, " ").trim();

// Clean what the model returned into a predictable shape
export function cleanInvoice(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const text = (v, n) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
  const date = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const items = Array.isArray(r.line_items) ? r.line_items.slice(0, 50).map((i) => ({
    description: text(i?.description, 200) || "Item",
    quantity: num(i?.quantity),
    unit_price: num(i?.unit_price),
    amount: num(i?.amount),
  })) : [];
  return {
    is_invoice: r.is_invoice !== false,
    vendor: text(r.vendor, 120),
    invoice_number: text(r.invoice_number, 60),
    invoice_date: date(r.invoice_date),
    due_date: date(r.due_date),
    currency: /^[A-Z]{3}$/.test(r.currency || "") ? r.currency : "USD",
    subtotal: num(r.subtotal),
    tax: num(r.tax) ?? 0,
    total: num(r.total),
    line_items: items,
  };
}

// Returns the flags (each with a plain-English message) and the resulting status.
// `existing` = invoices already saved: [{ id, vendor, invoice_number, invoice_date, total, status }]
export function review(inv, existing = [], today = new Date().toISOString().slice(0, 10)) {
  const flags = [];
  const add = (code, message) => flags.push({ code, message });

  if (!inv.vendor) add("missing_vendor", "No vendor name found.");
  if (!inv.invoice_number) add("missing_number", "No invoice number found.");
  if (!inv.invoice_date) add("missing_date", "No invoice date found.");
  if (inv.total === null) add("missing_total", "No total found.");

  // Math checks
  const itemSum = inv.line_items.reduce((s, i) => s + (i.amount ?? 0), 0);
  inv.line_items.forEach((i, n) => {
    if (i.quantity !== null && i.unit_price !== null && i.amount !== null && Math.abs(i.quantity * i.unit_price - i.amount) > CENT)
      add("line_math", `Line ${n + 1}: ${i.quantity} × ${usd(i.unit_price)} is ${usd(i.quantity * i.unit_price)}, but the invoice says ${usd(i.amount)}.`);
  });
  if (inv.subtotal !== null && inv.line_items.length && Math.abs(itemSum - inv.subtotal) > CENT)
    add("subtotal_math", `Line items add up to ${usd(itemSum)}, but the subtotal says ${usd(inv.subtotal)}.`);
  if (inv.subtotal !== null && inv.total !== null && Math.abs(inv.subtotal + inv.tax - inv.total) > CENT)
    add("total_math", `Subtotal plus tax is ${usd(inv.subtotal + inv.tax)}, but the total says ${usd(inv.total)}.`);

  // Duplicates: same vendor and invoice number, or same vendor, date, and total
  const v = normVendor(inv.vendor);
  const dup = v && existing.find((e) => normVendor(e.vendor) === v && (
    (inv.invoice_number && e.invoice_number && e.invoice_number.toLowerCase() === inv.invoice_number.toLowerCase()) ||
    (inv.total !== null && e.total === inv.total && e.invoice_date && e.invoice_date === inv.invoice_date)));
  if (dup) add("duplicate", `Looks like a duplicate of ${dup.invoice_number || "an invoice"} from ${e_vendor(dup)}${dup.status === "paid" ? ", which was already paid" : ""}.`);

  // Due dates
  if (inv.due_date && inv.due_date < today) add("overdue", `Payment was due ${fmtDate(inv.due_date)}.`);
  else if (inv.due_date && daysBetween(today, inv.due_date) <= 7) add("due_soon", `Payment is due ${fmtDate(inv.due_date)}.`);

  if (inv.total !== null && inv.total >= APPROVAL_LIMIT) add("approval", `Total is ${usd(inv.total)}, over the ${usd(APPROVAL_LIMIT)} limit, so a manager has to approve it.`);

  const has = (c) => flags.some((f) => f.code === c);
  const status = has("duplicate") ? "duplicate"
    : flags.some((f) => ["missing_vendor", "missing_number", "missing_date", "missing_total", "line_math", "subtotal_math", "total_math"].includes(f.code)) ? "needs_review"
    : has("approval") ? "needs_approval"
    : "ready";
  return { flags, status };
}

const e_vendor = (d) => d.vendor || "the same vendor";

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
}
