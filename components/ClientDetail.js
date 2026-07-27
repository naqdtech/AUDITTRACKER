"use client";
import { useState, useEffect } from "react";
import {
  STAGES, DUE_CATEGORIES, AUDIT_FORMS, stageMeta, stageLevel, nextStageKey, prevStageKey,
  everifyInfo, checklistProgress, fmtDate, uid, dueInfo, gateProblems, isValidPAN, entityTypeMeta,
} from "../lib/config";
import { buildFollowupMessage, waLink, copyText } from "../lib/followup";

export default function ClientDetail({ client: c, onMutate, onMoveStage, onAdvance, onEdit, onDelete, onClose, notify, onSeniorReview, onClientConfirm }) {
  const [newCheck, setNewCheck] = useState("");
  const curLevel = stageLevel(c.stage);
  const [selStage, setSelStage] = useState(c.stage);
  // follow the case if its stage changes while open
  useEffect(() => { setSelStage(c.stage); }, [c.stage]);

  const p = checklistProgress(c);
  const ev = everifyInfo(c);
  const due = dueInfo(c);
  const nextKey = nextStageKey(c.stage);
  const prevKey = prevStageKey(c.stage);
  const nextStage = nextKey ? stageMeta(nextKey) : null;
  const problems = nextKey ? gateProblems(c, nextKey) : [];

  const patch = (field, value) =>
    onMutate(c.id, (cc) => { cc[field] = value === "" ? null : value; });

  const copyFollowup = async () => {
    const ok = await copyText(buildFollowupMessage(c));
    onMutate(c.id, (cc) => { cc.last_followup = new Date().toISOString(); });
    if (ok) notify?.("Message copied — paste in WhatsApp");
    else alert("Could not access clipboard — please copy manually:\n\n" + buildFollowupMessage(c));
  };

  const toggleCheck = (itemId, val) =>
    onMutate(c.id, (cc) => {
      const it = cc.checklist.find((x) => x.id === itemId);
      it.done = val;
      if (val) it.nr = false;
    });

  const toggleNR = (itemId) =>
    onMutate(c.id, (cc) => {
      const it = cc.checklist.find((x) => x.id === itemId);
      it.nr = !it.nr;
      if (it.nr) it.done = false;
    });

  const addCheck = () => {
    const v = newCheck.trim(); if (!v) return;
    onMutate(c.id, (cc) => {
      cc.checklist.push({ id: uid(), label: v, group: "Custom", custom: true, done: false, nr: false });
    });
    setNewCheck("");
  };

  const delCheck = (itemId) =>
    onMutate(c.id, (cc) => { cc.checklist = cc.checklist.filter((x) => x.id !== itemId); });

  const selMeta = stageMeta(selStage);
  const selLevel = stageLevel(selStage);

  // ---------- per-stage panels ----------

  const OnboardingPanel = () => (
    <>
      <div className="section-t">Onboarding — Primary Details</div>
      <div className="grid3">
        <ReadField label="PAN" value={c.pan || "—"} warn={c.pan && !isValidPAN(c.pan) ? "invalid format" : ""} />
        <ReadField label="Entity type" value={entityTypeMeta(c.entity_type).label} />
        <ReadField label="Alias / familiar name" value={c.alias || "—"} />
        <ReadField label="Group / Firm" value={c.group_name || "—"} />
        <ReadField label="Email" value={c.email || "—"} />
        <ReadField label="Phone" value={c.phone || "—"} />
        <ReadField label="ITR form" value={c.itr_form || "—"} />
        <ReadField label="IT portal registered" value={c.it_portal_reg ? "Yes" : "No"} />
        <ReadField label="IT portal password" value={c.it_portal_password || "—"} isPassword />
        <ReadField label="Assigned Staff" value={c.assigned_staff || "Unassigned"} />
        <ReadField label="Referred by" value={c.consultant || "Direct Customer"} />
      </div>
      <div className="grid3">
        <div className="field">
          <label>ITR due date</label>
          <select value={c.due_category || "oct31"} onChange={(e) => patch("due_category", e.target.value)}>
            {DUE_CATEGORIES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
        <ReadField label="Audit scope" value={(c.sources || []).length ? `${c.sources.length} aspect(s)` : "none selected"} />
      </div>
      <button className="btn" onClick={() => onEdit(c.id)}>✎ Edit details &amp; audit scope</button>
    </>
  );

  const ChecklistPanel = () => {
    const groups = {};
    (c.checklist || []).forEach((it) => { (groups[it.group] = groups[it.group] || []).push(it); });
    return (
      <>
        <div className="section-t">Books & Documents — {p.d}/{p.t} collected ({p.pct}%)</div>
        <div className="prog" style={{ marginBottom: 12 }}><i style={{ width: p.pct + "%" }} /></div>
        {Object.keys(groups).length === 0 && (
          <div className="kv">No checklist items — set the audit scope in Onboarding first.</div>
        )}
        {Object.keys(groups).map((g) =>
          groups[g].map((it) => (
            <div className={"checkrow " + (it.done ? "done" : "")} key={it.id} style={it.nr ? { opacity: 0.5 } : undefined}>
              <input type="checkbox" checked={!!it.done} disabled={!!it.nr} onChange={(e) => toggleCheck(it.id, e.target.checked)} />
              <span className="lbl" style={it.nr ? { textDecoration: "line-through", color: "var(--muted)" } : undefined}>{it.label}</span>
              {it.nr && <span className="pill flag">N/A</span>}
              <span className="gl">{it.group}</span>
              <button
                className="btn ghost sm"
                title={it.nr ? "Mark as required again" : "Mark as not required for this case"}
                onClick={() => toggleNR(it.id)}
                style={{ color: it.nr ? "var(--accent)" : "var(--muted)" }}
              >
                {it.nr ? "Require" : "N/A"}
              </button>
              {it.custom && <button className="btn ghost sm" onClick={() => delCheck(it.id)}>✕</button>}
            </div>
          ))
        )}
        <div className="check-add">
          <input
            placeholder="Add custom document / item…"
            value={newCheck}
            onChange={(e) => setNewCheck(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCheck()}
          />
          <button className="btn sm" onClick={addCheck}>＋ Add</button>
        </div>
      </>
    );
  };

  const GuidancePanel = ({ text }) => (
    <div className="kv" style={{ background: "var(--chip)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px", lineHeight: 1.6 }}>
      {text}
    </div>
  );

  const AuditorPanel = () => (
    <>
      <GuidancePanel text={<>Fill the <b>audit verification checklist</b> and share it as an image to the auditor / partner along with the finalised financials. Advance once the auditor approves. Record remarks in Notes below.</>} />
      <button className="btn primary sm" style={{ marginTop: 10 }} onClick={() => onSeniorReview?.(c.id)}>
        🖼 Auditor review checklist{c.review?.updated_at ? " (edit)" : ""}
      </button>
    </>
  );

  const ThreeCDPanel = () => (
    <>
      <div className="section-t">Tax Audit Report (Form 3CD)</div>
      <div className="grid3">
        <div className="field">
          <label>Audit report form *</label>
          <select value={c.audit_form || "—"} onChange={(e) => patch("audit_form", e.target.value)}>
            {AUDIT_FORMS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div className="field">
          <label>3CD filing date *</label>
          <input type="date" defaultValue={c.filing_3cd_date || ""} onChange={(e) => patch("filing_3cd_date", e.target.value)} />
        </div>
        <div className="field">
          <label>UDIN</label>
          <input defaultValue={c.udin || ""} placeholder="Auditor UDIN" onBlur={(e) => patch("udin", e.target.value)} />
        </div>
      </div>
      <div className="kv">Upload &amp; accept the 3CD on the IT portal, then record the filing date and UDIN here. The next stage (ITR Filing) needs the 3CD date and audit form.</div>
    </>
  );

  const ITRPanel = () => (
    <>
      <div className="section-t">ITR Filing & Outcome</div>
      <div className="grid3">
        <div className="field">
          <label>ITR filing date *</label>
          <input type="date" defaultValue={c.filing_date || ""} onChange={(e) => patch("filing_date", e.target.value)} />
        </div>
        <div className="field">
          <label>Acknowledgement no. *</label>
          <input defaultValue={c.ack_no || ""} placeholder="ITD ack no." onBlur={(e) => patch("ack_no", e.target.value)} />
        </div>
        <div className="field">
          <label>Outcome</label>
          <select defaultValue={c.outcome_type || "nil"} onChange={(e) => patch("outcome_type", e.target.value)}>
            {["nil", "refund", "payable"].map((o) => (
              <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Amount (₹)</label>
          <input type="number" defaultValue={c.outcome_amount ?? ""} onBlur={(e) => patch("outcome_amount", e.target.value)} />
        </div>
        <div className="field">
          <label>E-verify date</label>
          <input type="date" defaultValue={c.everify_date || ""} onChange={(e) => patch("everify_date", e.target.value)} />
        </div>
        <ReadField label="E-verify status" value={ev ? ev.text : "—"} />
      </div>
      <div className="kv">E-verification must be completed within 30 days of the ITR filing date.</div>
    </>
  );

  const ForwardingPanel = () => (
    <>
      <GuidancePanel text={<>The audit &amp; return are complete. Forward the finalised set — <b>audited financials, Form 3CD, computation and the ITR acknowledgement</b> — to the client. Use the buttons below and Notes to record delivery.</>} />
      <button className="btn primary sm" style={{ marginTop: 10 }} onClick={() => onClientConfirm?.(c.id)}>
        🖼 Forward documents to client
      </button>
    </>
  );

  const panel =
    selStage === "onboarding" ? <OnboardingPanel /> :
    (selStage === "books_cleanup" || selStage === "books_build") ? <ChecklistPanel /> :
    selStage === "verification" ? <GuidancePanel text={<>Verify the finalised books — reconciliations, ledger scrutiny, balances and confirmations. Revisit the <b>Books & Documents</b> list from a books stage above. Advance to Auditor Review once the books are audit-ready.</>} /> :
    selStage === "auditor_review" ? <AuditorPanel /> :
    selStage === "filing_3cd" ? <ThreeCDPanel /> :
    selStage === "filing_itr" ? <ITRPanel /> :
    <ForwardingPanel />;

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-h">
          <div>
            <h2>
              {c.name}{c.alias ? <span style={{ fontWeight: 500, color: "var(--muted)", fontSize: 14 }}> · {c.alias}</span> : null}
              {c.entity_type && <span className="pill flag" style={{ marginLeft: 8, verticalAlign: "middle" }}>{entityTypeMeta(c.entity_type).label}</span>}
            </h2>
            <div className="sub">
              {c.pan || "PAN —"} · {c.itr_form || "ITR —"} {c.audit_form && c.audit_form !== "—" ? "· " + c.audit_form : ""} {c.email ? "· " + c.email : ""} {c.phone ? "· " + c.phone : ""} {c.group_name ? "· " + c.group_name : ""} {c.consultant && c.consultant !== "Direct Customer" ? "· Ref: " + c.consultant : ""}
            </div>
          </div>
          <button className="btn sm" onClick={() => onEdit(c.id)}>✎ Edit</button>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="modal-b">
          {/* stepper — click a stage to view/edit its fields */}
          <div className="stepper">
            {STAGES.map((s) => {
              const done = s.level < curLevel;
              const current = s.key === c.stage;
              return (
                <div
                  key={s.key}
                  className={"step " + (done ? "done " : "") + (current ? "current " : "")}
                  onClick={() => setSelStage(s.key)}
                  style={{
                    cursor: "pointer",
                    ...(current ? { background: s.color } : {}),
                    ...(s.key === selStage ? { outline: "2px solid " + s.color, outlineOffset: -1 } : {}),
                  }}
                  title={"Show " + s.label + " fields"}
                >
                  {s.label}
                </div>
              );
            })}
          </div>

          {/* actions */}
          <div className="row-flex" style={{ marginBottom: 6 }}>
            {nextStage ? (
              <button
                className="btn primary sm"
                onClick={() => onAdvance(c.id)}
                disabled={problems.length > 0}
                style={problems.length ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
              >
                Advance → {nextStage.label}
              </button>
            ) : (
              <span className="pill good">✓ Completed</span>
            )}
            {prevKey && (
              <button className="btn sm" onClick={() => onMoveStage(c.id, prevKey)}>← Back</button>
            )}
            {due && <span className={"pill " + due.pill}>{due.text}</span>}
            {ev && <span className={"pill " + ev.pill}>{ev.text}</span>}
            <label className="row-flex" style={{ gap: 7, marginLeft: "auto", fontSize: 12, fontWeight: 600 }}>
              <span className="switch">
                <input
                  type="checkbox"
                  checked={!!c.pending_client}
                  onChange={(e) => onMutate(c.id, (cc) => { cc.pending_client = e.target.checked; })}
                />
                <span className="slider" />
              </span>
              Pending from client
            </label>
          </div>

          {/* gate problems — exactly what blocks the next stage */}
          {problems.length > 0 && nextStage && (
            <div style={{ background: "var(--warn-bg)", border: "1px solid #f3d9a4", borderRadius: 8, padding: "9px 12px", marginBottom: 10 }}>
              <b style={{ fontSize: 12, color: "var(--warn)" }}>To advance to {nextStage.label}:</b>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--warn)" }}>
                {problems.map((pr, i) => <li key={i}>{pr}</li>)}
              </ul>
            </div>
          )}

          {/* follow-up drafts */}
          <div className="row-flex" style={{ marginBottom: 14, gap: 7 }}>
            <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Follow-up:</span>
            <button className="btn sm" onClick={copyFollowup} title="Copy follow-up message">📋 Copy message</button>
            {waLink(c) && (
              <a className="btn sm" href={waLink(c)} target="_blank" rel="noreferrer" title="Open WhatsApp chat with message pre-filled">💬 WhatsApp</a>
            )}
            {c.last_followup && <span className="kv">last: {fmtDate(c.last_followup.slice(0, 10))}</span>}
            <span style={{ marginLeft: "auto" }} />
            <div className="field" style={{ margin: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 12 }}>Next follow-up</label>
              <input type="date" defaultValue={c.next_followup || ""} onChange={(e) => patch("next_followup", e.target.value)} style={{ width: 150 }} />
            </div>
          </div>

          {/* stage panel */}
          <div style={{ borderLeft: "3px solid " + selMeta.color, paddingLeft: 14, marginBottom: 4, minHeight: 120 }}>
            {selStage !== c.stage && (
              <div className="kv" style={{ marginBottom: 8 }}>
                Viewing <b>{selMeta.label}</b> {selLevel < curLevel ? "(completed stage — editable for corrections)" : "(upcoming stage)"} · case is currently in <b>{stageMeta(c.stage).label}</b>
              </div>
            )}
            {panel}
          </div>

          {/* notes */}
          <div className="section-t">Notes</div>
          <textarea
            defaultValue={c.notes || ""}
            placeholder="Anything worth remembering about this case — approvals, queries, special items…"
            style={{ width: "100%", minHeight: 90, padding: 10, border: "1px solid var(--line)", borderRadius: 8 }}
            onBlur={(e) => patch("notes", e.target.value)}
          />
          <div className="kv" style={{ marginTop: 4 }}>Saved automatically when you click away.</div>
        </div>

        <div className="modal-f">
          <button className="btn danger" onClick={() => onDelete(c.id)}>Delete</button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function ReadField({ label, value, warn, isPassword }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label>{label}</label>
      {isPassword && value !== "—" ? (
        <div style={{ display: "flex", gap: "8px" }}>
          <input disabled value={show ? value : "••••••••"} style={{ flex: 1, fontFamily: show ? "inherit" : "monospace" }} />
          <button className="btn sm" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
          <button className="btn sm" onClick={() => { navigator.clipboard.writeText(value); alert("Password copied!"); }}>Copy</button>
        </div>
      ) : (
        <input disabled value={value} />
      )}
      {warn && <span style={{ fontSize: 11, color: "var(--warn)", fontWeight: 600 }}>⚠ {warn}</span>}
    </div>
  );
}
