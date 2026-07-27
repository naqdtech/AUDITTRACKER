// ============================================================================
//  Follow-up message drafts (English).
//  Nothing is sent automatically — the app only builds the text so staff can
//  copy-paste it into WhatsApp / SMS themselves.
// ============================================================================
import { FIRM_NAME, ASSESSMENT_YEAR, dueInfo, AUDIT_REPORT_DUE, fmtDate } from "./config";

function pendingItems(c) {
  return (c.checklist || []).filter((x) => !x.done && !x.nr).map((x) => x.label);
}

export function buildFollowupMessage(c) {
  const items = pendingItems(c);
  const ay = c.assessment_year || ASSESSMENT_YEAR;
  const d = dueInfo(c);
  const due = fmtDate(d ? d.target.date : AUDIT_REPORT_DUE.date);
  const list = items.map((l) => `• ${l}`).join("\n");

  if (items.length === 0) {
    return (
      `Dear ${c.name},\n\n` +
      `Greetings from ${FIRM_NAME}! Your tax audit (AY ${ay}) is in progress. ` +
      `The audit report / filing due date is ${due}. We will reach out if any further details are needed.\n\nThank you!`
    );
  }
  return (
    `Dear ${c.name},\n\n` +
    `Greetings from ${FIRM_NAME}! For your tax audit (AY ${ay}), ` +
    `the following records / details are still pending from your side:\n\n${list}\n\n` +
    `The due date is ${due}. Kindly share these at the earliest so we can complete the audit on time.\n\nThank you!`
  );
}

// WhatsApp deep link with the message pre-filled (user still presses Send).
export function waLink(c) {
  let digits = (c.phone || "").replace(/\D/g, "");
  if (digits.length === 10) digits = "91" + digits;
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(buildFollowupMessage(c))}`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API can fail on http:// — fall back to a hidden textarea.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}
