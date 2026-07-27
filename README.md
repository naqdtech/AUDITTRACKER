# Audit Case Tracker

A workflow tracker for a tax-audit practice to monitor every client's audit
case through its stages — from onboarding and books work to verification,
auditor review, 3CD filing, ITR filing and forwarding the finished documents.

Built with **Next.js (App Router)** + **Supabase (Postgres)**, deployable on
**Vercel**. It is a sibling of the ITR Filing Tracker and can share the **same
Supabase project** — it uses its own `audit_*` tables.

> Staff assignment is handled in-app; there is **no login/users** table. An
> optional shared passcode gate is included.

---

## Pipeline

8 board columns, gated and sequential. Books Cleanup and Books (Scratch) are
**alternatives at the same level** — a case takes one of them, not both:

```
Onboarding → ┌ Books Cleanup ┐ → Verification → Auditor Review →
             └ Books (Scratch)┘
           → 3CD Filing → ITR Filing → Docs Forwarded
```

- **Onboarding → Books:** requires a valid PAN.
- **Books → Verification:** every document collected or marked N/A.
- **ITR Filing:** requires the 3CD filing date + audit report form (3CA/3CB-3CD).
- **Docs Forwarded:** requires the ITR filing date + acknowledgement number.

Moving backwards, and moving sideways between the two books columns, is always
free.

## Features

- **Audit-scope checklist:** tick the aspects that apply (bank accounts, GST,
  inventory, fixed assets/depreciation, TDS, loans, related parties, cash) and
  the required-documents list is generated — one line per bank account / party.
  The base list also depends on entity type (proprietor / firm / LLP / company).
  Custom items can be added; any item can be marked N/A.
- **Five views:** ☀ Today (work queue), ▦ Board (kanban), ≣ Table, ₹ Fees, 📊
  Reports — with search and stage / scope / referrer / entity / staff filters.
- **Two deadlines:** the tax-audit report (3CD, ~30 Sep) and the ITR (~31 Oct /
  30 Nov for TP), with colour-coded countdowns; the card shows whichever is next.
- **30-day ITR e-verification** countdown from the filing date.
- **Auditor review checklist** — an editable verification template (books
  reconciliations, 3CD particulars, sign-off) filled per case and exported as a
  shareable PNG for the auditor/partner.
- **Documents forwarding** — a cover sheet PNG + WhatsApp draft listing the
  enclosures (audited financials, Form 3CD, computation, ITR acknowledgement).
- **Fees tab & invoices:** quoted amount + billing status (Not invoiced →
  Invoiced → Collected), and a Tally-style A4 invoice PDF (auto-numbered
  `NCG/AUD/###`, amount-in-words, bank details + UPI QR).
- **Consultant / referral tracking**, **staff assignment**, **bulk CSV import**,
  **follow-up WhatsApp drafts**, **alias & group tags**, **Reports + CSV export**.
- **Live sync** across staff screens when Supabase is connected (Realtime);
  saves are optimistic.

---

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. With **no environment variables set**, the app runs
in **Demo mode** using localStorage and seeded sample cases — no backend needed.

---

## Connect Supabase (production)

1. Create (or reuse) a project at https://supabase.com.
2. In **SQL Editor**, paste and run [`supabase/schema.sql`](supabase/schema.sql).
   It creates the `audit_cases`, `audit_consultants`, `audit_staff` and
   `audit_settings` tables, indexes, an `updated_at` trigger, RLS policies, and
   enables Realtime. Safe to run alongside the ITR tracker in the same project.
3. In **Project Settings → API**, copy the **Project URL** and the **anon public**
   key.
4. Copy `.env.local.example` to `.env.local` and fill in:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   NEXT_PUBLIC_APP_PASSCODE=your-team-passcode   # optional
   ```

5. Restart `npm run dev`. The header badge should switch to "Live (Supabase)".

> **Security note:** because there is no per-user auth, the anon key has full
> access via the included RLS policy. Keep the key private, set
> `NEXT_PUBLIC_APP_PASSCODE`, and tighten the policy when you add Supabase Auth.

---

## Deploy to Vercel

1. Push this folder to its own Git repository.
2. In Vercel, **Add New → Project**, import the repo (framework: Next.js).
3. Add env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   optionally `NEXT_PUBLIC_APP_PASSCODE`.
4. **Deploy.**

---

## Adjusting the workflow

Everything firm-specific lives in `lib/config.js`:

- **Stages:** `STAGES` (each has a `level`; two stages sharing a level are
  parallel alternatives).
- **Audit scope aspects & their documents:** `SCOPE`; **base docs per entity
  type:** `GENERAL_ITEMS_BY_ENTITY`.
- **Deadlines:** `AUDIT_REPORT_DUE` (3CD) and `DUE_CATEGORIES` (ITR buckets).
- **Auditor-review checklist:** `DEFAULT_REVIEW_TEMPLATE` (also editable in-app,
  saved to `audit_settings`); layouts in `components/sheets.js`.
- **Invoice company/bank/UPI + prefix (`NCG/AUD`):** the `COMPANY` object;
  layout in `components/InvoiceSheet.js`.
- **Assessment year:** `ASSESSMENT_YEAR`. **Firm name:** `FIRM_NAME`.
- **Follow-up wording:** `lib/followup.js`; **forwarding wording:**
  `lib/clientDoc.js`.

The **entire app talks to storage only through `lib/store.js`** — Supabase and
the localStorage demo implement the same interface.
