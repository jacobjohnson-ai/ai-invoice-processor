import type { Invoice } from "./types";

const SUPABASE_URL = "https://pwcpznbqkdlprkkydpnk.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_-QgwfTu1udPpjH6ndtqGEA_FUUsMz7G"; // read-only for this table (row-level security)
const WORKER_URL = "https://ai-invoice-processor.jacobjohnson-ai.workers.dev";

export async function listInvoices(): Promise<Invoice[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/invoices?select=*&order=id.desc&limit=100`, { headers: { apikey: PUBLISHABLE_KEY } });
  if (!res.ok) throw new Error("Couldn't load invoices.");
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(WORKER_URL + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j as T;
}

export async function processFile(file: Blob, fileName: string, sample = false): Promise<Invoice> {
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Couldn't read that file."));
    r.readAsDataURL(file);
  });
  const { invoice } = await post<{ invoice: Invoice }>("/extract", { file_name: fileName, mime_type: file.type, data, sample });
  return invoice;
}

export async function decide(id: number, decision: "approved" | "rejected" | "paid"): Promise<Invoice> {
  return (await post<{ invoice: Invoice }>("/decision", { id, decision })).invoice;
}
