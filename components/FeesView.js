"use client";
import { useMemo, useState } from "react";
import { stageMeta, fmtMoney, feeStatus } from "../lib/config";

const FEE_STATUSES = [
  { key: "pending",   label: "Not invoiced", pill: "flag" },
  { key: "invoiced",  label: "Invoiced",     pill: "warn" },
  { key: "collected", label: "Collected",    pill: "good" },
];
const feeMeta = (k) => FEE_STATUSES.find((s) => s.key === k) || FEE_STATUSES[0];

// Separate billing workspace: invoicing & collection are managed here,
// entirely outside the filing pipeline.
export default function FeesView({ clients, onMutate, onOpen, onInvoice }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState(1);

  const totals = useMemo(() => {
    const t = { quoted: 0, invoiced: 0, collected: 0, uncollected: 0 };
    clients.forEach((c) => {
      const amt = Number(c.fee_quoted) || 0;
      t.quoted += amt;
      const s = feeStatus(c);
      if (s === "invoiced") t.invoiced += amt;
      if (s === "collected") t.collected += amt;
      else t.uncollected += amt;
    });
    return t;
  }, [clients]);

  const list = useMemo(() => {
    let l = clients;
    if (statusFilter) l = l.filter((c) => feeStatus(c) === statusFilter);
    return [...l].sort((a, b) => {
      let va, vb;
      if (sortKey === "fee_quoted") { va = Number(a.fee_quoted) || 0; vb = Number(b.fee_quoted) || 0; }
      else if (sortKey === "status") { va = feeStatus(a); vb = feeStatus(b); }
      else { va = (a[sortKey] || "").toString().toLowerCase(); vb = (b[sortKey] || "").toString().toLowerCase(); }
      return va < vb ? -sortDir : va > vb ? sortDir : 0;
    });
  }, [clients, statusFilter, sortKey, sortDir]);

  const setSort = (k) => {
    if (sortKey === k) setSortDir((d) => d * -1);
    else { setSortKey(k); setSortDir(1); }
  };

  const Th = ({ k, children }) => (
    <th onClick={() => setSort(k)}>{children} {sortKey === k ? (sortDir > 0 ? "▲" : "▼") : ""}</th>
  );

  return (
    <div>
      <div className="stats" style={{ padding: "0 0 12px" }}>
        <div className="stat" style={{ cursor: "default" }}>
          <div className="n">{fmtMoney(totals.quoted)}</div><div className="l">Total Quoted</div>
        </div>
        <div className="stat" style={{ cursor: "pointer" }} onClick={() => setStatusFilter(statusFilter === "invoiced" ? "" : "invoiced")}>
          <div className="n warn">{fmtMoney(totals.invoiced)}</div><div className="l">Invoiced, awaiting</div>
        </div>
        <div className="stat" style={{ cursor: "pointer" }} onClick={() => setStatusFilter(statusFilter === "collected" ? "" : "collected")}>
          <div className="n good">{fmtMoney(totals.collected)}</div><div className="l">Collected</div>
        </div>
        <div className="stat" style={{ cursor: "pointer" }} onClick={() => setStatusFilter(statusFilter === "pending" ? "" : "pending")}>
          <div className="n bad">{fmtMoney(totals.uncollected)}</div><div className="l">Uncollected</div>
        </div>
      </div>

      <div className="row-flex" style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Status:</span>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "6px 9px", border: "1px solid var(--line)", borderRadius: 8 }}>
          <option value="">All</option>
          {FEE_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <Th k="name">Assessee</Th>
              <Th k="stage">Audit stage</Th>
              <Th k="fee_quoted">Fee quoted (₹)</Th>
              <Th k="status">Billing status</Th>
              <th>Invoice</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const sm = stageMeta(c.stage);
              const fs = feeMeta(feeStatus(c));
              return (
                <tr key={c.id}>
                  <td onClick={() => onOpen(c.id)} style={{ cursor: "pointer" }}>
                    <b>{c.name}</b>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "ui-monospace,monospace" }}>{c.pan || ""}</div>
                  </td>
                  <td onClick={() => onOpen(c.id)} style={{ cursor: "pointer" }}>
                    <span className="stage-badge" style={{ background: sm.color }}>{sm.label}</span>
                  </td>
                  <td>
                    <input
                      type="number"
                      defaultValue={c.fee_quoted ?? ""}
                      placeholder="—"
                      style={{ width: 110, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 7 }}
                      onBlur={(e) => onMutate(c.id, (cc) => { cc.fee_quoted = e.target.value === "" ? null : Number(e.target.value); })}
                    />
                  </td>
                  <td>
                    <select
                      value={feeStatus(c)}
                      onChange={(e) => onMutate(c.id, (cc) => { cc.fee_status = e.target.value; })}
                      style={{ padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 7 }}
                    >
                      {FEE_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>{" "}
                    <span className={"pill " + fs.pill}>{fs.label}</span>
                  </td>
                  <td>
                    <button className="btn sm" onClick={() => onInvoice(c.id)} title="Generate / download invoice PDF">
                      🧾 {c.invoice?.no ? "Re-invoice" : "Invoice"}
                    </button>
                    {c.invoice?.no && (
                      <div style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "ui-monospace,monospace", marginTop: 3 }}>{c.invoice.no}</div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!list.length && (
              <tr><td colSpan={5}><div className="empty">No clients match this billing status.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
