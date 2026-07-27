"use client";
import { FIRM_NAME, fmtDate, fmtMoney, scopeSummary, entityTypeMeta } from "../lib/config";
import { forwardedDocs } from "../lib/clientDoc";

// Shared palette (explicit hex — these render into a PNG, so no CSS vars).
const C = {
  ink: "#18181b", muted: "#6b7280", faint: "#9ca3af", line: "#e5e7eb",
  green: "#047857", red: "#dc2626", amber: "#b45309", bg: "#ffffff", head: "#111827",
};

function ynDisplay(v) {
  if (v === "yes") return { t: "YES", c: C.green };
  if (v === "no") return { t: "NO", c: C.red };
  if (v === "na") return { t: "N/A", c: C.faint };
  return { t: "—", c: C.faint };
}

function itemValue(item, v) {
  if (item.type === "yn") { const d = ynDisplay(v); return <b style={{ color: d.c }}>{d.t}</b>; }
  if (item.type === "amount") return <span style={{ fontVariantNumeric: "tabular-nums" }}>{v ? fmtMoney(v) : "—"}</span>;
  return <span>{v || "—"}</span>;
}

// ---------------- Auditor verification checklist ----------------
export function SeniorReviewSheet({ client: c, template, review }) {
  const answers = review?.answers || {};
  const ay = c.assessment_year || "";
  return (
    <div style={{ width: 640, background: C.bg, color: C.ink, fontFamily: "Inter, Arial, sans-serif", fontSize: 13, padding: 28, boxSizing: "border-box" }}>
      <div style={{ borderBottom: `2px solid ${C.head}`, paddingBottom: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em" }}>AUDIT VERIFICATION CHECKLIST</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{FIRM_NAME} · Tax Audit · AY {ay}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12.5, marginBottom: 14 }}>
        <div><span style={{ color: C.muted }}>Assessee:&nbsp;</span><b>{c.name}</b>{c.alias ? ` (${c.alias})` : ""}</div>
        <div><span style={{ color: C.muted }}>PAN:&nbsp;</span><b style={{ fontFamily: "monospace" }}>{c.pan || "—"}</b></div>
        <div><span style={{ color: C.muted }}>Entity:&nbsp;</span><b>{entityTypeMeta(c.entity_type).label.replace(/^\S+\s/, "")}</b></div>
        <div><span style={{ color: C.muted }}>ITR form:&nbsp;</span><b>{c.itr_form || "—"}</b></div>
      </div>

      {(template?.sections || []).map((sec) => (
        <div key={sec.key} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: C.head, borderBottom: `1px solid ${C.line}`, paddingBottom: 4, marginBottom: 4 }}>
            {sec.title}
          </div>
          {sec.items.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "3px 0", borderBottom: `1px solid #f3f4f6` }}>
              <span style={{ color: C.ink }}>{item.label}</span>
              <span style={{ textAlign: "right", minWidth: 120 }}>{itemValue(item, answers[item.id])}</span>
            </div>
          ))}
        </div>
      ))}

      {review?.remarks ? (
        <div style={{ marginTop: 10, fontSize: 12.5 }}>
          <span style={{ color: C.muted, fontWeight: 700 }}>Remarks: </span>{review.remarks}
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, fontSize: 12.5 }}>
        <div><span style={{ color: C.muted }}>Prepared by:</span> <b>{review?.prepared_by || "—"}</b></div>
        <div><span style={{ color: C.muted }}>Reviewed by (Auditor):</span> ________________</div>
      </div>
      <div style={{ marginTop: 10, fontSize: 10.5, color: C.faint, textAlign: "right" }}>Generated {fmtDate(new Date().toISOString().slice(0, 10))}</div>
    </div>
  );
}

// ---------------- Documents forwarding cover sheet ----------------
export function ClientConfirmSheet({ client: c }) {
  const ay = c.assessment_year || "";
  const scope = scopeSummary(c);
  const docs = forwardedDocs(c);
  return (
    <div style={{ width: 640, background: C.bg, color: C.ink, fontFamily: "Inter, Arial, sans-serif", fontSize: 13, padding: 28, boxSizing: "border-box" }}>
      <div style={{ borderBottom: `2px solid ${C.head}`, paddingBottom: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>DOCUMENTS FORWARDED</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{FIRM_NAME} · Tax Audit &amp; ITR · AY {ay}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12.5, marginBottom: 14 }}>
        <div><span style={{ color: C.muted }}>Assessee:&nbsp;</span><b>{c.name}</b>{c.alias ? ` (${c.alias})` : ""}</div>
        <div><span style={{ color: C.muted }}>PAN:&nbsp;</span><b style={{ fontFamily: "monospace" }}>{c.pan || "—"}</b></div>
        <div><span style={{ color: C.muted }}>Audit form:&nbsp;</span><b>{c.audit_form && c.audit_form !== "—" ? c.audit_form : "3CD"}</b></div>
        <div><span style={{ color: C.muted }}>ITR Ack:&nbsp;</span><b style={{ fontFamily: "monospace" }}>{c.ack_no || "—"}</b></div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: C.head, borderBottom: `1px solid ${C.line}`, paddingBottom: 4, marginBottom: 6 }}>
        Documents enclosed
      </div>
      {docs.length ? docs.map((l, i) => (
        <div key={i} style={{ padding: "3px 0", fontSize: 12.5 }}>✓ {l}</div>
      )) : <div style={{ color: C.faint, padding: "3px 0" }}>—</div>}

      {scope.length ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: C.head, borderBottom: `1px solid ${C.line}`, paddingBottom: 4, margin: "14px 0 6px" }}>
            Audit scope covered
          </div>
          <div style={{ columns: 2, fontSize: 12 }}>
            {scope.map((l, i) => <div key={i} style={{ padding: "2px 0", breakInside: "avoid" }}>• {l}</div>)}
          </div>
        </>
      ) : null}

      <div style={{ marginTop: 16, padding: 12, border: `1px solid ${C.line}`, borderRadius: 8, background: "#fafafa", fontSize: 12.5, lineHeight: 1.6 }}>
        The above documents for AY {ay} have been completed and are handed over for your records. Kindly retain
        them safely; they may be required for banking, loan, or assessment purposes.
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, fontSize: 12.5 }}>
        <div><span style={{ color: C.muted }}>Filed on:</span> <b>{c.filing_date ? fmtDate(c.filing_date) : "—"}</b></div>
        <div><span style={{ color: C.muted }}>For:</span> {FIRM_NAME}</div>
      </div>
      <div style={{ marginTop: 8, fontSize: 10.5, color: C.faint, textAlign: "right" }}>Forwarded {fmtDate(new Date().toISOString().slice(0, 10))}</div>
    </div>
  );
}
