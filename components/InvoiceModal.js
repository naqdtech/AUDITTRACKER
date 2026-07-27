"use client";
import { useEffect, useRef, useState } from "react";
import { InvoiceSheet } from "./InvoiceSheet";
import { fmtInvoiceDate, fyFromAY, todayISO, ASSESSMENT_YEAR } from "../lib/config";
import { upiQrDataUrl, invoiceNodeToPdf } from "../lib/invoice";

export default function InvoiceModal({ client: c, suggestedNo, onClose, onSaved, notify }) {
  const prev = c.invoice || {};
  const ay = c.assessment_year || ASSESSMENT_YEAR;
  const [no, setNo] = useState(prev.no || suggestedNo || "");
  const [dateISO, setDateISO] = useState(prev.date || todayISO());
  const [particulars, setParticulars] = useState(prev.particulars || "Tax Audit & ITR Filing Fee");
  const [fy, setFy] = useState(prev.fy || fyFromAY(ay));
  const [amount, setAmount] = useState(prev.amount ?? c.fee_quoted ?? "");
  const [qr, setQr] = useState(null);
  const [busy, setBusy] = useState(false);
  const sheetRef = useRef(null);

  // Regenerate the UPI QR (with amount) whenever the amount changes.
  useEffect(() => {
    let alive = true;
    upiQrDataUrl(amount, c.name).then((d) => { if (alive) setQr(d); }).catch(() => {});
    return () => { alive = false; };
  }, [amount, c.name]);

  const invoice = { no, date: fmtInvoiceDate(dateISO), particulars, fy, amount };
  const payload = { no, date: dateISO, particulars, fy, amount: Number(amount) || 0 };

  const save = () => { onSaved(payload); notify?.("Invoice saved"); };

  const downloadPdf = async () => {
    setBusy(true);
    try {
      await invoiceNodeToPdf(sheetRef.current, `Invoice-${no.replace(/[\/\\]/g, "-")}-${(c.name || "client").replace(/\s+/g, "-")}`);
      onSaved(payload);
      notify?.("Invoice PDF downloaded");
    } catch (e) { notify?.("PDF failed: " + (e.message || e)); }
    setBusy(false);
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-h">
          <div>
            <h2>Generate Invoice</h2>
            <div className="sub">{c.name} · {c.pan || "PAN —"}</div>
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="modal-b">
          <div className="grid3">
            <div className="field"><label>Invoice No.</label>
              <input value={no} onChange={(e) => setNo(e.target.value)} /></div>
            <div className="field"><label>Date</label>
              <input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} /></div>
            <div className="field"><label>Amount (₹)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="field" style={{ gridColumn: "1 / 3" }}><label>Particulars</label>
              <input value={particulars} onChange={(e) => setParticulars(e.target.value)} /></div>
            <div className="field"><label>Financial year</label>
              <input value={fy} onChange={(e) => setFy(e.target.value)} placeholder="2025-26" /></div>
          </div>

          <div className="section-t">Preview (downloaded as a single-page A4 PDF)</div>
          <div style={{ overflow: "auto", border: "1px solid var(--line)", borderRadius: 10, padding: 12, background: "#f8fafc", maxHeight: 460 }}>
            <div ref={sheetRef} style={{ margin: "0 auto", width: 794 }}>
              <InvoiceSheet client={c} invoice={invoice} qrDataUrl={qr} />
            </div>
          </div>
        </div>

        <div className="modal-f">
          <button className="btn" onClick={save} disabled={busy}>Save only</button>
          <button className="btn primary" onClick={downloadPdf} disabled={busy}>{busy ? "Working…" : "Download PDF"}</button>
        </div>
      </div>
    </div>
  );
}
