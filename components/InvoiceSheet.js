"use client";
import { COMPANY, fmtMoney, amountInWordsINR } from "../lib/config";

// Explicit colours (renders into a PDF image, so no CSS vars).
const INK = "#1a1a1a", MUTED = "#555", LINE = "#111", SOFT = "#e2e2e2";
const serif = '"Times New Roman", Georgia, serif';

// The company logo
function LogoImage({ width = 80 }) {
  return (
    <img src="/naqd_N_LOGO.jpg" alt="NAQD logo" style={{ width: width, height: "auto", objectFit: "contain", display: "block" }} />
  );
}

// invoice = { no, date (display), particulars, fy, amount }
export function InvoiceSheet({ client: c, invoice, qrDataUrl }) {
  const amt = Number(invoice.amount) || 0;
  const money = (n) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const bank = COMPANY.bank;

  return (
    <div style={{ width: 794, minHeight: 1123, background: "#fff", color: INK, fontFamily: serif, fontSize: 13, padding: "34px 40px", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      {/* top meta row */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
        <div>
          <div>Invoice No.&nbsp;<b>{invoice.no}</b></div>
          <div style={{ marginTop: 2 }}>Ref. No.</div>
        </div>
        <div>Dated&nbsp;&nbsp;<b>{invoice.date}</b></div>
      </div>

      {/* logo + company (logo left, company centred on the page) */}
      <div style={{ display: "flex", alignItems: "center", marginTop: 10 }}>
        <div style={{ width: 96, flex: "none", display: "flex", justifyContent: "center" }}>
          <LogoImage width={80} />
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{COMPANY.name}</div>
          {COMPANY.addressLines.map((l, i) => <div key={i} style={{ fontSize: 12 }}>{l}</div>)}
          <div style={{ fontSize: 12 }}>E-Mail : {COMPANY.email}</div>
        </div>
        <div style={{ width: 96, flex: "none" }} />
      </div>

      {/* title + party */}
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 15, marginTop: 16, letterSpacing: "0.02em" }}>INVOICE</div>
      <div style={{ textAlign: "center", marginTop: 6, marginBottom: 8 }}>Party :&nbsp;<b>{(c.name || "").toUpperCase()}</b></div>

      {/* particulars table (grows to fill the page) */}
      <div style={{ border: `1px solid ${LINE}`, display: "flex", flexDirection: "column", flex: 1, marginTop: 4 }}>
        <div style={{ display: "flex", borderBottom: `1px solid ${LINE}` }}>
          <div style={{ flex: 1, textAlign: "center", padding: "6px 10px", borderRight: `1px solid ${LINE}` }}>Particulars</div>
          <div style={{ width: 150, textAlign: "center", padding: "6px 10px" }}>Amount</div>
        </div>
        <div style={{ display: "flex", flex: 1 }}>
          <div style={{ flex: 1, padding: "10px 12px", borderRight: `1px solid ${LINE}` }}>
            <div style={{ fontWeight: 700 }}>{invoice.particulars || "Tax Audit & ITR Filing Fee"}</div>
            {invoice.fy ? <div style={{ fontStyle: "italic", fontSize: 12, marginTop: 2 }}>FY&nbsp; {invoice.fy}</div> : null}
          </div>
          <div style={{ width: 150, padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>{money(amt)}</div>
        </div>
        <div style={{ display: "flex", borderTop: `1px solid ${LINE}` }}>
          <div style={{ flex: 1, padding: "6px 12px", textAlign: "right", borderRight: `1px solid ${LINE}`, fontWeight: 700 }}>Total</div>
          <div style={{ width: 150, padding: "6px 12px", textAlign: "right", fontWeight: 700 }}>₹ {money(amt)}</div>
        </div>
      </div>

      {/* amount in words */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
        <span>Amount Chargeable (in words)</span>
        <span style={{ fontStyle: "italic" }}>E. &amp; O.E</span>
      </div>
      <div style={{ fontWeight: 700, marginTop: 2 }}>{amountInWordsINR(amt)}</div>

      {/* bank details + UPI QR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, border: `1px solid ${SOFT}`, borderRadius: 6, padding: "12px 14px", marginTop: 14 }}>
        <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Bank &amp; Payment Details</div>
          <div>Name&nbsp; &nbsp;: {bank.name}</div>
          <div>A/c No&nbsp;: {bank.accNo}</div>
          <div>IFSC&nbsp; &nbsp;: {bank.ifsc}</div>
          <div>Branch&nbsp;: {bank.branch}</div>
          <div>UPI ID&nbsp;: {COMPANY.upi}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          {qrDataUrl ? <img src={qrDataUrl} alt="UPI QR" style={{ width: 110, height: 110, display: "block" }} /> : <div style={{ width: 110, height: 110, background: "#f2f2f2" }} />}
          <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3 }}>Scan to pay via any UPI app</div>
        </div>
      </div>

      {/* signatory */}
      <div style={{ textAlign: "right", marginTop: 18, fontSize: 12.5 }}>
        <div style={{ fontWeight: 700 }}>for {COMPANY.name}</div>
        <div style={{ marginTop: 34 }}>Authorised Signatory</div>
      </div>

      <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, textDecoration: "underline" }}>This is a Computer Generated Invoice</div>
    </div>
  );
}
