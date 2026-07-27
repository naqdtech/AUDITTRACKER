"use client";
import { useRef } from "react";
import { STAGES, SCOPE, everifyInfo, checklistProgress, dueInfo, daysInStage, entityTypeMeta } from "../lib/config";

function tagText(sk) {
  const parts = (SCOPE[sk]?.label || sk).split(" ");
  return parts[0] + " " + parts.slice(1).join(" ");
}

function Card({ c, onClick, onDragStart }) {
  const p = checklistProgress(c);
  const ev = everifyInfo(c);
  const due = dueInfo(c);
  const age = daysInStage(c);
  const srcs = c.sources || [];
  return (
    <div className="card" draggable onDragStart={onDragStart} onClick={onClick}>
      <div className="nm">{c.name}{c.entity_type && <span title={entityTypeMeta(c.entity_type).label} style={{ fontSize: 12 }}>{entityTypeMeta(c.entity_type).label.split(" ")[0]}</span>}</div>
      {c.alias && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{c.alias}</div>}
      <div className="pan">{c.pan || "PAN —"}</div>
      <div className="tags">
        {c.group_name && <span className="tag" title="Group / Firm">👥 {c.group_name}</span>}
        {srcs.slice(0, 3).map((s) => (
          <span className="tag" key={s}>{tagText(s)}</span>
        ))}
        {srcs.length > 3 && <span className="tag">+{srcs.length - 3}</span>}
      </div>
      <div className="meta">
        <div className="prog"><i style={{ width: p.pct + "%" }} /></div>
        <span className="prog-num">{p.d}/{p.t}</span>
      </div>
      <div className="meta">
        {c.pending_client && <span className="pill flag">⏳ Client</span>}
        {ev && <span className={"pill " + ev.pill}>{ev.text}</span>}
        {due && due.state !== "ok" && <span className={"pill " + due.pill}>{due.text}</span>}
        {age >= 7 && c.stage !== "docs_forwarded" && <span className="pill flag" title="Days in current stage">⏱ {age}d</span>}
      </div>
    </div>
  );
}

export default function Board({ clients, onOpen, onDropStage }) {
  const dragId = useRef(null);

  return (
    <div className="kanban">
      {STAGES.map((s) => {
        const cards = clients.filter((c) => c.stage === s.key);
        return (
          <div className="col" key={s.key}>
            <div className="col-h">
              <span className="dot" style={{ background: s.color }} />
              <span className="t">{s.label}</span>
              <span className="c">{cards.length}</span>
            </div>
            <div
              className="col-body"
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }}
              onDragLeave={(e) => e.currentTarget.classList.remove("drag-over")}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("drag-over");
                if (dragId.current) onDropStage(dragId.current, s.key);
                dragId.current = null;
              }}
            >
              {cards.map((c) => (
                <Card
                  key={c.id}
                  c={c}
                  onClick={() => onOpen(c.id)}
                  onDragStart={(e) => { dragId.current = c.id; e.dataTransfer.effectAllowed = "move"; }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
