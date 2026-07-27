"use client";
import { useState } from "react";
import { SCOPE, ITR_FORMS, DUE_CATEGORIES, ENTITY_TYPES, buildChecklist, isValidPAN } from "../lib/config";

export default function ClientForm({ draft, isNew, onSave, onCancel, notify, consultants = [], staffList = [], allClients = [] }) {
  const [f, setF] = useState({
    name: draft.name || "",
    alias: draft.alias || "",
    group_name: draft.group_name || "",
    entity_type: draft.entity_type || "firm",
    pan: draft.pan || "",
    email: draft.email || "",
    phone: draft.phone || "",
    itr_form: draft.itr_form || "ITR-3",
    consultant: draft.consultant || "Direct Customer",
    due_category: draft.due_category || "oct31",
    it_portal_reg: !!draft.it_portal_reg,
    it_portal_password: draft.it_portal_password || "",
    assigned_staff: draft.assigned_staff || "",
    sources: [...(draft.sources || [])],
    subs: { ...(draft.subs || {}) },
    counts: { ...(draft.counts || {}) },
  });

  const panUp = f.pan.trim().toUpperCase();
  const panInvalid = panUp && !isValidPAN(panUp);
  const panDuplicate = panUp && allClients.some((c) => c.id !== draft.id && (c.pan || "").toUpperCase() === panUp);

  const existingGroups = [...new Set(allClients.map((c) => (c.group_name || "").trim()).filter(Boolean))].sort();

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleSource = (sk, on) =>
    setF((s) => ({ ...s, sources: on ? [...s.sources, sk] : s.sources.filter((x) => x !== sk) }));
  const toggleSub = (key, on) => setF((s) => ({ ...s, subs: { ...s.subs, [key]: on } }));
  const setCount = (key, v) => setF((s) => ({ ...s, counts: { ...s.counts, [key]: Math.max(1, parseInt(v) || 1) } }));

  const save = () => {
    if (!f.name.trim()) { notify("Assessee name is required"); return; }
    const merged = {
      ...draft,
      name: f.name.trim(),
      alias: f.alias.trim() || null,
      group_name: f.group_name.trim() || null,
      entity_type: f.entity_type,
      pan: f.pan.trim().toUpperCase() || null,
      email: f.email.trim() || null,
      phone: f.phone.trim() || null,
      itr_form: f.itr_form,
      consultant: f.consultant,
      due_category: f.due_category,
      it_portal_reg: f.it_portal_reg,
      it_portal_password: f.it_portal_password.trim() || null,
      assigned_staff: f.assigned_staff || null,
      sources: f.sources,
      subs: f.subs,
      counts: f.counts,
    };
    merged.checklist = buildChecklist(f.sources, f.subs, f.counts, draft.checklist, f.entity_type);
    onSave(merged, isNew);
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal">
        <div className="modal-h">
          <h2>{isNew ? "Add Audit Case" : "Edit Audit Case"}</h2>
          <button className="x" onClick={onCancel}>✕</button>
        </div>

        <div className="modal-b">
          <div className="section-t">Onboarding — Primary Details</div>
          <div className="grid2">
            <div className="field"><label>Assessee name (as per PAN) *</label>
              <input value={f.name} placeholder="Official full name" onChange={(e) => set("name", e.target.value)} /></div>
            <div className="field"><label>Alias / familiar name</label>
              <input value={f.alias} placeholder="e.g. KT Wholesale" onChange={(e) => set("alias", e.target.value)} />
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Optional. Searchable alongside the official name.</span>
            </div>
            <div className="field"><label>PAN</label>
              <input value={f.pan} placeholder="ABCDE1234F" style={{ textTransform: "uppercase" }} onChange={(e) => set("pan", e.target.value)} />
              {panInvalid && <span style={{ fontSize: 11, color: "var(--warn)", fontWeight: 600 }}>⚠ Doesn't look like a valid PAN (AAAAA9999A)</span>}
              {panDuplicate && <span style={{ fontSize: 11, color: "var(--bad)", fontWeight: 600 }}>⚠ Another case already has this PAN</span>}
            </div>
            <div className="field"><label>Group / Firm</label>
              <input value={f.group_name} list="group-options" placeholder="e.g. group / family / holding" onChange={(e) => set("group_name", e.target.value)} />
              <datalist id="group-options">{existingGroups.map((g) => <option key={g} value={g} />)}</datalist>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Optional. Links related entities of the same group together.</span>
            </div>
            <div className="field"><label>Entity type</label>
              <select value={f.entity_type} onChange={(e) => set("entity_type", e.target.value)}>
                {ENTITY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Determines the base document checklist (deed/LLP agreement/MOA, etc.).</span>
            </div>
            <div className="field"><label>Email</label>
              <input value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div className="field"><label>Phone</label>
              <input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            <div className="field"><label>ITR form</label>
              <select value={f.itr_form} onChange={(e) => set("itr_form", e.target.value)}>
                {ITR_FORMS.map((x) => <option key={x}>{x}</option>)}
              </select></div>
            <div className="field"><label>ITR due date</label>
              <select value={f.due_category} onChange={(e) => set("due_category", e.target.value)}>
                {DUE_CATEGORIES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select></div>
            <div className="field"><label>Referred by / Consultant</label>
              <select value={f.consultant} onChange={(e) => set("consultant", e.target.value)}>
                {consultants.map((x) => <option key={x.id || x.name} value={x.name}>{x.name}</option>)}
              </select></div>
            <div className="field"><label>IT portal registered?</label>
              <select value={f.it_portal_reg ? "true" : "false"} onChange={(e) => set("it_portal_reg", e.target.value === "true")}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select></div>
            <div className="field"><label>IT portal password</label>
              <input value={f.it_portal_password} placeholder="Password" onChange={(e) => set("it_portal_password", e.target.value)} />
            </div>
            <div className="field"><label>Assigned Staff</label>
              <select value={f.assigned_staff} onChange={(e) => set("assigned_staff", e.target.value)}>
                <option value="">Unassigned</option>
                {staffList && staffList.map((x) => <option key={x.id || x.name} value={x.name}>{x.name}</option>)}
              </select></div>
          </div>

          <div className="section-t">Audit scope → builds the document checklist</div>
          <div className="srcgrid">
            {Object.keys(SCOPE).map((sk) => {
              const s = SCOPE[sk];
              const on = f.sources.includes(sk);
              return (
                <div className={"src " + (on ? "on" : "")} key={sk}>
                  <label className="top">
                    <input type="checkbox" checked={on} onChange={(e) => toggleSource(sk, e.target.checked)} /> {s.label}
                  </label>
                  {s.qty && on && (
                    <div className="qty">
                      {s.qlabel}:
                      <input type="number" min="1" value={f.counts[sk] || 1} onChange={(e) => setCount(sk, e.target.value)} />
                    </div>
                  )}
                  {on && (s.subs || []).map((sub) => {
                    const subOn = !!f.subs[sub.key];
                    return (
                      <div key={sub.key} style={{ marginTop: 6, paddingLeft: 4 }}>
                        <label className="row-flex" style={{ gap: 6, fontSize: 12.5 }}>
                          <input type="checkbox" checked={subOn} onChange={(e) => toggleSub(sub.key, e.target.checked)} /> {sub.label}
                        </label>
                        {sub.qty && subOn && (
                          <div className="qty" style={{ marginTop: 4 }}>
                            {sub.qlabel}:
                            <input type="number" min="1" value={f.counts[sub.key] || 1} onChange={(e) => setCount(sub.key, e.target.value)} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="kv" style={{ marginTop: 8 }}>
            Tick the aspects that apply to this assessee. Bank accounts and related parties add one line per unit.
            The document list is generated automatically; you can add custom items later.
          </div>
        </div>

        <div className="modal-f">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn primary" onClick={save}>{isNew ? "Create Case" : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}
