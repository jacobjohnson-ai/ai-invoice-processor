import { useRef, useState, type DragEvent } from "react";
import { processFile } from "../api";
import type { Invoice } from "../types";

const SAMPLES = [
  { file: "1-office-supplies.pdf", label: "Office supplies", what: "Clean invoice" },
  { file: "2-math-error.pdf", label: "IT services", what: "Has a math error" },
  { file: "3-duplicate.pdf", label: "Office supplies (resent)", what: "Already paid last month" },
  { file: "4-needs-approval.pdf", label: "Office furniture", what: "Over the approval limit" },
];
const TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const STEPS = ["Reading the document…", "Pulling out line items and totals…", "Checking the math and looking for duplicates…"];

export default function Uploader({ onDone }: { onDone: (inv: Invoice) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function run(file: Blob, name: string, sample = false) {
    if (!TYPES.includes(file.type)) { setError("Upload a PDF, PNG, JPG, or WebP file."); return; }
    if (file.size > 4 * 1024 * 1024) { setError("Files must be under 4 MB."); return; }
    setBusy(name); setError(""); setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2200);
    try { onDone(await processFile(file, name, sample)); }
    catch (e) { setError((e as Error).message); }
    clearInterval(timer);
    setBusy(null);
  }

  async function sample(file: string) {
    setBusy(file); setError("");
    try {
      const blob = await (await fetch(`${import.meta.env.BASE_URL}samples/${file}`)).blob();
      await run(new Blob([blob], { type: "application/pdf" }), file, true);
    } catch { setError("Couldn't load that sample."); setBusy(null); }
  }

  function drop(e: DragEvent) {
    e.preventDefault(); setOver(false);
    const f = e.dataTransfer.files[0];
    if (f && !busy) run(f, f.name);
  }

  return (
    <div className="box">
      <div className="lbl">Try a sample invoice</div>
      <div className="samples">
        {SAMPLES.map((s) => (
          <button key={s.file} className="sample" disabled={!!busy} onClick={() => sample(s.file)}>
            <b>{s.label}</b><span>{s.what}</span>
            <a href={`${import.meta.env.BASE_URL}samples/${s.file}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>View PDF</a>
          </button>
        ))}
      </div>
      <div className={`drop${over ? " over" : ""}${busy ? " busy" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
        onClick={() => !busy && input.current?.click()}>
        {busy ? <><b>{STEPS[step]}</b><span>{busy}</span></>
          : <><b>Or drop your own invoice here</b><span>PDF, PNG, or JPG, up to 4 MB. This demo is public, so don't upload real invoices with private details.</span></>}
        <input ref={input} type="file" accept=".pdf,image/png,image/jpeg,image/webp" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f, f.name); e.target.value = ""; }} />
      </div>
      {error && <div className="err">{error}</div>}
    </div>
  );
}
