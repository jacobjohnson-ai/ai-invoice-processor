import { useCallback, useEffect, useState } from "react";
import { listInvoices } from "./api";
import type { Invoice } from "./types";
import Uploader from "./components/Uploader";
import InvoiceDetail from "./components/InvoiceDetail";
import InvoiceList from "./components/InvoiceList";
import Summary from "./components/Summary";

export default function App() {
  // Demo history comes from the database; your uploads are kept only in this page, never listed for other visitors
  const [history, setHistory] = useState<Invoice[] | null>(null);
  const [mine, setMine] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => listInvoices().then(setHistory).catch((e: Error) => setError(e.message)), []);
  useEffect(() => { reload(); }, [reload]);

  function upsert(inv: Invoice) {
    if (history?.some((h) => h.id === inv.id)) setHistory((h) => h!.map((x) => (x.id === inv.id ? inv : x)));
    else setMine((list) => [{ ...inv, mine: true }, ...list.filter((x) => x.id !== inv.id)]);
    inv = { ...inv, mine: !history?.some((h) => h.id === inv.id) };
    setSelected(inv);
  }
  const invoices = history ? [...mine, ...history] : null;

  return (
    <div className="wrap">
      <nav className="site"><a href="/">← Jacob Johnson</a><a href="/#projects">Projects</a></nav>
      <header>
        <h1>AI Invoice Processor <span className="demo">demo</span></h1>
        <p>Upload an invoice and AI reads the vendor, dates, line items, and totals. Then it checks the math, catches duplicate bills,
          and sends anything over $5,000 for approval, like an accounts payable clerk would.</p>
      </header>
      <div className="split">
        <div className="col">
          <Uploader onDone={upsert} />
          {selected && <InvoiceDetail invoice={selected} onChange={upsert} />}
        </div>
        <div className="col">
          {invoices && <Summary invoices={invoices} />}
          {error && <div className="err">{error}</div>}
          {invoices ? <InvoiceList invoices={invoices} selected={selected?.id ?? null} onSelect={setSelected} />
            : !error && <div className="empty">Loading invoices…</div>}
        </div>
      </div>
    </div>
  );
}
