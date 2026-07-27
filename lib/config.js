// ============================================================================
//  Shared domain config + pure helpers (no React, no DOM).
//  Tax-audit case tracker: books → verification → auditor review → 3CD → ITR.
// ============================================================================

export const ASSESSMENT_YEAR = "2026-27"; // audit of FY 2025-26

// Shown in follow-up messages / documents. Change to your firm's name.
export const FIRM_NAME = "Our Audit Team";

// Billing entity — used on generated invoices (header, bank & UPI details).
export const COMPANY = {
  name: "NAQD CONSULTING PRIVATE LIMITED",
  addressLines: ["OPPOSITE KENDRIYA VIDYALAYA", "AK ROAD MALAPPURAM -676505"],
  email: "info.naqd@gmail.com",
  invoicePrefix: "NCG/AUD",          // invoice no. = NCG/AUD/<serial, 3-digit>
  bank: {
    name: "NAQD CONSULTING PVT LTD",
    accNo: "50200076296528",
    ifsc: "HDFC0009043",
    branch: "MALAPPURAM",
  },
  upi: "9343540123@pthdfc",
};

// First invoice serial number (used until an invoice is generated & stored).
export const INVOICE_SEQ_START = 101;

// Invoice number from a serial, e.g. 101 -> "NCG/AUD/101".
export function formatInvoiceNo(seq) {
  return `${COMPANY.invoicePrefix}/${String(seq).padStart(3, "0")}`;
}

// AY "2026-27" -> FY "2025-26" (previous year, shown on the invoice line).
export function fyFromAY(ay) {
  const m = /^(\d{4})-(\d{2})$/.exec(ay || "");
  if (!m) return ay || "";
  const start = parseInt(m[1], 10) - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

// Indian-format rupee amount to words, e.g. 1500 -> "INR One Thousand Five Hundred Only".
export function amountInWordsINR(value) {
  let n = Math.round(Number(value) || 0);
  if (n === 0) return "INR Zero Only";
  const A = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const B = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const sub = (x) => {
    let s = "";
    if (x > 99) { s += A[Math.floor(x / 100)] + " Hundred "; x %= 100; }
    if (x > 19) { s += B[Math.floor(x / 10)] + " "; x %= 10; }
    if (x > 0) s += A[x] + " ";
    return s;
  };
  let out = "";
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) out += sub(crore) + "Crore ";
  if (lakh) out += sub(lakh) + "Lakh ";
  if (thousand) out += sub(thousand) + "Thousand ";
  if (n) out += sub(n);
  return "INR " + out.trim().replace(/\s+/g, " ") + " Only";
}

// Invoice date format matching the sample: "9-Jul-26".
export function fmtInvoiceDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const mon = d.toLocaleDateString("en-IN", { month: "short" });
  return `${d.getDate()}-${mon}-${String(d.getFullYear()).slice(2)}`;
}

// ----- Statutory deadlines -----
// A tax-audit case has TWO deadlines: the tax-audit report (Form 3CD) and the
// ITR itself. The 3CD report date is a single firm-wide knob; the ITR date is a
// per-case bucket (standard vs transfer-pricing). Change the dates here once
// when the CBDT extends a deadline and every case updates.
export const AUDIT_REPORT_DUE = { label: "3CD report", date: "2026-09-30" };

export const DUE_CATEGORIES = [
  { key: "oct31", label: "31 Oct (Audit ITR)",        date: "2026-10-31" },
  { key: "nov30", label: "30 Nov (Transfer Pricing)", date: "2026-11-30" },
];
export const dueCategoryMeta = (k) =>
  DUE_CATEGORIES.find((d) => d.key === k) || DUE_CATEGORIES[0];

// ----- Pipeline stages -----
// `level` is the pipeline position. Books Cleanup and Books (Scratch) share
// level 1: a case takes ONE of them (they are alternatives, shown as separate
// board columns), never both. Progress, gates and advance work on `level`,
// not array order.
export const STAGES = [
  { key: "onboarding",     label: "Onboarding",        color: "#64748b", level: 0 },
  { key: "books_cleanup",  label: "Books Cleanup",     color: "#0ea5e9", level: 1 },
  { key: "books_build",    label: "Books (Scratch)",   color: "#06b6d4", level: 1 },
  { key: "verification",   label: "Verification",      color: "#8b5cf6", level: 2 },
  { key: "auditor_review", label: "Auditor Review",    color: "#f59e0b", level: 3 },
  { key: "filing_3cd",     label: "3CD Filing",        color: "#ec4899", level: 4 },
  { key: "filing_itr",     label: "ITR Filing",        color: "#6366f1", level: 5 },
  { key: "docs_forwarded", label: "Docs Forwarded ✓", color: "#16a34a", level: 6 },
];
export const stageIndex = (k) => STAGES.findIndex((s) => s.key === k); // column/stepper order
export const stageMeta  = (k) => STAGES.find((s) => s.key === k) || STAGES[0];
export const stageLevel = (k) => stageMeta(k).level ?? 0;
export const MAX_LEVEL  = Math.max(...STAGES.map((s) => s.level));
export const isTerminal = (k) => stageLevel(k) >= MAX_LEVEL;

