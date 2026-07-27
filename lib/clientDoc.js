// ============================================================================
//  Documents forwarding — WhatsApp message draft (English).
//  Sent at the final stage, after the audit + ITR are done, to hand the
//  completed set of documents back to the client. The accompanying image
//  (ForwardingSheet) lists the enclosures. Nothing is sent automatically.
// ============================================================================
import { FIRM_NAME, ASSESSMENT_YEAR, fmtDate } from "./config";

// The set of completed documents being forwarded to the client.
export function forwardedDocs(c) {
  const list = [];
  list.push("Audited financial statements");
  list.push(`Tax audit report (${c.audit_form && c.audit_form !== "—" ? c.audit_form : "Form 3CD"})`);
  list.push("Income computation / tax working");
  if (c.ack_no) list.push(`ITR acknowledgement (Ack no. ${c.ack_no})`);
  else list.push("ITR acknowledgement (ITR-V)");
  return list;
}
// Back-compat alias used by shared document code.
export const collectedDocs = forwardedDocs;

export function buildClientConfirmMessage(c) {
  const ay = c.assessment_year || ASSESSMENT_YEAR;
  const docs = forwardedDocs(c).map((l) => `• ${l}`).join("\n");
  const filed = c.filing_date ? ` Your return was filed on ${fmtDate(c.filing_date)}.` : "";

  return (
    `Dear ${c.name},\n\n` +
    `Greetings from ${FIRM_NAME}. Your tax audit and income-tax return for AY ${ay} are complete.${filed}\n\n` +
    `We are forwarding the following documents for your records:\n\n${docs}\n\n` +
    `Kindly retain these safely. Do let us know if you need any clarification. Thank you!`
  );
}

export function clientConfirmWaLink(c) {
  let digits = (c.phone || "").replace(/\D/g, "");
  if (digits.length === 10) digits = "91" + digits;
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(buildClientConfirmMessage(c))}`;
}
