import test from "node:test";
import assert from "node:assert/strict";
import { cleanInvoice, review, normVendor } from "../worker/review.js";

const base = () => cleanInvoice({
  vendor: "Acme Office Supply, Inc.", invoice_number: "INV-1001", invoice_date: "2026-11-01", due_date: "2026-12-01",
  currency: "USD", subtotal: 150, tax: 12, total: 162,
  line_items: [{ description: "Paper", quantity: 10, unit_price: 5, amount: 50 }, { description: "Toner", quantity: 2, unit_price: 50, amount: 100 }],
});
const TODAY = "2026-11-12";

test("clean invoice with correct math is ready", () => {
  const r = review(base(), [], TODAY);
  assert.equal(r.status, "ready");
  assert.deepEqual(r.flags, []);
});

test("line item math error needs review", () => {
  const inv = base(); inv.line_items[0].amount = 55;
  const r = review(inv, [], TODAY);
  assert.equal(r.status, "needs_review");
  assert.ok(r.flags.some((f) => f.code === "line_math"));
  assert.ok(r.flags.some((f) => f.code === "subtotal_math"));
});

test("total that doesn't match subtotal plus tax needs review", () => {
  const inv = base(); inv.total = 170;
  assert.ok(review(inv, [], TODAY).flags.some((f) => f.code === "total_math"));
});

test("same vendor and invoice number is a duplicate, even with different company suffix", () => {
  const r = review(base(), [{ id: 7, vendor: "ACME Office Supply", invoice_number: "inv-1001", invoice_date: "2026-10-01", total: 1 }], TODAY);
  assert.equal(r.status, "duplicate");
});

test("same vendor, date, and total is a duplicate even without a number match", () => {
  const r = review(base(), [{ id: 9, vendor: "Acme Office Supply LLC", invoice_number: "X-9", invoice_date: "2026-11-01", total: 162 }], TODAY);
  assert.equal(r.status, "duplicate");
});

test("large total needs approval", () => {
  const inv = cleanInvoice({ vendor: "Big Co", invoice_number: "B1", invoice_date: "2026-11-01", subtotal: 6000, tax: 0, total: 6000, line_items: [] });
  assert.equal(review(inv, [], TODAY).status, "needs_approval");
});

test("overdue and due-soon dates are flagged", () => {
  const a = base(); a.due_date = "2026-11-05";
  assert.ok(review(a, [], TODAY).flags.some((f) => f.code === "overdue"));
  const b = base(); b.due_date = "2026-11-15";
  assert.ok(review(b, [], TODAY).flags.some((f) => f.code === "due_soon"));
});

test("missing fields need review; bad values are cleaned", () => {
  const inv = cleanInvoice({ vendor: " ", invoice_date: "Nov 1", total: "162", currency: "dollars" });
  assert.equal(inv.vendor, null); assert.equal(inv.invoice_date, null); assert.equal(inv.total, null); assert.equal(inv.currency, "USD");
  assert.equal(review(inv, [], TODAY).status, "needs_review");
});

test("vendor names compare without punctuation or company suffixes", () => {
  assert.equal(normVendor("Acme, Inc."), normVendor("ACME"));
});