// The default next stage (first stage at the next level). For onboarding this
// defaults to Books Cleanup; drag a card to Books (Scratch) to take that path.
export function nextStageKey(key) {
  const lvl = stageLevel(key);
  const next = STAGES.find((s) => s.level === lvl + 1);
  return next ? next.key : null;
}
// The default previous stage (first stage at the previous level).
export function prevStageKey(key) {
  const lvl = stageLevel(key);
  const prev = STAGES.filter((s) => s.level === lvl - 1);
  return prev.length ? prev[0].key : null;
}

// Audit scope aspects → drive the books / documents checklist.
//  - `qty` aspects generate one checklist item per unit (counts[key]).
export const SCOPE = {
  bank: {
    label: "🏦 Bank accounts",
    qty: true, qlabel: "No. of bank accounts",
    item: (i) => `Bank statement (full year) — Bank ${i}`,
  },
  gst: {
    label: "🧾 GST registered",
    items: ["GSTR-1 / GSTR-3B summary (full year)", "GSTR-2B / ITC reconciliation", "GST turnover vs books reconciliation"],
  },
  inventory: {
    label: "📦 Inventory / Stock",
    items: ["Closing stock statement with valuation", "Stock register / movement summary"],
  },
  fixed_assets: {
    label: "🏗 Fixed assets / Depreciation",
    items: ["Fixed asset register", "Purchase invoices for additions", "Depreciation chart (Cos Act + IT Act)"],
  },
  tds: {
    label: "✂️ TDS deducted",
    items: ["TDS challans & returns (24Q / 26Q)", "Form 26AS / TDS reconciliation"],
  },
  loans: {
    label: "💳 Loans / Borrowings",
    items: ["Loan sanction letters", "Interest & repayment schedule", "Loan / OD confirmations & statements"],
  },
  parties: {
    label: "🤝 Related-party / Partner txns",
    qty: true, qlabel: "No. of related parties",
    item: (i) => `Ledger & balance confirmation — Party ${i}`,
  },
  cash: {
    label: "💵 Significant cash dealings",
    items: ["Cash book / cash ledger", "Cash expenses > ₹10,000 review (u/s 40A(3))"],
  },
};

// Aspect sub-options (none for now, kept for parity with the checklist builder).
export const ALL_SUBS = Object.values(SCOPE).flatMap((s) => s.subs || []);
export const subMeta = (key) => ALL_SUBS.find((x) => x.key === key);

// Entity being audited. Each maps to its own base document checklist.
export const ENTITY_TYPES = [
  { key: "individual", label: "👤 Proprietor / Individual" },
  { key: "firm", label: "🤝 Firm / Partnership" },
  { key: "llp", label: "🏛 LLP" },
  { key: "company", label: "🏢 Company" },
];
export const entityTypeMeta = (k) => ENTITY_TYPES.find((e) => e.key === k) || ENTITY_TYPES[0];

export const GENERAL_ITEMS_BY_ENTITY = {
  individual: [
    "PAN & Aadhaar of proprietor", "Prior-year financials & audit report",
    "Prior-year ITR & computation", "Trial balance (current year)",
    "Bank statements (all accounts)", "Sales & purchase registers",
    "Expense ledgers & vouchers", "Books of accounts (Tally data / backup)",
  ],
  firm: [
    "PAN of firm & partners", "Partnership deed (+ amendments)",
    "Prior-year financials & audit report", "Prior-year ITR & computation",
    "Trial balance (current year)", "Bank statements (all accounts)",
    "Sales & purchase registers", "Partners' capital & current accounts",
    "Books of accounts (Tally data / backup)",
  ],
  llp: [
    "PAN of LLP & designated partners", "LLP agreement",
    "Prior-year financials & audit report", "Prior-year ITR & computation",
    "Trial balance (current year)", "Bank statements (all accounts)",
    "Form 8 / Form 11 (MCA filings)", "Books of accounts (Tally data / backup)",
  ],
  company: [
    "PAN, CIN, MOA & AOA", "Prior-year audited financials",
    "Prior-year ITR & computation", "Trial balance (current year)",
    "Bank statements (all accounts)", "Board minutes / resolutions",
    "Statutory registers", "DSC of authorised signatory",
    "Books of accounts (Tally data / backup)",
  ],
};
// Back-compat alias.
export const GENERAL_ITEMS = GENERAL_ITEMS_BY_ENTITY.firm;

