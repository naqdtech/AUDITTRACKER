-- ============================================================================
--  migration-v12-auditor-bridge.sql
--  Adds the shared review-workflow contract used by BOTH the NAQD statutory
--  tracker and the new Auditor Console. Run once in the SAME Supabase project.
--  Safe/idempotent: only ADDS columns, touches nothing existing.
-- ============================================================================

-- 1) Sub-status that drives the auditor handoff. Meaningful while
--    stage='auditor_review' (and remains 'filed' afterwards for history).
alter table public.audit_cases
  add column if not exists review_status text;   -- see values below

-- 2) Free-text channel from the auditor back to NAQD (queries / remarks).
alter table public.audit_cases
  add column if not exists auditor_notes text;

-- 3) Optional: who the case is assigned to on the auditor side (panel support).
alter table public.audit_cases
  add column if not exists auditor_assigned text;

-- 4) Lightweight audit trail of every handoff (who moved it, when, from->to).
--    Append-only JSONB array; both apps push an entry on each transition.
alter table public.audit_cases
  add column if not exists review_log jsonb default '[]'::jsonb;

-- Index so the auditor inbox query is fast.
create index if not exists audit_cases_review_status_idx
  on public.audit_cases (review_status);

-- ----------------------------------------------------------------------------
--  Allowed review_status values (the shared contract):
--    NULL / 'not_sent'            -> not yet handed to auditor (NAQD-only)
--    'pending_review'            -> NAQD sent it; shows in auditor "To Review"
--    'in_review'                 -> auditor opened / started the checklist
--    'queries_raised'            -> auditor sent it BACK to NAQD with queries
--    'pending_client_confirmation'-> auditor done; NAQD to get client sign-off
--    'client_confirmed'          -> NAQD confirmed; shows in "File 3CB-3CD"
--    'filed'                     -> auditor filed 3CB-3CD (audit_form/udin/
--                                   filing_3cd_date recorded); now files ITR
--    'itr_filed'                 -> auditor filed the ITR too (filing_date/
--                                   ack_no/outcome_*/everify_date recorded) — DONE
--
--  NOTE: the ITR filing fields (filing_date, ack_no, outcome_type,
--  outcome_amount, everify_date) already exist on audit_cases from v9 — the
--  auditor app now WRITES them, since ITR filing is the auditor's job.
--  The auditor app also advances `stage`: filed -> 'filing_itr',
--  itr_filed -> 'docs_forwarded'.
--
--  Optional hard guard (uncomment to enforce):
--  alter table public.audit_cases
--    add constraint audit_cases_review_status_chk
--    check (review_status is null or review_status in
--      ('not_sent','pending_review','in_review','queries_raised',
--       'pending_client_confirmation','client_confirmed','filed','itr_filed'));
-- ----------------------------------------------------------------------------

-- 5) Backfill: any case already sitting in auditor_review becomes pending_review.
update public.audit_cases
   set review_status = 'pending_review'
 where stage = 'auditor_review'
   and review_status is null;

-- audit_cases is already in the supabase_realtime publication (v9), so both
-- apps get live updates on these new columns automatically. Nothing to add.
