"use client";
import { useMemo, useState } from "react";
import { ITR_FORMS, DUE_CATEGORIES, ENTITY_TYPES, buildChecklist, isValidPAN, uid, ASSESSMENT_YEAR } from "../lib/config";

// Normalise a free-text "entity type" column value to an ENTITY_TYPES key.
function guessEntityType(v) {
  const s = (v || "").toLowerCase().trim();
  if (!s) return "individual";
  const hit = ENTITY_TYPES.find((t) => t.key === s || t.label.toLowerCase().includes(s) || s.includes(t.key));
  return hit ? hit.key : "individual";
}
import { parseDelimited } from "../lib/csv";

// Fields a column can map to.
const FIELDS = [
  { key: "name",       label: "Name *" },
  { key: "alias",      label: "Alias / familiar name" },
  { key: "pan",        label: "PAN" },
  { key: "phone",      label: "Phone" },
  { key: "email",      label: "Email" },
  { key: "group_name", label: "Group / Firm" },
  { key: "entity_type", label: "Entity type (Individual/Firm/LLP/Company)" },
  { key: "consultant", label: "Consultant / Referred by" },
  { key: "itr_form",   label: "ITR form" },
  { key: "",           label: "— Ignore —" },
];

// Guess a field from a header cell.
function guessField(h) {
  const s = (h || "").toLowerCase();
  if (/alias|nick|familiar/.test(s)) return "alias";
  if (/entity|type|category/.test(s)) return "entity_type";
  if (/group|firm|company|employer/.test(s)) return "group_name";
  if (/name|client/.test(s)) return "name";
  if (/pan/.test(s)) return "pan";
  if (/phone|mobile|contact|whatsapp/.test(s)) return "phone";
  if (/mail/.test(s)) return "email";
  if (/consult|refer|agent/.test(s)) return "consultant";
  if (/itr|form/.test(s)) return "itr_form";
  return "";
}

function looksLikeHeader(row) {
  return row.some((cell) => guessField(cell) !== "");
}

