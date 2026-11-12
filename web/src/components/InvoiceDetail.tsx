import { useState } from "react";
import { decide } from "../api";
import { day, money } from "../format";
import type { Invoice } from "../types";
import StatusLabel from "./StatusLabel";

export default function InvoiceDetail({ invoice: inv, onChange }: { invoice: Invoice; onChange: (i: Invoice) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cur = inv.currency || "USD";

  async function act(d: "approved" | "rejected" | "paid") {
    setBusy(true); setError("");
    try { onChange(await decide(inv.id, d)); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  const open = inv.mine && ["ready", "needs_review", "needs_approval", "duplicate"].includes(inv.status);
  return (
    <div className="box detail">
      <div className="dh"><h2>{inv.vendor || "Unknown vendor"}</h2><StatusLabel status={inv.status} /></div>
      <div className="meta">
        <span>Invoice #</span><div>{inv.invoice_number || "–"}</div>
        <span>Invoice date</span><div>{day(inv.invoice_date)}</div>
        <span>Due date</span><div>{day(inv.due_date)}</div>
        <span>File</span><div className="dim">{inv.file_name}</div>
      </div>

      {inv.flags.length > 0 && (
        <div className="flags">
          {inv.flags.map((f, i) => <div key={i} className={`flag ${f.code}`}>{f.message}</div>)}
        </div>
      )}

      <table className="items">
        <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
        <tbody>
          {inv.line_items.map((l, i) => (
            <tr key={i}><td>{l.description}</td><td>{l.quantity ?? "–"}</td><td>{money(l.unit_price, cur)}</td><td>{money(l.amount, cur)}</td></tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={3}>Subtotal</td><td>{money(inv.subtotal, cur)}</td></tr>
          <tr><td colSpan={3}>Tax</td><td>{money(inv.tax, cur)}</td></tr>
          <tr className="tot"><td colSpan={3}>Total</td><td>{money(inv.total, cur)}</td></tr>
        </tfoot>
      </table>

      {open && (
        <div className="acts">
          {inv.status === "needs_approval" && <button disabled={busy} onClick={() => act("approved")}>Approve</button>}
          {inv.status === "ready" && <button disabled={busy} onClick={() => act("paid")}>Mark paid</button>}
          <button className="s" disabled={busy} onClick={() => act("rejected")}>Reject</button>
        </div>
      )}
      {inv.mine && inv.status === "approved" && <div className="acts"><button disabled={busy} onClick={() => act("paid")}>Mark paid</button></div>}
      {error && <div className="err">{error}</div>}
    </div>
  );
}