// ITR forms typically filed for audit cases.
export const ITR_FORMS = ["ITR-3", "ITR-5", "ITR-6", "ITR-4", "ITR-7", "—"];

// Tax-audit report forms.
export const AUDIT_FORMS = ["3CA-3CD", "3CB-3CD", "—"];

// ----- stage gates -----
// What must be true BEFORE a case may enter `target`. Returns a list of
// human-readable problems; empty list = transition allowed.
export function gateProblems(c, target) {
  const problems = [];
  switch (target) {
    case "books_cleanup":
    case "books_build":
      if (!c.pan) problems.push("PAN is missing");
      else if (!isValidPAN(c.pan)) problems.push("PAN doesn't look valid (AAAAA9999A)");
      break;
    case "verification": {
      const open = (c.checklist || []).filter((x) => !x.done && !x.nr).length;
      if (open) problems.push(`${open} document${open === 1 ? "" : "s"} still pending — collect or mark N/A`);
      break;
    }
    case "filing_itr":
      if (!c.filing_3cd_date) problems.push("3CD filing date is missing");
      if (!c.audit_form || c.audit_form === "—") problems.push("Audit report form (3CA/3CB-3CD) not selected");
      break;
    case "docs_forwarded":
      if (!c.filing_date) problems.push("ITR filing date is missing");
      if (!c.ack_no) problems.push("ITR acknowledgement no. is missing");
      break;
    // auditor_review / filing_3cd: judgment calls, no hard data gate
  }
  return problems;
}

// Normalised fee status: 'pending' (not invoiced) | 'invoiced' | 'collected'.
export function feeStatus(c) {
  const s = c.fee_status || "pending";
  return s === "paid" ? "collected" : s;
}

// ----- ids / dates -----
export const uid = () => "c_" + Math.random().toString(36).slice(2, 9);
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const daysBetween = (aISO, bISO) =>
  Math.round((new Date(bISO) - new Date(aISO)) / 864e5);

// ----- checklist generation (preserves done-state + custom items) -----
// buildChecklist(aspects[], subs{key:bool}, counts{key:n}, existing[], entityType)
export function buildChecklist(aspects, subs, counts, existing, entityType) {
  subs = subs || {}; counts = counts || {};
  const generalItems = GENERAL_ITEMS_BY_ENTITY[entityType] || GENERAL_ITEMS_BY_ENTITY.firm;
  const prev = {}; const customs = [];
  (existing || []).forEach((it) => {
    if (it.custom) customs.push(it);
    else prev[it.label] = { done: it.done, nr: !!it.nr };
  });
  const out = [];
  const push = (label, group) =>
    out.push({ id: uid(), label, group, custom: false, done: !!prev[label]?.done, nr: !!prev[label]?.nr });

  const emit = (def, key, group) => {
    if (def.qty) {
      const n = Math.max(1, counts[key] || 1);
      for (let i = 1; i <= n; i++) push(def.item(i), group);
    }
    (def.items || []).forEach((l) => push(l, group));
  };

  generalItems.forEach((l) => push(l, "General"));
  (aspects || []).forEach((sk) => {
    const s = SCOPE[sk]; if (!s) return;
    emit(s, sk, s.label);
    (s.subs || []).forEach((sub) => { if (subs[sub.key]) emit(sub, sub.key, s.label); });
  });
  customs.forEach((c) => out.push({ ...c }));
  return out;
}

// Human-readable audit-scope summary (for client-facing documents).
export function scopeSummary(c) {
  const parts = [];
  (c.sources || []).forEach((sk) => {
    const s = SCOPE[sk]; if (!s) return;
    parts.push(s.label.replace(/^\S+\s/, "")); // strip leading emoji
  });
  return parts;
}
// Back-compat alias used by shared document code.
export const incomeSummary = scopeSummary;

// ----- derived views -----
// ITR e-verification: 30 days from the ITR filing date. null until ITR is filed.
export function everifyInfo(c) {
  if (!c.filing_date) return null;
  if (c.everify_date) return { state: "done", text: "E-verified", pill: "good" };
  const due = new Date(c.filing_date); due.setDate(due.getDate() + 30);
  const dueISO = due.toISOString().slice(0, 10);
  const left = daysBetween(todayISO(), dueISO);
  if (left < 0)  return { state: "overdue", text: `E-verify overdue ${-left}d`, pill: "bad", dueISO, left };
  if (left <= 7) return { state: "soon",    text: `E-verify in ${left}d`,        pill: "warn", dueISO, left };
  return { state: "ok", text: `E-verify by ${fmtDate(dueISO)}`, pill: "flag", dueISO, left };
}

