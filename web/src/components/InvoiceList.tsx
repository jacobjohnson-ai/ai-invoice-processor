import { useState } from "react";
import { day, money, toCsv } from "../format";
import type { Invoice, Status } from "../types";
import StatusLabel from "./StatusLabel";

type Filter = "all" | "attention" | "open" | "done";
const FILTERS: [Filter, string, (s: Status) => boolean][] = [
  ["all", "All", () => true],
  ["attention", "Needs attention", (s) => s === "needs_review" || s === "needs_approval" || s === "duplicate"],
  ["open", "Ready or approved", (s) => s === "ready" || s === "approved"],
  ["done", "Paid or rejected", (s) => s === "paid" || s === "rejected"],
];

export default function InvoiceList({ invoices, selected, onSelect }: { invoices: Invoice[]; selected: number | null; onSelect: (i: Invoice) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const test = FILTERS.find((f) => f[0] === filter)![2];
  const rows = invoices.filter((i) => test(i.status));

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "invoices.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="dh" style={{ marginBottom: 10 }}>
        <div className="lbl">Invoices · {rows.length}</div>
        <button className="s small" onClick={exportCsv}>Export CSV</button>
      </div>
      <div className="filters">
        {FILTERS.map(([f, label]) => <button key={f} className={`s${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>{label}</button>)}
      </div>
      <div className="list">
        {rows.length ? rows.map((i) => (
          <div key={i.id} className={`item${selected === i.id ? " sel" : ""}`} onClick={() => onSelect(i)}>
            <div>
              <div className="t">{i.vendor || "Unknown vendor"} <span className="dim">· {i.invoice_number || "no number"}</span></div>
              <div className="m">{day(i.invoice_date)} · due {day(i.due_date)}{i.mine && " · your upload"}</div>
            </div>
            <div className="right"><b>{money(i.total, i.currency)}</b><StatusLabel status={i.status} /></div>
          </div>
        )) : <div className="empty">Nothing here.</div>}
      </div>
    </div>
  );
}
