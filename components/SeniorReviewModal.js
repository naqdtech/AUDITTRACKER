"use client";
import { useRef, useState } from "react";
import { SeniorReviewSheet } from "./sheets";
import { downloadNodePng, copyNodePng } from "../lib/imageExport";

const YN = [
  { v: "yes", label: "Yes" },
  { v: "no", label: "No" },
  { v: "na", label: "N/A" },
];

export default function SeniorReviewModal({ client: c, template, onSaveReview, onClose, notify, onEditTemplate }) {
  const [answers, setAnswers] = useState({ ...(c.review?.answers || {}) });
  const [preparedBy, setPreparedBy] = useState(c.review?.prepared_by || "");
  const [remarks, setRemarks] = useState(c.review?.remarks || "");
  const [busy, setBusy] = useState(false);
  const sheetRef = useRef(null);

  const review = { answers, prepared_by: preparedBy, remarks, updated_at: new Date().toISOString() };
  const set = (id, v) => setAnswers((a) => ({ ...a, [id]: v }));

  const save = () => { onSaveReview(review); notify?.("Review saved"); };

  const download = async () => {
    setBusy(true);
    try {
      await downloadNodePng(sheetRef.current, `Audit-checklist-${(c.name || "case").replace(/\s+/g, "-")}`);
      onSaveReview(review);
    } catch (e) { notify?.("Image failed: " + (e.message || e)); }
    setBusy(false);
  };
  const copyImg = async () => {
    setBusy(true);
    const ok = await copyNodePng(sheetRef.current);
    if (ok) { onSaveReview(review); notify?.("Image copied — paste into WhatsApp"); }
    else notify?.("Copy blocked by browser — use Download instead");
    setBusy(false);
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-h">
          <div>
            <h2>Auditor Review Checklist</h2>
            <div className="sub">{c.name} · {c.pan || "PAN —"}</div>
          </div>
          <button className="btn sm" onClick={onEditTemplate} title="Edit the checklist items">Edit template</button>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="modal-b">
          {(template?.sections || []).map((sec) => (
            <div key={sec.key} style={{ marginBottom: 14 }}>
              <div className="section-t">{sec.title}</div>
              {sec.items.map((item) => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: "1px solid var(--line2)" }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{item.label}</span>
                  {item.type === "yn" && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {YN.map((o) => (
                        <button
                          key={o.v}
                          className="btn sm"
                          onClick={() => set(item.id, answers[item.id] === o.v ? "" : o.v)}
                          style={answers[item.id] === o.v
                            ? { background: o.v === "yes" ? "var(--good)" : o.v === "no" ? "var(--bad)" : "var(--muted)", color: "#fff", borderColor: "transparent" }
                            : undefined}
                        >{o.label}</button>
                      ))}
                    </div>
                  )}
                  {item.type === "amount" && (
                    <input type="number" placeholder="₹" value={answers[item.id] || ""} onChange={(e) => set(item.id, e.target.value)}
                      style={{ width: 140, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 7, textAlign: "right" }} />
                  )}
                  {item.type === "text" && (
                    <input value={answers[item.id] || ""} onChange={(e) => set(item.id, e.target.value)}
                      style={{ width: 180, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 7 }} />
                  )}
                  {item.type === "select" && (
                    <select value={answers[item.id] || ""} onChange={(e) => set(item.id, e.target.value)}
                      style={{ padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 7 }}>
                      <option value="">—</option>
                      {(item.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          ))}

          <div className="grid2" style={{ marginTop: 6 }}>
            <div className="field"><label>Prepared by</label>
              <input value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} placeholder="Staff name" /></div>
            <div className="field"><label>Remarks</label>
              <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Any notes for the approver" /></div>
          </div>

          <div className="section-t">Preview (this image is shared to the auditor)</div>
          <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 10, padding: 12, background: "#f8fafc" }}>
            <div ref={sheetRef} style={{ margin: "0 auto", width: 640 }}>
              <SeniorReviewSheet client={c} template={template} review={review} />
            </div>
          </div>
        </div>

        <div className="modal-f">
          <button className="btn" onClick={save} disabled={busy}>Save only</button>
          <button className="btn" onClick={copyImg} disabled={busy}>Copy image</button>
          <button className="btn primary" onClick={download} disabled={busy}>{busy ? "Working…" : "Download image"}</button>
        </div>
      </div>
    </div>
  );
}
