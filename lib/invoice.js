// ============================================================================
//  Invoice generation — UPI payment QR + single-page A4 PDF.
//  The invoice is laid out as an HTML node (InvoiceSheet); we snapshot it to a
//  PNG and drop it onto an A4 page so the PDF looks exactly like the preview.
//  jsPDF and qrcode are imported dynamically to keep them out of the main bundle.
// ============================================================================
import { toJpeg } from "html-to-image";
import { COMPANY } from "./config";

function withTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Render timed out")), ms)),
  ]);
}

// Standard UPI intent QR (readable by any UPI app), amount pre-filled.
export async function upiQrDataUrl(amount, note) {
  const QRCode = (await import("qrcode")).default;
  const params = new URLSearchParams({ pa: COMPANY.upi, pn: COMPANY.bank.name, cu: "INR" });
  const amt = Math.round(Number(amount) || 0);
  if (amt > 0) params.set("am", String(amt));
  if (note) params.set("tn", note);
  const upi = `upi://pay?${params.toString()}`;
  return QRCode.toDataURL(upi, { margin: 1, width: 260, errorCorrectionLevel: "M" });
}

// Render a DOM node to a single-page A4 PDF and download it.
// JPEG (not PNG) keeps the file small enough to email/WhatsApp; quality 0.95
// keeps the payment QR crisp and scannable.
//
// The logo is an inline SVG in the sheet, so it rasterises with the rest.
export async function invoiceNodeToPdf(node, filename) {
  const opts = {
    pixelRatio: 2,
    quality: 0.95,
    backgroundColor: "#ffffff",
    skipFonts: true,
    width: node.scrollWidth,
    height: node.scrollHeight,
    style: { transform: "none", margin: 0 }
  };
  const dataUrl = await withTimeout(toJpeg(node, opts));
  const { jsPDF } = await import("jspdf");

  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pw = pdf.internal.pageSize.getWidth();   // 210
  const ph = pdf.internal.pageSize.getHeight();  // 297
  const ratio = img.height / img.width;
  let w = pw, h = pw * ratio;
  if (h > ph) { h = ph; w = ph / ratio; }
  pdf.addImage(dataUrl, "JPEG", (pw - w) / 2, 0, w, h);
  pdf.save(filename.endsWith(".pdf") ? filename : filename + ".pdf");
}
