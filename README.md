# NAQD Auditor Console

A single-file web app for the **auditor** side of NAQD's tax-audit workflow. It
is the bridge partner to the NAQD statutory (Audit Case) tracker: both apps talk
to the **same Supabase project / `audit_cases` table**, so when NAQD marks a case
ready for auditor review it appears here in real time, and the auditor's actions
flow straight back to NAQD.

> Replaces the earlier Next.js build of the audit tracker. Built with **Vite**
> (vanilla JS) — Supabase credentials come from `.env`, deployable on Vercel.

---

## What the auditor does here

The auditor owns the case from review through both filings:

```
NAQD app                              Auditor Console
─────────                             ───────────────
stage = auditor_review
review_status = pending_review   ──▶  "To Review" inbox → fill checklist
                             ┌──────  queries_raised            (needs NAQD/client input)
   resolves queries  ◀───────┘
   review_status = pending_review ─▶  back in inbox
                             ┌──────  pending_client_confirmation
   gets client sign-off
   review_status = client_confirmed ─▶ "File 3CB-3CD"
                                       auditor files 3CB-3CD
                             ┌──────  udin + filing_3cd_date + audit_form
                             │        review_status = filed  (stage → filing_itr)
                             │        auditor files the ITR
                             ├──────  filing_date + ack_no + outcome + everify
                             │        review_status = itr_filed (stage → docs_forwarded)
   case complete  ◀──────────┘
```

The auditor also completes a **detailed review checklist** (Books &
Reconciliation, 3CD Particulars, Final Sign-off) stored on the `review` JSONB
column — mirrors `DEFAULT_REVIEW_TEMPLATE` in the NAQD tracker.

---

## Run it

```bash
npm install
cp .env.example .env      # then fill in the two values
npm run dev               # http://localhost:5173
npm run build             # -> dist/  (static, deploy anywhere)
```

Set the Supabase credentials in **`.env`** (same project as the NAQD statutory
tracker):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=…
```

The app reads/writes `audit_cases` and subscribes to Realtime for live sync.
**With no `.env` values it runs in DEMO mode** (sample cases in memory) — and the
Supabase client is tree-shaken out of that build entirely.

### Deploy on Vercel

Framework preset **Vite** (declared in `vercel.json`). Add the two env vars —
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — under **Project → Settings →
Environment Variables**, then deploy. Build command `vite build`, output `dist`.

---

## Database

Run **`migration-v12-auditor-bridge.sql`** once in the shared Supabase project
(Dashboard → SQL Editor). It is additive/idempotent — it adds the handoff
columns (`review_status`, `auditor_notes`, `auditor_assigned`, `review_log`),
indexes `review_status`, and backfills existing `auditor_review` cases to
`pending_review`. The ITR fields (`filing_date`, `ack_no`, `outcome_type`,
`outcome_amount`, `everify_date`) already exist from the tracker's v9 schema;
this app now writes them.

### `review_status` contract (shared by both apps)

| value | meaning |
|---|---|
| `pending_review` | NAQD sent it; shows in auditor "To Review" |
| `in_review` | auditor started the checklist |
| `queries_raised` | auditor sent it back to NAQD with queries |
| `pending_client_confirmation` | auditor done; NAQD to get client sign-off |
| `client_confirmed` | NAQD confirmed; shows in "File 3CB-3CD" |
| `filed` | auditor filed 3CB-3CD; now files the ITR |
| `itr_filed` | auditor filed the ITR — case complete |

---

## Security note

Access uses the shared Supabase anon key (as agreed — the auditor is external
but part of NAQD management). The app deliberately **never selects** the
plaintext `it_portal_password` / `gst_password` columns, so a leaked auditor
build does not expose client portal logins. If the relationship ever becomes
arm's-length, switch on Supabase Auth + RLS — no app rewrite needed.
