"use client";
import { useMemo } from "react";
import {
  STAGES, DUE_CATEGORIES, AUDIT_REPORT_DUE, stageMeta, checklistProgress, feeStatus,
  fmtMoney, fmtDate, todayISO, daysBetween, dueCategoryMeta, ASSESSMENT_YEAR,
} from "../lib/config";
import { downloadCSV } from "../lib/csv";

const isItrFiled = (c) => !!c.filing_date || c.stage === "docs_forwarded";
const isDone = (c) => c.stage === "docs_forwarded";
const is3cdFiled = (c) => !!c.filing_3cd_date;

export default function Reports({ clients, notify }) {
  const r = useMemo(() => {
    const total = clients.length;

    // Funnel
    const funnel = STAGES.map((s) => {
      const n = clients.filter((c) => c.stage === s.key).length;
      return { ...s, n, pct: total ? Math.round((n / total) * 100) : 0 };
    });

    // Deadlines — the 3CD (audit report) plus each ITR due bucket.
    const deadlines = [];
    {
      const filed = clients.filter(is3cdFiled).length;
      const overdue = clients.filter((c) => !is3cdFiled(c) && daysBetween(todayISO(), AUDIT_REPORT_DUE.date) < 0).length;
      deadlines.push({ key: "3cd", label: "3CD / Audit report", date: AUDIT_REPORT_DUE.date, total, filed, remaining: total - filed, overdue });
    }
    DUE_CATEGORIES.forEach((d) => {
      const list = clients.filter((c) => (c.due_category || "oct31") === d.key);
      const filed = list.filter(isItrFiled).length;
      const overdue = list.filter((c) => !isItrFiled(c) && daysBetween(todayISO(), d.date) < 0).length;
      deadlines.push({ key: d.key, label: d.label, date: d.date, total: list.length, filed, remaining: list.length - filed, overdue });
    });

    // Fees (billing states: pending = not invoiced, invoiced, collected)
    const quoted = clients.reduce((s, c) => s + (Number(c.fee_quoted) || 0), 0);
    const sumWhere = (st) => clients.filter((c) => feeStatus(c) === st).reduce((s, c) => s + (Number(c.fee_quoted) || 0), 0);
    const collected = sumWhere("collected");
    const invoiced = sumWhere("invoiced");
    const fees = {
      quoted, invoiced, collected,
      uncollected: quoted - collected,
      rate: quoted ? Math.round((collected / quoted) * 100) : 0,
    };

    // Consultants
    const byConsultant = {};
    clients.forEach((c) => {
      const k = c.consultant || "Direct Customer";
      const b = (byConsultant[k] = byConsultant[k] || { name: k, total: 0, filed: 0, forwarded: 0, quoted: 0, collected: 0 });
      b.total++;
      if (isItrFiled(c)) b.filed++;
      if (isDone(c)) b.forwarded++;
      b.quoted += Number(c.fee_quoted) || 0;
      if (feeStatus(c) === "collected") b.collected += Number(c.fee_quoted) || 0;
    });
    const consultants = Object.values(byConsultant).sort((a, b) => b.total - a.total);

    // Outcomes
    const sum = (list) => list.reduce((s, c) => s + (Number(c.outcome_amount) || 0), 0);
    const refunds = clients.filter((c) => isItrFiled(c) && c.outcome_type === "refund");
    const payable = clients.filter((c) => isItrFiled(c) && c.outcome_type === "payable");
    const nil = clients.filter((c) => isItrFiled(c) && (!c.outcome_type || c.outcome_type === "nil"));
    const outcomes = {
      refunds: { n: refunds.length, amt: sum(refunds) },
      payable: { n: payable.length, amt: sum(payable) },
      nil: { n: nil.length },
    };

    return { total, funnel, deadlines, fees, consultants, outcomes };
  }, [clients]);

  const exportReport = () => {
    const rows = [
      [`Audit Season Report — AY ${ASSESSMENT_YEAR}`, `Generated ${fmtDate(todayISO())}`],
      [],
      ["PIPELINE"],
      ["Stage", "Cases", "%"],
      ...r.funnel.map((f) => [f.label.replace(" ✓", ""), f.n, f.pct + "%"]),
      ["Total", r.total, ""],
      [],
      ["DEADLINES"],
      ["Milestone", "Due date", "Total", "Filed", "Remaining", "Overdue (not filed)"],
      ...r.deadlines.map((d) => [d.label, d.date, d.total, d.filed, d.remaining, d.overdue]),
      [],
      ["FEES"],
      ["Quoted", "Invoiced (awaiting)", "Collected", "Uncollected", "Collection rate"],
      [r.fees.quoted, r.fees.invoiced, r.fees.collected, r.fees.uncollected, r.fees.rate + "%"],
      [],
      ["CONSULTANT-WISE"],
      ["Consultant", "Cases", "ITR filed", "Forwarded", "Fees quoted", "Fees collected"],
      ...r.consultants.map((c) => [c.name, c.total, c.filed, c.forwarded, c.quoted, c.collected]),
      [],
      ["OUTCOMES (filed returns)"],
      ["Type", "Count", "Amount"],
      ["Refund", r.outcomes.refunds.n, r.outcomes.refunds.amt],
      ["Payable", r.outcomes.payable.n, r.outcomes.payable.amt],
      ["Nil", r.outcomes.nil.n, ""],
    ];
    downloadCSV(`audit-report-ay${ASSESSMENT_YEAR}.csv`, rows);
    notify("Report CSV downloaded");
  };

  const exportClients = () => {
    const header = [
      "Assessee", "PAN", "Phone", "Email", "Consultant", "Entity", "ITR form", "ITR due", "Stage",
      "Docs collected", "Docs total", "Pending documents", "Pending from client",
      "Audit form", "3CD filing date", "UDIN", "ITR filing date", "Ack no", "E-verify date",
      "Outcome", "Outcome amount", "Fee quoted", "Billing status", "Next follow-up", "Scope", "Notes",
    ];
    const rows = clients.map((c) => {
      const p = checklistProgress(c);
      const pending = (c.checklist || []).filter((x) => !x.done && !x.nr).map((x) => x.label).join("; ");
      return [
        c.name, c.pan || "", c.phone || "", c.email || "", c.consultant || "Direct Customer",
        c.entity_type || "", c.itr_form || "", dueCategoryMeta(c.due_category).label, stageMeta(c.stage).label.replace(" ✓", ""),
        p.d, p.t, pending, c.pending_client ? "Yes" : "No",
        c.audit_form || "", c.filing_3cd_date || "", c.udin || "",
        c.filing_date || "", c.ack_no || "", c.everify_date || "",
        c.outcome_type || "", c.outcome_amount ?? "",
        c.fee_quoted ?? "", feeStatus(c), c.next_followup || "",
        (c.sources || []).join("; "), c.notes || "",
      ];
    });
    downloadCSV(`audit-cases-ay${ASSESSMENT_YEAR}.csv`, [header, ...rows]);
    notify("Case list CSV downloaded");
  };

  const Section = ({ title, children, action }) => (
    <div className="tablewrap" style={{ marginBottom: 16 }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center" }}>
        <b style={{ fontSize: 13.5 }}>{title}</b>
        <span style={{ marginLeft: "auto" }}>{action}</span>
      </div>
      {children}
    </div>
  );

  return (
    <div>
      <div className="row-flex" style={{ marginBottom: 14 }}>
        <button className="btn primary" onClick={exportReport}>⬇ Export report (CSV)</button>
        <button className="btn" onClick={exportClients}>⬇ Export full case list (CSV)</button>
      </div>

      <Section title={`Season pipeline — ${r.total} cases`}>
        <table>
          <thead><tr><th>Stage</th><th>Cases</th><th style={{ width: "45%" }}>Share</th></tr></thead>
          <tbody>
            {r.funnel.map((f) => (
              <tr key={f.key}>
                <td><span className="stage-badge" style={{ background: f.color }}>{f.label}</span></td>
                <td><b>{f.n}</b> <span style={{ color: "var(--muted)", fontSize: 12 }}>({f.pct}%)</span></td>
                <td><div className="prog"><i style={{ width: f.pct + "%", background: f.color }} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Statutory deadlines (3CD + ITR)">
        <table>
          <thead><tr><th>Milestone</th><th>Due date</th><th>Total</th><th>Filed</th><th>Remaining</th><th>Overdue</th></tr></thead>
          <tbody>
            {r.deadlines.map((d) => (
              <tr key={d.key}>
                <td><b>{d.label}</b></td>
                <td>{fmtDate(d.date)}</td>
                <td>{d.total}</td>
                <td><span className="pill good">{d.filed}</span></td>
                <td>{d.remaining}</td>
                <td>{d.overdue ? <span className="pill bad">{d.overdue}</span> : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Fees & collections (managed in the Fees tab)">
        <table>
          <thead><tr><th>Quoted</th><th>Invoiced, awaiting</th><th>Collected</th><th>Uncollected</th><th>Collection rate</th></tr></thead>
          <tbody>
            <tr>
              <td><b>{fmtMoney(r.fees.quoted)}</b></td>
              <td style={{ color: "var(--warn)", fontWeight: 700 }}>{fmtMoney(r.fees.invoiced)}</td>
              <td style={{ color: "var(--good)", fontWeight: 700 }}>{fmtMoney(r.fees.collected)}</td>
              <td style={{ color: "var(--bad)", fontWeight: 700 }}>{fmtMoney(r.fees.uncollected)}</td>
              <td>{r.fees.rate}%</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Consultant-wise (referral attribution)">
        <table>
          <thead><tr><th>Consultant</th><th>Cases</th><th>ITR filed</th><th>Forwarded</th><th>Fees quoted</th><th>Collected</th></tr></thead>
          <tbody>
            {r.consultants.map((c) => (
              <tr key={c.name}>
                <td><b>{c.name}</b></td>
                <td>{c.total}</td>
                <td>{c.filed}</td>
                <td>{c.forwarded}</td>
                <td>{fmtMoney(c.quoted)}</td>
                <td>{fmtMoney(c.collected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Outcomes (filed returns)">
        <table>
          <thead><tr><th>Type</th><th>Count</th><th>Amount</th></tr></thead>
          <tbody>
            <tr><td><span className="pill good">Refund</span></td><td>{r.outcomes.refunds.n}</td><td>{fmtMoney(r.outcomes.refunds.amt)}</td></tr>
            <tr><td><span className="pill warn">Payable</span></td><td>{r.outcomes.payable.n}</td><td>{fmtMoney(r.outcomes.payable.amt)}</td></tr>
            <tr><td><span className="pill flag">Nil</span></td><td>{r.outcomes.nil.n}</td><td>—</td></tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}
