"use client";
import { useState } from "react";
import { DEFAULT_REVIEW_TEMPLATE, uid } from "../lib/config";

const TYPES = [
  { v: "yn", label: "Yes / No / N-A" },
  { v: "amount", label: "Amount (₹)" },
  { v: "text", label: "Free text" },
  { v: "select", label: "Dropdown" },
];

export default function ReviewTemplateModal({ template, onSave, onClose, notify }) {
  const [t, setT] = useState(() => JSON.parse(JSON.stringify(template || DEFAULT_REVIEW_TEMPLATE)));

  const update = (fn) => setT((prev) => { const copy = JSON.parse(JSON.stringify(prev)); fn(copy); return copy; });

  const save = () => {
    // strip empty items / sections
    const clean = { sections: t.sections
      .map((s) => ({ ...s, items: s.items.filter((it) => it.label.trim()) }))
      .filter((s) => s.title.trim() && s.items.length) };
    if (!clean.sections.length) { notify?.("Template needs at least one item"); return; }
    onSave(clean);
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-h">
          <div>
            <h2>Edit Review Checklist Template</h2>
            <div className="sub">Applies to every case's auditor-review checklist</div>
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="modal-b">
          {t.sections.map((sec, si) => (
            <div key={si} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div className="row-flex" style={{ marginBottom: 8 }}>
                <input
                  value={sec.title}
                  onChange={(e) => update((c) => { c.sections[si].title = e.target.value; })}
                  placeholder="Section title"
                  style={{ flex: 1, fontWeight: 700, padding: "6px 9px", border: "1px solid var(--line)", borderRadius: 7 }}
                />
                <button className="btn ghost sm danger" onClick={() => update((c) => { c.sections.splice(si, 1); })}>Remove section</button>
              </div>

              {sec.items.map((it, ii) => (
                <div key={it.id || ii} className="row-flex" style={{ gap: 6, marginBottom: 6 }}>
                  <input
                    value={it.label}
                    onChange={(e) => update((c) => { c.sections[si].items[ii].label = e.target.value; })}
                    placeholder="Checklist item"
                    style={{ flex: 1, padding: "6px 9px", border: "1px solid var(--line)", borderRadius: 7 }}
                  />
                  <select
                    value={it.type}
                    onChange={(e) => update((c) => { c.sections[si].items[ii].type = e.target.value; })}
                    style={{ padding: "6px 9px", border: "1px solid var(--line)", borderRadius: 7 }}
                  >
                    {TYPES.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
                  </select>
                  <button className="btn ghost sm" onClick={() => update((c) => { c.sections[si].items.splice(ii, 1); })}>✕</button>
                </div>
              ))}
              <button className="btn sm" onClick={() => update((c) => { c.sections[si].items.push({ id: uid(), label: "", type: "yn" }); })}>＋ Add item</button>
            </div>
          ))}

          <div className="row-flex">
            <button className="btn sm" onClick={() => update((c) => { c.sections.push({ key: uid(), title: "New Section", items: [{ id: uid(), label: "", type: "yn" }] }); })}>＋ Add section</button>
            <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={() => { if (confirm("Reset the template to the built-in default?")) setT(JSON.parse(JSON.stringify(DEFAULT_REVIEW_TEMPLATE))); }}>Reset to default</button>
          </div>
        </div>

        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Save template</button>
        </div>
      </div>
    </div>
  );
}
