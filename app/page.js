"use client";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  STAGES, SCOPE, ASSESSMENT_YEAR, DEFAULT_REVIEW_TEMPLATE, ENTITY_TYPES,
  INVOICE_SEQ_START, formatInvoiceNo,
  stageLevel, stageMeta, nextStageKey, everifyInfo, dueInfo, todayISO, uid, gateProblems, feeStatus,
} from "../lib/config";
import { store, getStoreMode } from "../lib/store";
import Board from "../components/Board";
import TableView from "../components/TableView";
import TodayView from "../components/TodayView";
import FeesView from "../components/FeesView";
import Reports from "../components/Reports";
import ClientDetail from "../components/ClientDetail";
import ClientForm from "../components/ClientForm";
import ImportModal from "../components/ImportModal";
import SeniorReviewModal from "../components/SeniorReviewModal";
import ClientConfirmModal from "../components/ClientConfirmModal";
import ReviewTemplateModal from "../components/ReviewTemplateModal";
import InvoiceModal from "../components/InvoiceModal";

const PASSCODE = process.env.NEXT_PUBLIC_APP_PASSCODE || "";

export default function Page() {
  // gate
  const [unlocked, setUnlocked] = useState(!PASSCODE);
  const [code, setCode] = useState("");

  // data
  const [clients, setClients] = useState([]);
  const [consultants, setConsultants] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ui
  const [view, setView] = useState("kanban"); // kanban | table | today | fees | reports
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterFlag, setFilterFlag] = useState("");
  const [filterConsultant, setFilterConsultant] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [filterEntityType, setFilterEntityType] = useState("");
  const [filterAssignedStaff, setFilterAssignedStaff] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState(1);
  const [detailId, setDetailId] = useState(null);
  const [form, setForm] = useState(null); // { draft, isNew }
  const [showImport, setShowImport] = useState(false);
  const [seniorReviewId, setSeniorReviewId] = useState(null);
  const [clientConfirmId, setClientConfirmId] = useState(null);
  const [invoiceId, setInvoiceId] = useState(null);
  const [invoiceSeq, setInvoiceSeq] = useState(INVOICE_SEQ_START);
  const [showTemplate, setShowTemplate] = useState(false);
  const [reviewTemplate, setReviewTemplate] = useState(DEFAULT_REVIEW_TEMPLATE);
  const [mode, setMode] = useState("demo");
  const [toast, setToast] = useState("");
  const [showConsultantsModal, setShowConsultantsModal] = useState(false);
  const [newConsultantName, setNewConsultantName] = useState("");
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");

  const notify = useCallback((m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [data, consData, stData] = await Promise.all([store.list(), store.listConsultants(), store.listStaff()]);
      setClients(data);
      setConsultants(consData);
      setStaffList(stData);
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load data.");
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && PASSCODE && sessionStorage.getItem("audit_unlocked") === "1") {
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    setMode(getStoreMode());
    (async () => {
      setLoading(true);
      await refresh();
      try {
        const tmpl = await store.getSetting("senior_template");
        if (tmpl && tmpl.sections) setReviewTemplate(tmpl);
      } catch { /* keep default */ }
      try {
        const seq = await store.getSetting("invoice_seq");
        if (seq && Number(seq) > 0) setInvoiceSeq(Number(seq));
      } catch { /* keep default */ }
      setLoading(false);
    })();
  }, [unlocked, refresh]);

  // ---- live sync (Supabase Realtime): refetch on any change, debounced ----
  const debounceRef = useRef(null);
  useEffect(() => {
    if (!unlocked) return;
    const unsub = store.subscribe(() => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(refresh, 400);
    });
    return () => { clearTimeout(debounceRef.current); unsub && unsub(); };
  }, [unlocked, refresh]);

  // ---- mutations (optimistic: update screen first, then persist) ----
  const mutate = useCallback(
    async (id, fn) => {
      const c = clients.find((x) => x.id === id);
      if (!c) return;
      const copy = JSON.parse(JSON.stringify(c));
      fn(copy);
      copy.updated_at = new Date().toISOString();
      setClients((list) => list.map((x) => (x.id === id ? copy : x))); // optimistic
      try {
        const saved = await store.upsert(copy);
        if (saved) setClients((list) => list.map((x) => (x.id === id ? saved : x)));
      } catch (e) {
        notify("Save failed: " + (e.message || e));
        refresh(); // roll back to server truth
      }
    },
    [clients, refresh, notify]
  );

  const moveStage = useCallback(
    async (id, target) => {
      const c = clients.find((x) => x.id === id);
      if (!c) return;
      if (c.stage === target) return;
      const fromL = stageLevel(c.stage), toL = stageLevel(target);
      // Forward moves are gated strictly & sequential; lateral (same level) and
      // backward moves are always allowed.
      if (toL > fromL) {
        if (toL > fromL + 1) { notify("Complete the previous stages first (sequential)."); return; }
        const problems = gateProblems(c, target);
        if (problems.length) {
          setDetailId(id);
          notify(`Cannot advance — ${problems[0]}`);
          return;
        }
      }
      await mutate(id, (cc) => {
        cc.stage = target;
        cc.stage_since = new Date().toISOString();
      });
      notify(`${c.name} → ${stageMeta(target).label}`);
    },
    [clients, mutate, notify]
  );

  const advance = useCallback(
    (id) => {
      const c = clients.find((x) => x.id === id);
      if (!c) return;
      const nk = nextStageKey(c.stage);
      if (nk) moveStage(id, nk);
    },
    [clients, moveStage]
  );

  // "Done" from the Today queue: stamp the follow-up and clear the due date.
  const followedUp = useCallback(
    (id) =>
      mutate(id, (cc) => {
        cc.last_followup = new Date().toISOString();
        if (cc.next_followup && cc.next_followup <= todayISO()) cc.next_followup = null;
      }),
    [mutate]
  );

  // A follow-up message was copied (from the Today queue).
  const copiedFollowup = useCallback(
    (id) => mutate(id, (cc) => { cc.last_followup = new Date().toISOString(); }),
    [mutate]
  );

  const openForm = (id) => {
    if (id) {
      const c = clients.find((x) => x.id === id);
      setForm({ draft: c, isNew: false });
    } else {
      setForm({
        draft: {
          id: uid(), name: "", entity_type: "firm", sources: [], subs: {}, counts: {},
          stage: "onboarding", fee_status: "pending", assessment_year: ASSESSMENT_YEAR,
          due_category: "oct31", checklist: [], notes: "",
        },
        isNew: true,
      });
    }
  };

  const saveForm = async (client, isNew) => {
    if (isNew) {
      client.created_at = new Date().toISOString();
      client.stage_since = client.created_at;
    }
    try {
      await store.upsert(client);
      await refresh();
      setForm(null);
      notify(isNew ? "Case created" : "Saved");
      if (!isNew) setDetailId(client.id);
    } catch (e) {
      notify("Save failed: " + (e.message || e));
    }
  };

  const removeClient = async (id) => {
    if (!confirm("Delete this case and all its data?")) return;
    try {
      await store.remove(id);
      await refresh();
      setDetailId(null);
      notify("Case deleted");
    } catch (e) {
      notify("Delete failed: " + (e.message || e));
    }
  };

  // Bulk import: create any new consultants, then insert all cases.
  const doImport = async (newClients, newConsultantNames) => {
    for (const name of newConsultantNames) {
      try { await store.upsertConsultant({ name }); } catch { /* non-fatal */ }
    }
    await store.bulkInsert(newClients);
    await refresh();
    notify(`Imported ${newClients.length} case${newClients.length === 1 ? "" : "s"}`);
  };

  const setSort = (k) => {
    if (sortKey === k) setSortDir((d) => d * -1);
    else { setSortKey(k); setSortDir(1); }
  };

  const handleAddConsultant = async () => {
    if (!newConsultantName.trim()) return;
    try {
      await store.upsertConsultant({ name: newConsultantName.trim() });
      setNewConsultantName("");
      await refresh();
      notify("Consultant added");
    } catch (e) {
      notify("Add failed: " + (e.message || e));
    }
  };

  const handleDeleteConsultant = async (id) => {
    if (!confirm("Remove this consultant?")) return;
    try {
      await store.removeConsultant(id);
      await refresh();
      notify("Consultant removed");
    } catch (e) {
      notify("Delete failed: " + (e.message || e));
    }
  };

  const handleAddStaff = async () => {
    if (!newStaffName.trim()) return;
    try {
      await store.upsertStaff({ name: newStaffName.trim() });
      setNewStaffName("");
      await refresh();
      notify("Staff added");
    } catch (e) {
      notify("Add failed: " + (e.message || e));
    }
  };

  const handleDeleteStaff = async (id) => {
    if (!confirm("Remove this staff member?")) return;
    try {
      await store.removeStaff(id);
      await refresh();
      notify("Staff removed");
    } catch (e) {
      notify("Delete failed: " + (e.message || e));
    }
  };

  // Auditor review checklist: persist answers on the case.
  const saveReview = useCallback(
    (id, review) => mutate(id, (cc) => { cc.review = review; }),
    [mutate]
  );

  // Stamp last_followup when a client-facing document is shared.
  const markShared = useCallback(
    (id) => mutate(id, (cc) => { cc.last_followup = new Date().toISOString(); }),
    [mutate]
  );

  // Persist an invoice on the case. Also nudge billing status to "invoiced"
  // (never downgrading "collected"), seed the fee, and advance the number counter.
  const saveInvoice = useCallback(
    async (id, inv) => {
      const c = clients.find((x) => x.id === id);
      await mutate(id, (cc) => {
        cc.invoice = inv;
        if (feeStatus(cc) === "pending") cc.fee_status = "invoiced";
        if (cc.fee_quoted == null || cc.fee_quoted === "") cc.fee_quoted = inv.amount;
      });
      // Advance the shared serial counter from the number actually used.
      const m = /(\d+)\s*$/.exec(inv.no || "");
      const used = m ? parseInt(m[1], 10) : 0;
      const next = Math.max(invoiceSeq, used + 1);
      if (next !== invoiceSeq || !(c && c.invoice)) {
        setInvoiceSeq(next);
        try { await store.setSetting("invoice_seq", next); } catch { /* non-fatal */ }
      }
    },
    [clients, mutate, invoiceSeq]
  );

  const saveTemplate = async (tmpl) => {
    setReviewTemplate(tmpl);
    setShowTemplate(false);
    try { await store.setSetting("senior_template", tmpl); notify("Template saved"); }
    catch (e) { notify("Template save failed: " + (e.message || e)); }
  };

  const clearFilters = () => { setFilterStage(""); setFilterSource(""); setFilterFlag(""); setFilterConsultant(""); setFilterGroup(""); setFilterEntityType(""); setFilterAssignedStaff(""); };

  const tryUnlock = () => {
    if (code === PASSCODE) {
      sessionStorage.setItem("audit_unlocked", "1");
      setUnlocked(true);
    } else notify("Wrong passcode");
  };

  // ---- derived ----
  const visible = useMemo(() => {
    let list = clients;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.alias || "").toLowerCase().includes(q) ||
        (c.pan || "").toLowerCase().includes(q) ||
        (c.group_name || "").toLowerCase().includes(q));
    }
    if (filterStage) list = list.filter((c) => c.stage === filterStage);
    if (filterConsultant) list = list.filter((c) => (c.consultant || "Direct Customer") === filterConsultant);
    if (filterGroup) list = list.filter((c) => (c.group_name || "") === filterGroup);
    if (filterEntityType) list = list.filter((c) => (c.entity_type || "firm") === filterEntityType);
    if (filterAssignedStaff) list = list.filter((c) => filterAssignedStaff === "unassigned" ? !c.assigned_staff : c.assigned_staff === filterAssignedStaff);
    if (filterSource) list = list.filter((c) => (c.sources || []).includes(filterSource));
    if (filterFlag === "pending") list = list.filter((c) => c.pending_client);
    if (filterFlag === "evdue") list = list.filter((c) => { const e = everifyInfo(c); return e && e.state === "soon"; });
    if (filterFlag === "evover") list = list.filter((c) => { const e = everifyInfo(c); return e && e.state === "overdue"; });
    if (filterFlag === "duesoon") list = list.filter((c) => { const d = dueInfo(c); return d && d.state === "soon"; });
    if (filterFlag === "dueover") list = list.filter((c) => { const d = dueInfo(c); return d && d.state === "overdue"; });
    if (filterFlag === "feedue") list = list.filter((c) => feeStatus(c) !== "collected");
    return list;
  }, [clients, search, filterStage, filterSource, filterFlag, filterConsultant, filterGroup, filterEntityType, filterAssignedStaff]);

  const groups = useMemo(
    () => [...new Set(clients.map((c) => (c.group_name || "").trim()).filter(Boolean))].sort(),
    [clients]
  );

  const stats = useMemo(() => {
    const all = clients;
    const evd = (state) => (c) => { const e = everifyInfo(c); return e && e.state === state; };
    const dued = (state) => (c) => { const d = dueInfo(c); return d && d.state === state; };
    return [
      { n: all.length, l: "Total Cases", cls: "", flag: "" },
      { n: all.filter((c) => c.stage !== "docs_forwarded").length, l: "In Progress", cls: "", flag: "" },
      { n: all.filter((c) => c.pending_client).length, l: "Pending from Client", cls: "warn", flag: "pending" },
      { n: all.filter(dued("soon")).length, l: "Due ≤15d (3CD/ITR)", cls: "warn", flag: "duesoon" },
      { n: all.filter(dued("overdue")).length, l: "Deadline Passed", cls: "bad", flag: "dueover" },
      { n: all.filter(evd("soon")).length, l: "E-verify Due ≤7d", cls: "warn", flag: "evdue" },
      { n: all.filter(evd("overdue")).length, l: "E-verify Overdue", cls: "bad", flag: "evover" },
      { n: all.filter((c) => c.stage === "docs_forwarded").length, l: "Completed", cls: "good", flag: "" },
    ];
  }, [clients]);

  const detailClient = detailId ? clients.find((c) => c.id === detailId) : null;

  // ---- passcode gate ----
  if (!unlocked) {
    return (
      <div className="gate">
        <h1>Audit Case Tracker</h1>
        <p>Enter the team passcode to continue.</p>
        <input
          type="password"
          value={code}
          placeholder="Passcode"
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
        />
        <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={tryUnlock}>
          Unlock
        </button>
      </div>
    );
  }

  return (
    <>
      <header className="app">
        <div className="brand"><div className="logo">AU</div> Audit Tracker</div>
        <span className="ay-pill">AY {ASSESSMENT_YEAR}</span>
        <span
          className={"mode-pill " + (mode === "supabase" ? "live" : "demo")}
          title={mode === "supabase" ? "Connected to Supabase (live sync on)" : "No Supabase env vars set — using local demo data"}
        >
          {mode === "supabase" ? "● Live (Supabase)" : "● Demo (local)"}
        </span>
        <div className="spacer" />
        <div className="search">
          🔎 <input placeholder="Search name, alias, PAN or group…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="toggle">
          <button className={view === "today" ? "active" : ""} onClick={() => setView("today")}>☀ Today</button>
          <button className={view === "kanban" ? "active" : ""} onClick={() => setView("kanban")}>▦ Board</button>
          <button className={view === "table" ? "active" : ""} onClick={() => setView("table")}>≣ Table</button>
          <button className={view === "fees" ? "active" : ""} onClick={() => setView("fees")}>₹ Fees</button>
          <button className={view === "reports" ? "active" : ""} onClick={() => setView("reports")}>📊 Reports</button>
        </div>
        <button className="btn" onClick={() => setShowImport(true)}>⬆ Import</button>
        <button className="btn" onClick={() => setShowConsultantsModal(true)}>Consultants</button>
        <button className="btn" onClick={() => setShowStaffModal(true)}>Staff</button>
        <button className="btn primary" onClick={() => openForm()}>＋ Add Case</button>
      </header>

      <div className="stats">
        {stats.map((s, i) => (
          <div
            key={i}
            className={"stat " + (filterFlag && filterFlag === s.flag ? "s-active" : "")}
            onClick={s.flag ? () => { setFilterFlag(filterFlag === s.flag ? "" : s.flag); if (view === "reports") setView("table"); } : undefined}
            style={{ cursor: s.flag ? "pointer" : "default" }}
          >
            <div className={"n " + (s.n ? s.cls : "")}>{s.n}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </div>

      {view !== "reports" && view !== "fees" && (
        <div className="filters">
          <span className="lbl">Filter:</span>
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)}>
            <option value="">All stages</option>
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
            <option value="">All audit scope</option>
            {Object.keys(SCOPE).map((s) => <option key={s} value={s}>{SCOPE[s].label}</option>)}
          </select>
          <select value={filterFlag} onChange={(e) => setFilterFlag(e.target.value)}>
            <option value="">All cases</option>
            <option value="pending">⏳ Pending from client</option>
            <option value="duesoon">📅 Due ≤15d (3CD/ITR)</option>
            <option value="dueover">⛔ Deadline passed</option>
            <option value="evdue">⚠ E-verify due soon</option>
            <option value="evover">⛔ E-verify overdue</option>
            <option value="feedue">💰 Fee pending</option>
          </select>
          <select value={filterConsultant} onChange={(e) => setFilterConsultant(e.target.value)}>
            <option value="">All referrers</option>
            {consultants.map((s) => <option key={s.id || s.name} value={s.name}>{s.name}</option>)}
          </select>
          {groups.length > 0 && (
            <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
              <option value="">All groups / firms</option>
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
          <select value={filterEntityType} onChange={(e) => setFilterEntityType(e.target.value)}>
            <option value="">All entity types</option>
            {ENTITY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <select value={filterAssignedStaff} onChange={(e) => setFilterAssignedStaff(e.target.value)}>
            <option value="">All staff</option>
            <option value="unassigned">Unassigned</option>
            {staffList.map((s) => <option key={s.id || s.name} value={s.name}>{s.name}</option>)}
          </select>
          <button className="clearf" onClick={clearFilters}>Clear filters</button>
        </div>
      )}

      <main>
        {error && (
          <div className="tablewrap" style={{ marginBottom: 12 }}><div className="empty" style={{ color: "var(--bad)" }}>
            {error}<br />Check your Supabase env vars and that the schema was applied.
          </div></div>
        )}
        {loading ? (
          <div className="center-screen">Loading…</div>
        ) : view === "kanban" ? (
          <Board clients={visible} onOpen={setDetailId} onDropStage={moveStage} />
        ) : view === "table" ? (
          <TableView clients={visible} sortKey={sortKey} sortDir={sortDir} onSort={setSort} onOpen={setDetailId} />
        ) : view === "today" ? (
          <TodayView clients={visible} onOpen={setDetailId} onFollowedUp={followedUp} onCopied={copiedFollowup} notify={notify} />
        ) : view === "fees" ? (
          <FeesView clients={clients} onMutate={mutate} onOpen={setDetailId} onInvoice={setInvoiceId} />
        ) : (
          <Reports clients={clients} notify={notify} />
        )}
      </main>

      {detailClient && (
        <ClientDetail
          client={detailClient}
          onMutate={mutate}
          onMoveStage={moveStage}
          onAdvance={advance}
          onEdit={(id) => { setDetailId(null); openForm(id); }}
          onDelete={removeClient}
          onClose={() => setDetailId(null)}
          notify={notify}
          onSeniorReview={(id) => setSeniorReviewId(id)}
          onClientConfirm={(id) => setClientConfirmId(id)}
        />
      )}

      {seniorReviewId && clients.find((c) => c.id === seniorReviewId) && (
        <SeniorReviewModal
          client={clients.find((c) => c.id === seniorReviewId)}
          template={reviewTemplate}
          onSaveReview={(review) => saveReview(seniorReviewId, review)}
          onEditTemplate={() => setShowTemplate(true)}
          onClose={() => setSeniorReviewId(null)}
          notify={notify}
        />
      )}

      {clientConfirmId && clients.find((c) => c.id === clientConfirmId) && (
        <ClientConfirmModal
          client={clients.find((c) => c.id === clientConfirmId)}
          onShared={() => markShared(clientConfirmId)}
          onClose={() => setClientConfirmId(null)}
          notify={notify}
        />
      )}

      {showTemplate && (
        <ReviewTemplateModal
          template={reviewTemplate}
          onSave={saveTemplate}
          onClose={() => setShowTemplate(false)}
          notify={notify}
        />
      )}

      {invoiceId && clients.find((c) => c.id === invoiceId) && (
        <InvoiceModal
          client={clients.find((c) => c.id === invoiceId)}
          suggestedNo={formatInvoiceNo(invoiceSeq)}
          onSaved={(inv) => saveInvoice(invoiceId, inv)}
          onClose={() => setInvoiceId(null)}
          notify={notify}
        />
      )}

      {form && (
        <ClientForm
          draft={form.draft}
          isNew={form.isNew}
          onSave={saveForm}
          onCancel={() => setForm(null)}
          notify={notify}
          consultants={consultants}
          staffList={staffList}
          allClients={clients}
        />
      )}

      {showImport && (
        <ImportModal
          existing={clients}
          consultants={consultants}
          onImport={doImport}
          onClose={() => setShowImport(false)}
          notify={notify}
        />
      )}

      {showConsultantsModal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowConsultantsModal(false); }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-h">
              <h2>Manage Consultants</h2>
              <button className="x" onClick={() => setShowConsultantsModal(false)}>✕</button>
            </div>
            <div className="modal-b">
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <input
                  value={newConsultantName}
                  onChange={(e) => setNewConsultantName(e.target.value)}
                  placeholder="New consultant name..."
                  style={{ flex: 1 }}
                  onKeyDown={(e) => e.key === "Enter" && handleAddConsultant()}
                />
                <button className="btn primary" onClick={handleAddConsultant}>Add</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {consultants.map(c => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px", background: "var(--bg-elevated)", borderRadius: "4px" }}>
                    <span>{c.name}</span>
                    <button className="btn" style={{ padding: "4px 8px", fontSize: "12px", color: "var(--bad)" }} onClick={() => handleDeleteConsultant(c.id)}>Remove</button>
                  </div>
                ))}
                {consultants.length === 0 && <div className="empty">No consultants found.</div>}
              </div>
            </div>
            <div className="modal-f">
              <button className="btn" onClick={() => setShowConsultantsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showStaffModal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowStaffModal(false); }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-h">
              <h2>Manage Staff</h2>
              <button className="x" onClick={() => setShowStaffModal(false)}>✕</button>
            </div>
            <div className="modal-b">
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <input
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="New staff name..."
                  style={{ flex: 1 }}
                  onKeyDown={(e) => e.key === "Enter" && handleAddStaff()}
                />
                <button className="btn primary" onClick={handleAddStaff}>Add</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {staffList.map(s => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px", background: "var(--bg-elevated)", borderRadius: "4px" }}>
                    <span>{s.name}</span>
                    <button className="btn" style={{ padding: "4px 8px", fontSize: "12px", color: "var(--bad)" }} onClick={() => handleDeleteStaff(s.id)}>Remove</button>
                  </div>
                ))}
                {staffList.length === 0 && <div className="empty">No staff found.</div>}
              </div>
            </div>
            <div className="modal-f">
              <button className="btn" onClick={() => setShowStaffModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className={"toast " + (toast ? "show" : "")}>{toast}</div>
    </>
  );
}
