"use client";
import { STAGES, SCOPE, stageIndex, stageMeta, everifyInfo, checklistProgress, fmtDate, dueInfo, dueCategoryMeta, entityTypeMeta } from "../lib/config";

export default function TableView({ clients, sortKey, sortDir, onSort, onOpen }) {
  const list = [...clients].sort((a, b) => {
    let va, vb;
    if (sortKey === "stage") { va = stageIndex(a.stage); vb = stageIndex(b.stage); }
    else if (sortKey === "progress") { va = checklistProgress(a).pct; vb = checklistProgress(b).pct; }
    else { va = (a[sortKey] || "").toString().toLowerCase(); vb = (b[sortKey] || "").toString().toLowerCase(); }
    return va < vb ? -sortDir : va > vb ? sortDir : 0;
  });

  const Th = ({ k, children }) => (
    <th onClick={() => onSort(k)}>
      {children} {sortKey === k ? (sortDir > 0 ? "▲" : "▼") : ""}
    </th>
  );

  if (!list.length) {
    return <div className="tablewrap"><div className="empty">No clients match your filters.</div></div>;
  }

  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <Th k="name">Assessee</Th>
            <Th k="sources">Scope</Th>
            <Th k="stage">Stage</Th>
            <Th k="progress">Docs</Th>
            <Th k="due_category">Due</Th>
            <Th k="filing_date">ITR filed</Th>
            <th>E-Verify</th>
          </tr>
        </thead>
        <tbody>
          {list.map((c) => {
            const p = checklistProgress(c);
            const ev = everifyInfo(c);
            const due = dueInfo(c);
            const sm = stageMeta(c.stage);
            return (
              <tr key={c.id} onClick={() => onOpen(c.id)}>
                <td>
                  <b>{c.name}</b>{c.alias ? <span style={{ color: "var(--muted)", fontWeight: 500 }}> · {c.alias}</span> : null}
                  {c.entity_type && <span className="pill flag" style={{ marginLeft: 5 }}>{entityTypeMeta(c.entity_type).label}</span>}
                  {c.pending_client && <span className="pill flag"> ⏳</span>}
                  <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "ui-monospace,monospace" }}>
                    {c.pan || ""}{c.group_name ? ` · 👥 ${c.group_name}` : ""}
                  </div>
                </td>
                <td>{(c.sources || []).map((s) => SCOPE[s]?.label.split(" ")[0]).filter(Boolean).join(" ") || "—"}</td>
                <td><span className="stage-badge" style={{ background: sm.color }}>{sm.label}</span></td>
                <td>
                  <div className="prog" style={{ width: 70, display: "inline-block", verticalAlign: "middle" }}>
                    <i style={{ width: p.pct + "%" }} />
                  </div>{" "}
                  <span className="prog-num">{p.d}/{p.t}</span>
                </td>
                <td>
                  {due ? (
                    <span className={"pill " + due.pill}>{due.state === "ok" ? dueCategoryMeta(c.due_category).label : due.text}</span>
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{dueCategoryMeta(c.due_category).label}</span>
                  )}
                </td>
                <td>{c.filing_date ? fmtDate(c.filing_date) : "—"}</td>
                <td>{ev ? <span className={"pill " + ev.pill}>{ev.text}</span> : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
