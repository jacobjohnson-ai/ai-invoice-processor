import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/worker.js";

const env = { GEMINI_API_KEY: "k", SUPABASE_URL: "https://db.example", SUPABASE_SERVICE_KEY: "sb_secret_x" };
const ORIGIN = "https://jacobjohnson-ai.github.io";
const req = (path, body, origin = ORIGIN) => new Request(`https://w.example${path}`, {
  method: "POST", headers: { "Content-Type": "application/json", Origin: origin, "CF-Connecting-IP": Math.random().toString() }, body: JSON.stringify(body),
});

function mockFetch(geminiResult, existing = []) {
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    if (String(url).includes("generativelanguage")) {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(geminiResult) }] } }] }));
    }
    if (opts.method === "POST") return new Response(JSON.stringify([{ id: 42, ...JSON.parse(opts.body) }]));
    return new Response(JSON.stringify(existing));
  };
  return calls;
}

const invoice = { is_invoice: true, vendor: "Acme", invoice_number: "A-1", invoice_date: "2026-11-01", due_date: "2027-01-01", currency: "USD",
  subtotal: 100, tax: 8, total: 108, line_items: [{ description: "Thing", quantity: 1, unit_price: 100, amount: 100 }] };

test("reads, checks, and saves an invoice", async () => {
  const calls = mockFetch(invoice);
  const res = await worker.fetch(req("/extract", { file_name: "a.pdf", mime_type: "application/pdf", data: "AAAA" }), env);
  assert.equal(res.status, 200);
  const { invoice: row } = await res.json();
  assert.equal(row.status, "ready");
  assert.equal(row.total, 108);
  assert.ok(calls.some((c) => c.url.includes("generativelanguage")));
});

test("duplicate is caught even though the database returns totals as text", async () => {
  mockFetch({ ...invoice, invoice_number: "OTHER" }, [{ id: 3, vendor: "ACME Inc", invoice_number: "A-9", invoice_date: "2026-11-01", total: "108.00" }]);
  const res = await worker.fetch(req("/extract", { mime_type: "image/png", data: "AAAA" }), env);
  assert.equal((await res.json()).invoice.status, "duplicate");
});

test("rejects other sites, wrong file types, and non-invoices", async () => {
  mockFetch({ is_invoice: false, line_items: [] });
  assert.equal((await worker.fetch(req("/extract", { mime_type: "application/pdf", data: "AAAA" }, "https://evil.example"), env)).status, 403);
  assert.equal((await worker.fetch(req("/extract", { mime_type: "text/html", data: "AAAA" }), env)).status, 400);
  assert.equal((await worker.fetch(req("/extract", { mime_type: "application/pdf", data: "AAAA" }), env)).status, 422);
});

test("decision only accepts known values", async () => {
  mockFetch(invoice);
  assert.equal((await worker.fetch(req("/decision", { id: 1, decision: "delete" }), env)).status, 400);
});