export default function ImportModal({ existing, consultants, onImport, onClose, notify }) {
  const [text, setText] = useState("");
  const [dueCategory, setDueCategory] = useState("oct31");
  const [mapping, setMapping] = useState(null); // per-column field keys
  const [busy, setBusy] = useState(false);

  const matrix = useMemo(() => parseDelimited(text), [text]);
  const hasHeader = matrix.length > 0 && looksLikeHeader(matrix[0]);
  const dataRows = hasHeader ? matrix.slice(1) : matrix;
  const nCols = matrix.length ? Math.max(...matrix.map((r) => r.length)) : 0;

  // Column mapping: user-set, else guessed from header, else positional default.
  const cols = useMemo(() => {
    if (mapping && mapping.length === nCols) return mapping;
    const defaults = ["name", "pan", "phone", "email", "consultant", "itr_form"];
    return Array.from({ length: nCols }, (_, i) =>
      hasHeader ? guessField(matrix[0][i]) : defaults[i] || ""
    );
  }, [mapping, nCols, hasHeader, matrix]);

  const setCol = (i, v) => {
    const next = [...cols];
    next[i] = v;
    setMapping(next);
  };

  // Build candidate rows with validation status.
  const candidates = useMemo(() => {
    const existingPans = new Set(existing.map((c) => (c.pan || "").toUpperCase()).filter(Boolean));
    const seenPans = new Set();
    const nameIdx = cols.indexOf("name");
    return dataRows.map((row) => {
      const rec = {};
      cols.forEach((f, i) => { if (f) rec[f] = (row[i] || "").trim(); });
      rec.pan = (rec.pan || "").toUpperCase();
      const problems = [];
      let skip = false;
      if (nameIdx < 0 || !rec.name) { problems.push("No name"); skip = true; }
      if (rec.pan) {
        if (!isValidPAN(rec.pan)) problems.push("Invalid PAN");
        if (existingPans.has(rec.pan)) { problems.push("Already exists (PAN)"); skip = true; }
        else if (seenPans.has(rec.pan)) { problems.push("Duplicate in sheet"); skip = true; }
        else seenPans.add(rec.pan);
      }
      if (rec.itr_form && !ITR_FORMS.includes(rec.itr_form.toUpperCase())) rec.itr_form = "";
      return { rec, problems, skip };
    });
  }, [dataRows, cols, existing]);

  const importable = candidates.filter((c) => !c.skip);

  const doImport = async () => {
    if (!importable.length) { notify("Nothing to import."); return; }
    setBusy(true);
    const knownConsultants = new Set(consultants.map((x) => x.name.toLowerCase()));
    const newConsultants = new Set();
    const now = new Date().toISOString();
    const clients = importable.map(({ rec }) => {
      const consultant = rec.consultant || "Direct Customer";
      if (consultant && !knownConsultants.has(consultant.toLowerCase())) newConsultants.add(consultant);
      const entity_type = guessEntityType(rec.entity_type);
      return {
        id: uid(),
        name: rec.name,
        alias: rec.alias || null,
        group_name: rec.group_name || null,
        entity_type,
        pan: rec.pan || null,
        phone: rec.phone || null,
        email: rec.email || null,
        consultant,
        itr_form: rec.itr_form ? rec.itr_form.toUpperCase() : "—",
        due_category: dueCategory,
        assessment_year: ASSESSMENT_YEAR,
        stage: "onboarding",
        sources: [],
        subs: {},
        counts: {},
        fee_status: "pending",
        pending_client: false,
        checklist: buildChecklist([], {}, {}, undefined, entity_type),
        notes: "",
        created_at: now,
        stage_since: now,
      };
    });
    try {
      await onImport(clients, [...newConsultants]);
      onClose();
    } catch (e) {
      notify("Import failed: " + (e.message || e));
    }
    setBusy(false);
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-h">
          <h2>Bulk Import Cases</h2>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="modal-b">
          <div className="kv" style={{ marginBottom: 10 }}>
            Copy rows from Excel (or a CSV) and paste below — columns like <b>Name, PAN, Phone, Email,
            Consultant, ITR form</b>. Only basic details are imported; audit scope &amp; documents are set
            per case afterwards. You can also{" "}
            <label style={{ color: "var(--accent)", fontWeight: 600, cursor: "pointer" }}>
              choose a CSV file
              <input
                type="file" accept=".csv,.txt,.tsv" style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setText(String(reader.result || ""));
                  reader.readAsText(file);
                }}
              />
            </label>.
          </div>

          <textarea
            style={{ width: "100%", minHeight: 120, padding: 10, border: "1px solid var(--line)", borderRadius: 8, fontFamily: "ui-monospace,monospace", fontSize: 12 }}
            placeholder={"Name\tPAN\tPhone\tEmail\nRahul Sharma\tABCPS1234K\t9876543210\trahul@gmail.com"}
            value={text}
            onChange={(e) => { setText(e.target.value); setMapping(null); }}
          />

          <div className="row-flex" style={{ marginTop: 10 }}>
            <span className="lbl" style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>ITR due date for all imported cases:</span>
            <select value={dueCategory} onChange={(e) => setDueCategory(e.target.value)} style={{ padding: "6px 9px", border: "1px solid var(--line)", borderRadius: 8 }}>
              {DUE_CATEGORIES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>

          {matrix.length > 0 && (
            <>
              <div className="section-t">Preview — {importable.length} of {dataRows.length} rows will be imported</div>
              <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "6px 8px" }}></th>
                      {cols.map((f, i) => (
                        <th key={i} style={{ padding: "6px 8px" }}>
                          <select value={f} onChange={(e) => setCol(i, e.target.value)} style={{ padding: "4px 6px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 11 }}>
                            {FIELDS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.slice(0, 50).map((cand, ri) => (
                      <tr key={ri} style={cand.skip ? { opacity: 0.45 } : undefined}>
                        <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                          {cand.skip
                            ? <span className="pill bad">skip: {cand.problems.join(", ")}</span>
                            : cand.problems.length
                              ? <span className="pill warn">{cand.problems.join(", ")}</span>
                              : <span className="pill good">ok</span>}
                        </td>
                        {cols.map((_, ci) => (
                          <td key={ci} style={{ padding: "5px 8px" }}>{dataRows[ri]?.[ci] || ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {candidates.length > 50 && <div className="kv" style={{ marginTop: 6 }}>…and {candidates.length - 50} more rows (all will be processed).</div>}
            </>
          )}
        </div>

        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={doImport} disabled={busy || !importable.length}>
            {busy ? "Importing…" : `Import ${importable.length} client${importable.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
