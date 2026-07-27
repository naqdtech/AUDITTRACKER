// ============================================================================
//  Data access layer. This is the ONLY module that talks to storage.
//  - If Supabase env vars are set  -> reads/writes Supabase (production).
//  - Otherwise                     -> uses localStorage (demo mode).
//  The UI calls store.list / store.upsert / store.remove and never cares which.
//
//  This app uses its OWN Supabase tables (audit_cases / audit_consultants /
//  audit_staff / audit_settings) so it can live in the same project as the
//  ITR tracker without colliding with its `clients` table.
// ============================================================================
import { getSupabase, isConfigured } from "./supabaseClient";
import { buildChecklist, todayISO, uid } from "./config";

const T_CASES = "audit_cases";
const T_CONSULTANTS = "audit_consultants";
const T_STAFF = "audit_staff";
const T_SETTINGS = "audit_settings";

const LS_KEY = "audit_tracker_v1";
const LS_KEY_CONSULTANTS = "audit_tracker_consultants_v1";
const LS_KEY_STAFF = "audit_tracker_staff_v1";
const LS_SETTING_PREFIX = "audit_setting_";

// Storage mode is resolved from environment variables.
export function getStoreMode() {
  return isConfigured() ? "supabase" : "demo";
}

// ---------- Supabase implementation ----------
const remote = {
  async list() {
    const { data, error } = await getSupabase()
      .from(T_CASES)
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async upsert(client) {
    const payload = { ...client };
    if (payload.id && payload.id.startsWith("c_")) {
      delete payload.id;
    }
    const { data, error } = await getSupabase()
      .from(T_CASES)
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await getSupabase().from(T_CASES).delete().eq("id", id);
    if (error) throw error;
  },
  async bulkInsert(clients) {
    const payload = clients.map((c) => {
      const p = { ...c };
      if (p.id && String(p.id).startsWith("c_")) delete p.id;
      return p;
    });
    const { error } = await getSupabase().from(T_CASES).insert(payload);
    if (error) throw error;
  },
  // Live sync: refetch-on-change. Returns an unsubscribe function.
  subscribe(onChange) {
    const sb = getSupabase();
    const ch = sb
      .channel("audit-cases-live")
      .on("postgres_changes", { event: "*", schema: "public", table: T_CASES }, onChange)
      .subscribe();
    return () => sb.removeChannel(ch);
  },
  async listConsultants() {
    const { data, error } = await getSupabase().from(T_CONSULTANTS).select("*").order("name");
    if (error) throw error;
    return data || [];
  },
  async upsertConsultant(consultant) {
    const payload = { ...consultant };
    if (payload.id && payload.id.startsWith("cons_")) {
      delete payload.id;
    }
    const { data, error } = await getSupabase().from(T_CONSULTANTS).upsert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async removeConsultant(id) {
    const { error } = await getSupabase().from(T_CONSULTANTS).delete().eq("id", id);
    if (error) throw error;
  },
  async listStaff() {
    const { data, error } = await getSupabase().from(T_STAFF).select("*").order("name");
    if (error) throw error;
    return data || [];
  },
  async upsertStaff(staff) {
    const payload = { ...staff };
    if (payload.id && payload.id.startsWith("staff_")) {
      delete payload.id;
    }
    const { data, error } = await getSupabase().from(T_STAFF).upsert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async removeStaff(id) {
    const { error } = await getSupabase().from(T_STAFF).delete().eq("id", id);
    if (error) throw error;
  },
  async getSetting(key) {
    const { data, error } = await getSupabase().from(T_SETTINGS).select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    return data ? data.value : null;
  },
  async setSetting(key, value) {
    const { error } = await getSupabase().from(T_SETTINGS).upsert({ key, value }).select();
    if (error) throw error;
  },
};

// ---------- localStorage (demo) implementation ----------
const local = {
  _read() {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
    const seeded = seed();
    localStorage.setItem(LS_KEY, JSON.stringify(seeded));
    return seeded;
  },
  _write(arr) {
    if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(arr));
  },
  async list() {
    return this._read().sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
  },
  async upsert(client) {
    const arr = this._read();
    const i = arr.findIndex((x) => x.id === client.id);
    client.updated_at = new Date().toISOString();
    if (i < 0) arr.unshift(client);
    else arr[i] = client;
    this._write(arr);
    return client;
  },
  async remove(id) {
    this._write(this._read().filter((x) => x.id !== id));
  },
  async bulkInsert(clients) {
    const arr = this._read();
    clients.forEach((c) => {
      if (!c.id) c.id = uid();
      c.updated_at = new Date().toISOString();
      arr.unshift(c);
    });
    this._write(arr);
  },
  subscribe() {
    return () => {}; // no cross-device sync in demo mode
  },
  _readConsultants() {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(LS_KEY_CONSULTANTS);
    if (raw) return JSON.parse(raw);
    const seeded = [{ id: "cons_1", name: "Direct Customer" }, { id: "cons_2", name: "Agency A" }, { id: "cons_3", name: "Consultant X" }];
    localStorage.setItem(LS_KEY_CONSULTANTS, JSON.stringify(seeded));
    return seeded;
  },
  _writeConsultants(arr) {
    if (typeof window !== "undefined") localStorage.setItem(LS_KEY_CONSULTANTS, JSON.stringify(arr));
  },
  async listConsultants() {
    return this._readConsultants().sort((a, b) => a.name.localeCompare(b.name));
  },
  async upsertConsultant(consultant) {
    const arr = this._readConsultants();
    const i = arr.findIndex((x) => x.id === consultant.id);
    if (i < 0) {
      if (!consultant.id) consultant.id = uid();
      arr.push(consultant);
    } else {
      arr[i] = consultant;
    }
    this._writeConsultants(arr);
    return consultant;
  },
  async removeConsultant(id) {
    this._writeConsultants(this._readConsultants().filter((x) => x.id !== id));
  },
  _readStaff() {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(LS_KEY_STAFF);
    if (raw) return JSON.parse(raw);
    const seeded = [{ id: "staff_1", name: "Dennis" }, { id: "staff_2", name: "Shibily" }, { id: "staff_3", name: "Dhilshad" }];
    localStorage.setItem(LS_KEY_STAFF, JSON.stringify(seeded));
    return seeded;
  },
  _writeStaff(arr) {
    if (typeof window !== "undefined") localStorage.setItem(LS_KEY_STAFF, JSON.stringify(arr));
  },
  async listStaff() {
    return this._readStaff().sort((a, b) => a.name.localeCompare(b.name));
  },
  async upsertStaff(staff) {
    const arr = this._readStaff();
    const i = arr.findIndex((x) => x.id === staff.id);
    if (i < 0) {
      if (!staff.id) staff.id = uid();
      arr.push(staff);
    } else {
      arr[i] = staff;
    }
    this._writeStaff(arr);
    return staff;
  },
  async removeStaff(id) {
    this._writeStaff(this._readStaff().filter((x) => x.id !== id));
  },
  async getSetting(key) {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem(LS_SETTING_PREFIX + key) || "null"); } catch { return null; }
  },
  async setSetting(key, value) {
    if (typeof window !== "undefined") localStorage.setItem(LS_SETTING_PREFIX + key, JSON.stringify(value));
  },
};

