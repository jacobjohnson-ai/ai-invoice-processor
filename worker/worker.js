// AI Invoice Processor: Cloudflare Worker
// POST /extract   { file_name, mime_type, data (base64) } -> reads the invoice with Gemini, checks it, saves it
// POST /decision  { id, decision: "approved" | "rejected" | "paid" } -> records a decision
// Secrets (Cloudflare settings): GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
import { cleanInvoice, review } from "./review.js";

const MODEL = "gemini-3.5-flash-lite";
const ALLOWED_ORIGINS = ["https://jacobjohnson-ai.github.io", "http://localhost:5173"];
const TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024;
const UPLOADS_PER_MIN = 4;     // per visitor; Gemini's free tier allows 15 requests/min in total
const UPLOADS_PER_DAY = 25;

// The shape Gemini must return (structured output, so no free-form text to parse)
const SCHEMA = {
  type: "OBJECT",
  properties: {
    is_invoice: { type: "BOOLEAN", description: "False if this is not an invoice or receipt" },
    vendor: { type: "STRING", nullable: true },
    invoice_number: { type: "STRING", nullable: true },
    invoice_date: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
    due_date: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
    currency: { type: "STRING", description: "3-letter code, e.g. USD" },
    subtotal: { type: "NUMBER", nullable: true },
    tax: { type: "NUMBER", nullable: true },
    total: { type: "NUMBER", nullable: true },
    line_items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          description: { type: "STRING" },
          quantity: { type: "NUMBER", nullable: true },
          unit_price: { type: "NUMBER", nullable: true },
          amount: { type: "NUMBER", nullable: true },
        },
        required: ["description"],
      },
    },
  },
  required: ["is_invoice", "line_items"],
};

const PROMPT = `Read this invoice or receipt and return its fields.
Copy numbers exactly as printed. Do not fix or recalculate anything, even if the math looks wrong.
Use null for anything that isn't on the document. Dates as YYYY-MM-DD.`;

export async function extract(env, mime, data) {
  const call = () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data } }, { text: PROMPT }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA, maxOutputTokens: 2000 },
    }),
  });
  let res = await call();
  if (res.status === 503 || res.status === 429) { await new Promise((r) => setTimeout(r, 1500)); res = await call(); }
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const text = (await res.json())?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return cleanInvoice(JSON.parse(text));
}

// ---- Supabase (service key stays on the server) ----
const base = (env) => String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
function sbHeaders(env, extra = {}) {
  const key = String(env.SUPABASE_SERVICE_KEY || "").trim();
  return { apikey: key, ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }), "Content-Type": "application/json", ...extra };
}
async function sb(env, path, opts = {}) {
  const res = await fetch(`${base(env)}/rest/v1/${path}`, { ...opts, headers: sbHeaders(env, opts.headers) });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

// ---- Rate limiting (per Worker instance; good enough for a demo) ----
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return true; }
  arr.push(now); hits.set(key, arr);
  return false;
}

const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "POST") return json({ error: "Use POST." }, 405, headers);
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: "Not allowed." }, 403, headers);

    const url = new URL(request.url);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    let body;
    try { body = await request.json(); } catch { return json({ error: "Send JSON." }, 400, headers); }

    try {
      if (url.pathname === "/extract") {
        const mime = String(body?.mime_type || "");
        const data = String(body?.data || "");
        if (!TYPES.includes(mime)) return json({ error: "Upload a PDF, PNG, JPG, or WebP file." }, 400, headers);
        if (!data || data.length * 0.75 > MAX_BYTES) return json({ error: "Files must be under 4 MB." }, 400, headers);
        if (limited(`m:${ip}`, UPLOADS_PER_MIN, 60_000)) return json({ error: "Too many uploads. Wait a minute and try again." }, 429, headers);
        if (limited(`d:${ip}`, UPLOADS_PER_DAY, 864e5)) return json({ error: "Daily upload limit reached for this demo." }, 429, headers);

        const inv = await extract(env, mime, data);
        if (!inv.is_invoice) return json({ error: "That doesn't look like an invoice or receipt." }, 422, headers);

        // Compare against saved invoices from the same vendor family for duplicate checks
        // Postgres numeric comes back as text, so convert totals before comparing
        // Sample uploads are only compared with real history, not with other visitors' sample uploads,
        // so every visitor sees the same result for the same sample.
        const sample = body?.sample === true;
        const existing = (await sb(env, `invoices?select=id,vendor,invoice_number,invoice_date,total,status&is_sample=eq.false&order=id.desc&limit=500`))
          .map((e) => ({ ...e, total: e.total === null ? null : Number(e.total) }));
        const { flags, status } = review(inv, existing);
        const { is_invoice, ...fields } = inv;
        const [row] = await sb(env, "invoices", {
          method: "POST", headers: { Prefer: "return=representation" },
          body: JSON.stringify({ ...fields, status, flags, is_sample: sample, file_name: String(body?.file_name || "upload").slice(0, 120) }),
        });
        return json({ invoice: row }, 200, headers);
      }

      if (url.pathname === "/decision") {
        const id = Number(body?.id), decision = String(body?.decision || "");
        if (!Number.isInteger(id) || !["approved", "rejected", "paid"].includes(decision)) return json({ error: "Bad request." }, 400, headers);
        if (limited(`x:${ip}`, 20, 60_000)) return json({ error: "Slow down a little." }, 429, headers);
        // Visitors can only decide on their own uploads, never on the shared demo history
        const [row] = await sb(env, `invoices?id=eq.${id}&is_public=eq.false`, {
          method: "PATCH", headers: { Prefer: "return=representation" },
          body: JSON.stringify({ status: decision, decided_at: new Date().toISOString() }),
        });
        if (!row) return json({ error: "Invoice not found." }, 404, headers);
        return json({ invoice: row }, 200, headers);
      }
      return json({ error: "Not found." }, 404, headers);
    } catch (e) {
      console.error(String(e));
      const busy = /gemini (429|503)/.test(String(e));
      return json({ error: busy ? "The AI is busy right now. Try again in a minute." : "Something went wrong reading that file. Try another one." }, busy ? 503 : 500, headers);
    }
  },
};
