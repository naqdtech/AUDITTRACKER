"use client";
import { useRef, useState } from "react";
import { ClientConfirmSheet } from "./sheets";
import { downloadNodePng, copyNodePng } from "../lib/imageExport";
import { buildClientConfirmMessage, clientConfirmWaLink } from "../lib/clientDoc";
import { copyText } from "../lib/followup";

export default function ClientConfirmModal({ client: c, onClose, notify, onShared }) {
  const [busy, setBusy] = useState(false);
  const sheetRef = useRef(null);

  const download = async () => {
    setBusy(true);
    try {
      await downloadNodePng(sheetRef.current, `Documents-forwarded-${(c.name || "case").replace(/\s+/g, "-")}`);
      onShared?.();
    } catch (e) { notify?.("Image failed: " + (e.message || e)); }
    setBusy(false);
  };
  const copyImg = async () => {
    setBusy(true);
    const ok = await copyNodePng(sheetRef.current);
    if (ok) { onShared?.(); notify?.("Image copied — paste into WhatsApp"); }
    else notify?.("Copy blocked by browser — use Download instead");
    setBusy(false);
  };
  const copyMsg = async () => {
    const ok = await copyText(buildClientConfirmMessage(c));
    onShared?.();
    notify?.(ok ? "Message copied" : "Clipboard blocked");
  };
  const wa = clientConfirmWaLink(c);

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-h">
          <div>
            <h2>Forward Documents</h2>
            <div className="sub">{c.name} · {c.pan || "PAN —"}</div>
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="modal-b">
          <div className="kv" style={{ marginBottom: 12 }}>
            Hands the completed set back to the client — audited financials, Form 3CD, computation and the ITR
            acknowledgement. Send the <b>cover image</b> and a <b>WhatsApp message</b> listing the enclosures.
          </div>

          <div className="row-flex" style={{ marginBottom: 14, gap: 7 }}>
            <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>WhatsApp text:</span>
            <button className="btn sm" onClick={copyMsg}>📋 Copy message</button>
            {wa && <a className="btn sm" href={wa} target="_blank" rel="noreferrer">💬 Open chat</a>}
          </div>

          <div className="section-t">Preview (cover sheet shared with the client)</div>
          <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 10, padding: 12, background: "#f8fafc" }}>
            <div ref={sheetRef} style={{ margin: "0 auto", width: 640 }}>
              <ClientConfirmSheet client={c} />
            </div>
          </div>
        </div>

        <div className="modal-f">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn" onClick={copyImg} disabled={busy}>Copy image</button>
          <button className="btn primary" onClick={download} disabled={busy}>{busy ? "Working…" : "Download image"}</button>
        </div>
      </div>
    </div>
  );
}
