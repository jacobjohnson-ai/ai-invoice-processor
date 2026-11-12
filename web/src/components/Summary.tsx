import { money, n } from "../format";
import type { Invoice } from "../types";

export default function Summary({ invoices }: { invoices: Invoice[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const sum = (xs: Invoice[]) => xs.reduce((s, i) => s + (n(i.total) ?? 0), 0);
  const unpaid = invoices.filter((i) => ["ready", "approved", "needs_approval", "needs_review"].includes(i.status));
  const items: [string, string][] = [
    ["Unpaid", money(sum(unpaid))],
    ["Due in 7 days", money(sum(unpaid.filter((i) => i.due_date && i.due_date >= today && i.due_date <= week)))],
    ["Awaiting approval", String(invoices.filter((i) => i.status === "needs_approval").length)],
    ["Flagged", String(invoices.filter((i) => i.status === "needs_review" || i.status === "duplicate").length)],
  ];
  return <div className="stats">{items.map(([l, v]) => <div className="stat" key={l}><span>{l}</span><b>{v}</b></div>)}</div>;
}
