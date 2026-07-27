"use client";
import { useMemo } from "react";
import {
  stageMeta, everifyInfo, dueInfo, daysInStage, daysSinceFollowup,
  checklistProgress, todayISO,
} from "../lib/config";
import { buildFollowupMessage, waLink, copyText } from "../lib/followup";

const STALE_PENDING_DAYS = 3; // pending-from-client not chased for N days
const STUCK_STAGE_DAYS = 7;   // sitting in the same stage for N days

// Compute why a client needs attention today. Higher score = more urgent.
function reasons(c) {
  const out = [];
  const ev = everifyInfo(c);
  const due = dueInfo(c);

  if (ev?.state === "overdue") out.push({ score: 100, pill: "bad", text: ev.text });
  if (due?.state === "overdue") out.push({ score: 90, pill: "bad", text: due.text });
  if (ev?.state === "soon") out.push({ score: 80, pill: "warn", text: ev.text });
  if (due?.state === "soon") out.push({ score: 70, pill: "warn", text: due.text });

  if (c.next_followup && c.next_followup <= todayISO()) {
    const overdueDays = Math.round((new Date(todayISO()) - new Date(c.next_followup)) / 864e5);
    out.push({ score: 60, pill: "flag", text: overdueDays > 0 ? `Follow-up overdue ${overdueDays}d` : "Follow-up due today" });
  }

  if (c.pending_client && daysSinceFollowup(c) >= STALE_PENDING_DAYS) {
    out.push({ score: 50, pill: "warn", text: `Pending from client — not chased for ${daysSinceFollowup(c)}d` });
  }

  const age = daysInStage(c);
  if (c.stage !== "docs_forwarded" && age >= STUCK_STAGE_DAYS) {
    out.push({ score: 30, pill: "flag", text: `${age}d in ${stageMeta(c.stage).label}` });
  }

  return out;
}

export default function TodayView({ clients, onOpen, onFollowedUp, onCopied, notify }) {
  const queue = useMemo(() => {
    return clients
      .map((c) => ({ c, rs: reasons(c) }))
      .filter((x) => x.rs.length)
      .sort((a, b) => Math.max(...b.rs.map((r) => r.score)) - Math.max(...a.rs.map((r) => r.score)));
  }, [clients]);

  const copy = async (c) => {
    const ok = await copyText(buildFollowupMessage(c));
    onCopied?.(c.id);
    notify(ok ? "Message copied — paste in WhatsApp" : "Clipboard blocked — open the client and copy from there");
  };

  if (!queue.length) {
    return (
      <div className="tablewrap">
        <div className="empty">🎉 Nothing needs attention right now. All deadlines, follow-ups and stages are on track.</div>
      </div>
    );
  }

  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Stage</th>
            <th>Docs</th>
            <th>Needs attention because</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {queue.map(({ c, rs }) => {
            const p = checklistProgress(c);
            const sm = stageMeta(c.stage);
            return (
              <tr key={c.id} onClick={() => onOpen(c.id)}>
                <td>
                  <b>{c.name}</b>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "ui-monospace,monospace" }}>
                    {c.pan || ""} {c.phone ? "· " + c.phone : ""}
                  </div>
                </td>
                <td><span className="stage-badge" style={{ background: sm.color }}>{sm.label}</span></td>
                <td><span className="prog-num">{p.d}/{p.t}</span></td>
                <td>
                  <div className="row-flex" style={{ gap: 5 }}>
                    {rs.map((r, i) => <span key={i} className={"pill " + r.pill}>{r.text}</span>)}
                  </div>
                </td>
                <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="btn sm" title="Copy follow-up message" onClick={() => copy(c)}>📋 Copy</button>{" "}
                  {waLink(c) && (
                    <a className="btn sm" href={waLink(c)} target="_blank" rel="noreferrer" title="Open WhatsApp with message pre-filled">💬</a>
                  )}{" "}
                  <button className="btn sm" title="Log follow-up done & clear due follow-up date" onClick={() => onFollowedUp(c.id)}>✓ Done</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