// Dispatch each call to the right backend based on current credentials.
export const store = {
  list(...a) { return (isConfigured() ? remote : local).list(...a); },
  upsert(...a) { return (isConfigured() ? remote : local).upsert(...a); },
  remove(...a) { return (isConfigured() ? remote : local).remove(...a); },
  bulkInsert(...a) { return (isConfigured() ? remote : local).bulkInsert(...a); },
  subscribe(...a) { return (isConfigured() ? remote : local).subscribe(...a); },
  listConsultants(...a) { return (isConfigured() ? remote : local).listConsultants(...a); },
  upsertConsultant(...a) { return (isConfigured() ? remote : local).upsertConsultant(...a); },
  removeConsultant(...a) { return (isConfigured() ? remote : local).removeConsultant(...a); },
  listStaff(...a) { return (isConfigured() ? remote : local).listStaff(...a); },
  upsertStaff(...a) { return (isConfigured() ? remote : local).upsertStaff(...a); },
  removeStaff(...a) { return (isConfigured() ? remote : local).removeStaff(...a); },
  getSetting(...a) { return (isConfigured() ? remote : local).getSetting(...a); },
  setSetting(...a) { return (isConfigured() ? remote : local).setSetting(...a); },
};

// ============================================================================
//  Demo seed data (used only in localStorage mode)
// ============================================================================
function seed() {
  const mk = (o) => {
    const c = Object.assign(
      { id: uid(), counts: {}, subs: {}, fee_status: "pending",
        assessment_year: "2026-27", due_category: "oct31", consultant: "Direct Customer",
        alias: "", group_name: "", entity_type: "firm", notes: "",
        created_at: new Date(Date.now() - 864e5 * 7).toISOString(),
        stage_since: new Date(Date.now() - 864e5 * 3).toISOString() },
      o
    );
    c.checklist = buildChecklist(c.sources || [], c.subs, c.counts, undefined, c.entity_type);
    return c;
  };
  const tick = (c, n) => { c.checklist.slice(0, n).forEach((x) => (x.done = true)); return c; };
  const minusDays = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

  return [
    tick(mk({ name: "Karthik Traders", alias: "KT Wholesale", group_name: "KT & Sons LLP", entity_type: "firm", pan: "AAACK9012M", email: "karthik@biz.in", phone: "9001122334", it_portal_reg: true, itr_form: "ITR-5", stage: "onboarding", sources: ["bank", "gst", "inventory"], counts: { bank: 2 }, fee_quoted: 25000, pending_client: true, next_followup: todayISO() }), 4),
    tick(mk({ name: "Lakshmi Provisions", entity_type: "individual", pan: "BNZPL3456N", email: "lakshmi@biz.in", phone: "9988776655", it_portal_reg: true, itr_form: "ITR-3", stage: "books_cleanup", sources: ["bank", "gst", "cash"], counts: { bank: 1 }, fee_quoted: 18000 }), 8),
    tick(mk({ name: "Sunrise Textiles", entity_type: "firm", pan: "AASFS4321F", email: "info@sunrise.in", phone: "9445566778", it_portal_reg: true, itr_form: "ITR-5", stage: "books_build", sources: ["bank", "gst", "inventory", "tds"], counts: { bank: 3 }, fee_quoted: 45000 }), 6),
    tick(mk({ name: "KT & Sons LLP", group_name: "KT & Sons LLP", entity_type: "llp", pan: "AAKFK5678L", email: "accounts@ktsons.in", phone: "9001122335", it_portal_reg: true, itr_form: "ITR-5", stage: "verification", sources: ["bank", "gst", "loans"], counts: { bank: 2 }, fee_quoted: 35000 }), 99),
    tick(mk({ name: "Nair Technologies Pvt Ltd", entity_type: "company", pan: "AANCN8765C", email: "finance@nairtech.in", phone: "9223344556", it_portal_reg: true, itr_form: "ITR-6", stage: "auditor_review", sources: ["bank", "gst", "fixed_assets", "tds", "parties"], counts: { bank: 4, parties: 2 }, fee_quoted: 60000, review: { answers: { turnover: "24500000" }, prepared_by: "Dennis", updated_at: minusDays(2) } }), 99),
    (() => { const c = tick(mk({ name: "Meridian Exports", entity_type: "firm", pan: "AAMFM2345Q", email: "meridian@exp.in", phone: "9112233445", it_portal_reg: true, itr_form: "ITR-5", stage: "filing_3cd", sources: ["bank", "gst", "inventory", "tds"], counts: { bank: 2 }, fee_quoted: 40000, fee_status: "invoiced" }), 99);
      c.audit_form = "3CB-3CD"; return c; })(),
    (() => { const c = tick(mk({ name: "Green Agro Industries", entity_type: "company", pan: "AAGCG6789R", email: "accounts@greenagro.in", phone: "9554433221", it_portal_reg: true, itr_form: "ITR-6", stage: "filing_itr", sources: ["bank", "gst", "fixed_assets", "tds"], counts: { bank: 3 }, fee_quoted: 55000, fee_status: "invoiced" }), 99);
      c.audit_form = "3CA-3CD"; c.filing_3cd_date = minusDays(20); c.udin = "24123456ABCDEF1234"; return c; })(),
    (() => { const c = tick(mk({ name: "Coastal Marine Foods", entity_type: "firm", pan: "AACFC1234T", email: "coastal@marine.in", phone: "9776655443", it_portal_reg: true, itr_form: "ITR-5", stage: "docs_forwarded", sources: ["bank", "gst", "inventory", "tds", "parties"], counts: { bank: 2, parties: 1 }, fee_quoted: 42000, fee_status: "collected" }), 99);
      c.audit_form = "3CB-3CD"; c.filing_3cd_date = minusDays(18); c.udin = "24987654ZYXWVU9876"; c.filing_date = minusDays(15); c.ack_no = "534216789012345"; c.everify_date = minusDays(14); c.outcome_type = "payable"; c.outcome_amount = 128000; return c; })(),
  ];
}