// Next pressing statutory deadline. Before the 3CD is filed it counts down to
// the audit-report due date; after that, to the ITR due date. null once the ITR
// is filed or the case is forwarded.
export function dueInfo(c) {
  if (c.stage === "docs_forwarded" || c.filing_date) return null;
  const threeCdDone = !!c.filing_3cd_date;
  const target = threeCdDone
    ? { label: "ITR", date: dueCategoryMeta(c.due_category).date }
    : { label: "3CD", date: AUDIT_REPORT_DUE.date };
  const left = daysBetween(todayISO(), target.date);
  if (left < 0)   return { state: "overdue", text: `${target.label} due passed ${-left}d`, pill: "bad", target, left };
  if (left <= 15) return { state: "soon",    text: `${target.label} due in ${left}d`,      pill: "warn", target, left };
  return { state: "ok", text: `${target.label} due ${fmtDate(target.date)}`, pill: "flag", target, left };
}

// Days the case has been sitting in the current stage.
export function daysInStage(c) {
  const since = c.stage_since || c.created_at;
  if (!since) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 864e5));
}

// Days since the case was last chased (follow-up copied / marked done).
export function daysSinceFollowup(c) {
  if (!c.last_followup) return daysInStage(c);
  return Math.max(0, Math.floor((Date.now() - new Date(c.last_followup).getTime()) / 864e5));
}

// PAN format: 5 letters + 4 digits + 1 letter.
export function isValidPAN(pan) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test((pan || "").toUpperCase());
}

// Items marked "not required" (nr) are excluded from progress entirely.
export function checklistProgress(c) {
  const list = (c.checklist || []).filter((x) => !x.nr);
  const t = list.length; const d = list.filter((x) => x.done).length;
  return { d, t, pct: t ? Math.round((d / t) * 100) : 0 };
}

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}
export function fmtMoney(n) {
  if (n == null || n === "") return "—";
  return "₹" + Number(n).toLocaleString("en-IN");
}

// ----- Auditor verification checklist -----
// Editable template used to generate the reviewer image. Item types:
//   'yn'     -> Yes / No / N-A
//   'amount' -> ₹ number
//   'text'   -> free text
//   'select' -> one of `options`
export const DEFAULT_REVIEW_TEMPLATE = {
  sections: [
    {
      key: "books", title: "Books & Reconciliation",
      items: [
        { id: "bank_recon", label: "All bank accounts reconciled", type: "yn" },
        { id: "cash_bal", label: "Cash balance verified (no negative cash)", type: "yn" },
        { id: "stock", label: "Closing stock verified & valued", type: "yn" },
        { id: "debtors", label: "Debtors / creditors confirmations reviewed", type: "yn" },
        { id: "gst_recon", label: "GST turnover reconciled with books", type: "yn" },
        { id: "tds_comp", label: "TDS deducted & deposited (compliance)", type: "yn" },
        { id: "turnover", label: "Turnover / gross receipts", type: "amount" },
      ],
    },
    {
      key: "tcd", title: "3CD Particulars",
      items: [
        { id: "applic", label: "44AB applicability clause", type: "text" },
        { id: "method", label: "Method of accounting consistent", type: "yn" },
        { id: "depr", label: "Depreciation as per IT Act", type: "yn" },
        { id: "disallow", label: "Disallowances checked (40(a)/40A(3)/43B)", type: "yn" },
        { id: "loans_269", label: "Loans/deposits u/s 269SS/269T reviewed", type: "yn" },
        { id: "ratios", label: "Ratios & quantitative details filled", type: "yn" },
      ],
    },
    {
      key: "final", title: "Final Sign-off",
      items: [
        { id: "form", label: "Audit report form", type: "select", options: ["3CA-3CD", "3CB-3CD"] },
        { id: "udin", label: "UDIN generated", type: "yn" },
        { id: "fs_signed", label: "Financial statements signed", type: "yn" },
        { id: "itr_tie", label: "ITR figures tie to 3CD / financials", type: "yn" },
        { id: "result", label: "Total income / tax payable", type: "text" },
      ],
    },
  ],
};

// Legacy income model had no meaning here; keep a no-op migrate for parity.
export function migrateIncomeModel(c) {
  return { subs: { ...(c.subs || {}) }, counts: { ...(c.counts || {}) } };
}
