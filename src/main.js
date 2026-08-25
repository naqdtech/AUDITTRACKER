import { createClient } from "@supabase/supabase-js";
/* =====================================================================
   CONFIG  — fill these in to connect to the SAME Supabase project as
   the NAQD statutory tracker. Leave blank to run in local DEMO mode.
   ===================================================================== */
const CONFIG = {
  SUPABASE_URL:      import.meta.env.VITE_SUPABASE_URL || "",
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
};

/* ---- Shared workflow contract (must match the NAQD app) ---- */
const RS = {
  PENDING_REVIEW:   "pending_review",
  IN_REVIEW:        "in_review",
  QUERIES_RAISED:   "queries_raised",
  PENDING_CLIENT:   "pending_client_confirmation",
  CLIENT_CONFIRMED: "client_confirmed",
  FILED_3CD:        "filed",       // 3CB-3CD filed (value kept as 'filed' for contract compat)
  ITR_FILED:        "itr_filed",   // ITR filed — terminal, auditor's final step
};
const RS_LABEL = {
  pending_review:"Pending Review", in_review:"In Review", queries_raised:"Queries Raised",
  pending_client_confirmation:"Awaiting Client", client_confirmed:"Client Confirmed",
  filed:"3CD Filed", itr_filed:"ITR Filed ✓",
};
const RS_COLOR = {
  pending_review:"#f59e0b", in_review:"#8b5cf6", queries_raised:"#ef4444",
  pending_client_confirmation:"#0ea5e9", client_confirmed:"#16a34a",
  filed:"#6366f1", itr_filed:"#16a34a",
};

/* ---- Tabs: which review_status shows where ---- */
const TABS = [
  { key:"to_review", label:"To Review",     statuses:[RS.PENDING_REVIEW, RS.IN_REVIEW] },
  { key:"queries",   label:"My Queries",     statuses:[RS.QUERIES_RAISED] },
  { key:"awaiting",  label:"Awaiting Client",statuses:[RS.PENDING_CLIENT] },
  { key:"ready",     label:"File 3CB-3CD",   statuses:[RS.CLIENT_CONFIRMED] },
  { key:"itr",       label:"File ITR",       statuses:[RS.FILED_3CD] },
  { key:"done",      label:"Completed",      statuses:[RS.ITR_FILED] },
];

/* ---- Auditor review checklist template (mirrors DEFAULT_REVIEW_TEMPLATE
        in lib/statutory/config.js; edit here or load from audit_settings) ---- */
const REVIEW_TEMPLATE = {
  sections: [
    { key:"books", title:"Books & Reconciliation", items:[
      { id:"bank_recon", label:"All bank accounts reconciled", type:"yn" },
      { id:"cash_bal", label:"Cash balance verified (no negative cash)", type:"yn" },
      { id:"stock", label:"Closing stock verified & valued", type:"yn" },
      { id:"debtors", label:"Debtors / creditors confirmations reviewed", type:"yn" },
      { id:"gst_recon", label:"GST turnover reconciled with books", type:"yn" },
      { id:"tds_comp", label:"TDS deducted & deposited (compliance)", type:"yn" },
      { id:"tax_recon_26as_ais", label:"Reconciliation with 26AS / AIS & books", type:"yn" },
      { id:"gst_itc_recon", label:"GST ITC vs GSTR-2B reconciled", type:"yn" },
      { id:"tcs_comp", label:"TCS compliance (reconciliation & deposit)", type:"yn" },
      { id:"late_pay_interest", label:"Interest on late TDS/GST/TCS checked", type:"yn" },
      { id:"turnover", label:"Turnover / gross receipts", type:"amount" },
    ]},
    { key:"tcd", title:"3CD Particulars", items:[
      { id:"applic", label:"44AB applicability clause", type:"text" },
      { id:"method", label:"Method of accounting consistent", type:"yn" },
      { id:"depr", label:"Depreciation as per IT Act", type:"yn" },
      { id:"disallow", label:"Disallowances checked (40(a)/40A(3)/43B)", type:"yn" },
      { id:"loans_269", label:"Loans/deposits u/s 269SS/269T reviewed", type:"yn" },
      { id:"ratios", label:"Ratios & quantitative details filled", type:"yn" },
      { id:"msme_delay", label:"MSME payment delays checked (43B(h))", type:"yn" },
      { id:"personal_exp", label:"Personal expenses disallowance reviewed", type:"yn" },
      { id:"deemed_div", label:"Deemed dividend exposure (2(22)(e))", type:"yn" },
    ]},
    { key:"final", title:"Final Sign-off", items:[
      { id:"form", label:"Audit report form", type:"select", options:["3CA-3CD","3CB-3CD"] },
      { id:"udin", label:"UDIN generated", type:"yn" },
      { id:"fs_signed", label:"Financial statements signed", type:"yn" },
      { id:"itr_tie", label:"ITR figures tie to 3CD / financials", type:"yn" },
      { id:"result", label:"Total income / tax payable", type:"text" },
    ]},
  ],
};

/* =====================================================================
   DATA LAYER  — Supabase when configured, else in-memory demo
   ===================================================================== */
let sb = null, DEMO = false, cases = [], selectedId = null, activeTab = "to_review";

function connPill(txt,color){ const p=document.getElementById('connPill'); p.innerHTML=`<span class="dot" style="background:${color}"></span>${txt}`; }

async function initData(){
  if(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY){
    sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    await loadCases();
    // realtime — same publication the NAQD app uses
    sb.channel('auditor-cases')
      .on('postgres_changes',{event:'*',schema:'public',table:'audit_cases'}, () => loadCases())
      .subscribe(s => connPill(s==='SUBSCRIBED'?'live · synced':'connecting…', s==='SUBSCRIBED'?'var(--ok)':'var(--muted)'));
    connPill('live · synced','var(--ok)');
  } else {
    DEMO = true; cases = demoCases(); connPill('demo mode (no DB)','var(--warn)'); render();
  }
}

async function loadCases(){
  // Only cases the auditor is meant to see: stage=auditor_review OR already filed.
  // NOTE: we deliberately do NOT select it_portal_password / gst_password.
  const cols = "id,name,alias,group_name,entity_type,pan,assessment_year,itr_form,assigned_staff,"+
               "stage,review_status,review,audit_form,udin,filing_3cd_date,pending_client,notes,"+
               "auditor_notes,fee_quoted,updated_at,stage_since,"+
               "filing_date,ack_no,outcome_type,outcome_amount,everify_date";
  const { data, error } = await sb.from('audit_cases')
    .select(cols)
    .in('review_status', Object.values(RS))
    .order('updated_at',{ascending:false});
  if(error){ toast('Load error: '+error.message); return; }
  cases = data || [];
  render();
}

async function patch(id, fields){
  fields = {...fields, updated_at:new Date().toISOString()};
  if(DEMO){ const c=cases.find(x=>x.id===id); Object.assign(c,fields); render(); return; }
  const { error } = await sb.from('audit_cases').update(fields).eq('id',id);
  if(error){ toast('Save error: '+error.message); return false; }
  await loadCases();
  return true;
}

/* =====================================================================
   RENDER
   ===================================================================== */
function currentTab(){ return TABS.find(t=>t.key===activeTab); }
function tabCases(t){ return cases.filter(c => t.statuses.includes(c.review_status)); }

function render(){
  // tabs
  document.getElementById('tabs').innerHTML = TABS.map(t=>{
    const n = tabCases(t).length;
    return `<button class="tab ${t.key===activeTab?'active':''}" onclick="setTab('${t.key}')">${t.label}<span class="cnt">${n}</span></button>`;
  }).join('');
  // cards
  const list = tabCases(currentTab());
  document.getElementById('cards').innerHTML = list.length ? list.map(cardHTML).join('')
    : `<div class="empty">No cases in "${currentTab().label}".</div>`;
  // detail
  const sel = cases.find(c=>c.id===selectedId);
  if(sel) renderDetail(sel);
  else document.getElementById('detail').innerHTML = `<div class="empty" style="margin:auto">Select a case to begin.</div>`;
}

function setTab(k){ activeTab=k; render(); }

function reviewProgress(c){
  const items = REVIEW_TEMPLATE.sections.flatMap(s=>s.items);
  const ans = (c.review&&c.review.answers)||{};
  const done = items.filter(i=> ans[i.id]!==undefined && ans[i.id]!=="" ).length;
  return Math.round(done/items.length*100);
}

function cardHTML(c){
  const col = RS_COLOR[c.review_status]||'#888';
  const days = c.stage_since ? Math.floor((Date.now()-new Date(c.stage_since))/864e5) : 0;
  return `<div class="card ${c.id===selectedId?'sel':''}" onclick="selectCase('${c.id}')">
    <div class="top">
      <div><div class="nm">${esc(c.name)}</div>
        <div class="meta">${esc(c.entity_type||'')} · ${esc(c.pan||'—')} · AY ${esc(c.assessment_year||'')}</div></div>
      <span class="badge" style="background:${col}22;color:${col};border:1px solid ${col}55">${RS_LABEL[c.review_status]||c.review_status}</span>
    </div>
    <div class="meta" style="margin-top:8px">${esc(c.assigned_staff?('NAQD: '+c.assigned_staff):'')} ${days>0?'· '+days+'d in stage':''} · review ${reviewProgress(c)}%</div>
  </div>`;
}

function selectCase(id){ selectedId=id; document.getElementById('main').classList.add('showdetail'); render(); }

function renderDetail(c){
  const ans = (c.review&&c.review.answers)||{};
  const notes = (c.review&&c.review.notes)||{};
  const sectionsHTML = REVIEW_TEMPLATE.sections.map(sec=>`
    <div class="section">
      <h3>${sec.title}</h3>
      <div class="rows">
        ${sec.items.map(it=>rowHTML(it, ans[it.id], notes[it.id])).join('')}
      </div>
    </div>`).join('');

  document.getElementById('detail').innerHTML = `
    <div class="dhead">
      <button class="back btn-ghost" onclick="document.getElementById('main').classList.remove('showdetail')">← Back</button>
      <h2>${esc(c.name)} ${c.alias?`<span style="color:var(--muted);font-weight:400;font-size:14px">(${esc(c.alias)})</span>`:''}</h2>
      <div class="kv">
        <span>PAN <b>${esc(c.pan||'—')}</b></span>
        <span>Type <b>${esc(c.entity_type||'—')}</b></span>
        <span>AY <b>${esc(c.assessment_year||'—')}</b></span>
        <span>ITR <b>${esc(c.itr_form||'—')}</b></span>
        <span>Group <b>${esc(c.group_name||'—')}</b></span>
        <span>Status <b style="color:${RS_COLOR[c.review_status]}">${RS_LABEL[c.review_status]||c.review_status}</b></span>
      </div>
      <div class="progress"><i style="width:${reviewProgress(c)}%"></i></div>
    </div>
    <div class="dbody">
      ${c.notes?`<div class="section"><h3>Notes from NAQD</h3><div style="padding:12px 16px;color:var(--muted)">${esc(c.notes)}</div></div>`:''}
      ${sectionsHTML}
      <div class="section">
        <h3>Auditor observations / queries to NAQD</h3>
        <div style="padding:12px 16px">
          <textarea id="auditorNotes" placeholder="Queries, observations, or filing remarks…">${esc(c.auditor_notes||'')}</textarea>
        </div>
      </div>
      ${filingBlock(c)}
    </div>
    ${actionBar(c)}
  `;
}

function rowHTML(it, val, note){
  let ctl='';
  if(it.type==='yn'){
    ctl = `<div class="yn" data-id="${it.id}">
      ${['yes','no','na'].map(v=>`<button data-v="${v}" class="${val===v?'on':''}" onclick="setAns('${it.id}','${v}')">${v==='na'?'N/A':v[0].toUpperCase()+v.slice(1)}</button>`).join('')}
    </div>`;
  } else if(it.type==='amount'){
    ctl = `<input class="amt" type="number" placeholder="₹" value="${val??''}" onchange="setAns('${it.id}',this.value)"/>`;
  } else if(it.type==='select'){
    ctl = `<select onchange="setAns('${it.id}',this.value)"><option value="">—</option>${it.options.map(o=>`<option ${val===o?'selected':''}>${o}</option>`).join('')}</select>`;
  } else {
    ctl = `<input type="text" value="${esc(val||'')}" onchange="setAns('${it.id}',this.value)"/>`;
  }
  return `<div class="row"><label>${it.label}</label><div class="ctl">${ctl}</div></div>`;
}

function filingBlock(c){
  const s = c.review_status;
  const show3cd = [RS.CLIENT_CONFIRMED, RS.FILED_3CD, RS.ITR_FILED].includes(s);
  const showItr = [RS.FILED_3CD, RS.ITR_FILED].includes(s);
  const cdDone  = [RS.FILED_3CD, RS.ITR_FILED].includes(s);   // 3CD locked after filed
  const itrDone = s === RS.ITR_FILED;                          // ITR locked after filed
  let html = '';

  if(show3cd){
    const dis = cdDone ? 'disabled' : '';
    html += `<div class="section" style="border-color:${cdDone?'var(--line)':'var(--ok)'}">
      <h3>Step 1 · 3CB-3CD Filing ${cdDone?'<span class="badge" style="background:#6366f122;color:#6366f1">Filed</span>':''}</h3>
      <div class="rows">
        <div class="row"><label>Audit report form</label><div class="ctl">
          <select id="f_form" ${dis}><option value="">—</option>
            <option ${c.audit_form==='3CA-3CD'?'selected':''}>3CA-3CD</option>
            <option ${c.audit_form==='3CB-3CD'?'selected':''}>3CB-3CD</option></select></div></div>
        <div class="row"><label>UDIN</label><div class="ctl"><input id="f_udin" type="text" ${dis} value="${esc(c.udin||'')}" placeholder="UDIN"/></div></div>
        <div class="row"><label>Date of filing (3CD)</label><div class="ctl"><input id="f_date" type="date" ${dis} value="${c.filing_3cd_date||''}"/></div></div>
      </div>
    </div>`;
  }

  if(showItr){
    const dis = itrDone ? 'disabled' : '';
    html += `<div class="section" style="border-color:${itrDone?'var(--line)':'var(--ok)'}">
      <h3>Step 2 · ITR Filing ${itrDone?'<span class="badge" style="background:#16a34a22;color:#16a34a">Filed</span>':''}</h3>
      <div class="rows">
        <div class="row"><label>Date of ITR filing</label><div class="ctl"><input id="i_date" type="date" ${dis} value="${c.filing_date||''}"/></div></div>
        <div class="row"><label>Acknowledgement no.</label><div class="ctl"><input id="i_ack" type="text" ${dis} value="${esc(c.ack_no||'')}" placeholder="ITR-V ack no."/></div></div>
        <div class="row"><label>Outcome</label><div class="ctl"><select id="i_outcome" ${dis}><option value="">—</option>
          ${['nil','refund','payable'].map(o=>`<option value="${o}" ${c.outcome_type===o?'selected':''}>${o[0].toUpperCase()+o.slice(1)}</option>`).join('')}
        </select></div></div>
        <div class="row"><label>Refund / payable amount</label><div class="ctl"><input id="i_amt" class="amt" type="number" ${dis} value="${c.outcome_amount??''}" placeholder="₹"/></div></div>
        <div class="row"><label>e-Verification date</label><div class="ctl"><input id="i_ever" type="date" ${dis} value="${c.everify_date||''}"/></div></div>
      </div>
    </div>`;
  }
  return html;
}

/* ---- Action bar changes with the state ---- */
function actionBar(c){
  const s=c.review_status;
  let btns='';
  if(s===RS.PENDING_REVIEW || s===RS.IN_REVIEW){
    btns = `
      <button class="btn-warn" onclick="act('${c.id}','queries')">↩ Raise queries → NAQD</button>
      <span class="spacer"></span>
      <button class="btn-ghost" onclick="act('${c.id}','save')">Save progress</button>
      <button class="btn-ok" onclick="act('${c.id}','done')">✓ Review complete → send for client confirmation</button>`;
  } else if(s===RS.QUERIES_RAISED){
    btns = `<span class="hint">Waiting on NAQD to resolve queries. They will move it back to your inbox.</span>
      <span class="spacer"></span><button class="btn-ghost" onclick="act('${c.id}','save')">Save notes</button>`;
  } else if(s===RS.PENDING_CLIENT){
    btns = `<span class="hint">Sent to NAQD for client confirmation. It moves to "File 3CB-3CD" once confirmed.</span>`;
  } else if(s===RS.CLIENT_CONFIRMED){
    btns = `<span class="spacer"></span><button class="btn-ok" onclick="act('${c.id}','file3cd')">✓ File 3CB-3CD &amp; record details</button>`;
  } else if(s===RS.FILED_3CD){
    btns = `<span class="hint">3CD filed · UDIN ${c.udin||'—'}. Now file the ITR.</span>
      <span class="spacer"></span><button class="btn-ok" onclick="act('${c.id}','fileitr')">✓ File ITR &amp; record details</button>`;
  } else if(s===RS.ITR_FILED){
    btns = `<span class="hint">Complete ✓ — 3CD filed ${c.filing_3cd_date||''} (UDIN ${c.udin||'—'}) · ITR filed ${c.filing_date||''} (ack ${c.ack_no||'—'}).</span>`;
  }
  return `<div class="actions">${btns}</div>`;
}

/* =====================================================================
   ACTIONS
   ===================================================================== */
let pendingAns = {};   // buffered checklist edits before save
function setAns(id,v){ pendingAns[id]=v; markUI(id,v); }
function markUI(id,v){
  const grp=document.querySelector(`.yn[data-id="${id}"]`);
  if(grp){ grp.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.v===v)); }
}

function collectReview(c){
  const ans = {...((c.review&&c.review.answers)||{}), ...pendingAns};
  const notesObj = (c.review&&c.review.notes)||{};
  return { answers:ans, notes:notesObj, prepared_by:'Auditor', updated_at:new Date().toISOString() };
}

async function act(id, kind){
  const c = cases.find(x=>x.id===id); if(!c) return;
  const review = collectReview(c);
  const auditor_notes = (document.getElementById('auditorNotes')||{}).value ?? c.auditor_notes;

  if(kind==='save'){
    await patch(id,{ review, auditor_notes, review_status: c.review_status===RS.PENDING_REVIEW?RS.IN_REVIEW:c.review_status });
    toast('Saved'); pendingAns={}; return;
  }
  if(kind==='queries'){
    if(!auditor_notes){ toast('Add your queries in the observations box first'); return; }
    await patch(id,{ review, auditor_notes, review_status:RS.QUERIES_RAISED });
    toast('Queries sent to NAQD'); pendingAns={}; return;
  }
  if(kind==='done'){
    await patch(id,{ review, auditor_notes, review_status:RS.PENDING_CLIENT, pending_client:true });
    toast('Sent to NAQD for client confirmation'); pendingAns={}; return;
  }
  if(kind==='file3cd'){
    const form=(document.getElementById('f_form')||{}).value;
    const udin=(document.getElementById('f_udin')||{}).value;
    const fdate=(document.getElementById('f_date')||{}).value;
    if(!form||!udin||!fdate){ toast('Enter form, UDIN and filing date'); return; }
    // Auditor now owns filing → advance pipeline stage to ITR filing.
    await patch(id,{ review, auditor_notes, audit_form:form, udin, filing_3cd_date:fdate,
                     review_status:RS.FILED_3CD, stage:'filing_itr', pending_client:false });
    toast('3CB-3CD recorded as filed — now file the ITR'); pendingAns={}; return;
  }
  if(kind==='fileitr'){
    const idate=(document.getElementById('i_date')||{}).value;
    const ack=(document.getElementById('i_ack')||{}).value;
    const outcome=(document.getElementById('i_outcome')||{}).value;
    const amt=(document.getElementById('i_amt')||{}).value;
    const ever=(document.getElementById('i_ever')||{}).value;
    if(!idate||!ack){ toast('Enter ITR filing date and acknowledgement no.'); return; }
    if((outcome==='refund'||outcome==='payable') && !amt){ toast('Enter the refund / payable amount'); return; }
    await patch(id,{ review, auditor_notes,
                     filing_date:idate, ack_no:ack,
                     outcome_type:outcome||null, outcome_amount:amt?Number(amt):null, everify_date:ever||null,
                     review_status:RS.ITR_FILED, stage:'docs_forwarded' });
    toast('ITR recorded as filed — case complete'); pendingAns={}; return;
  }
}

/* =====================================================================
   LOGIN + UTIL
   ===================================================================== */
function showApp(){ initData(); }

function toast(m){ const t=document.getElementById('toast'); t.textContent=m; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2200); }
function esc(s){ return (s==null?'':String(s)).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
showApp();   // gate removed — load straight into the console

/* ---- Demo data so the file runs standalone ---- */
function demoCases(){
  const d=(n)=>new Date(Date.now()-n*864e5).toISOString();
  return [
    { id:"1", name:"Nair Technologies Pvt Ltd", alias:"NairTech", entity_type:"company", pan:"AANCN8765C", assessment_year:"2026-27", itr_form:"ITR-6", assigned_staff:"Dennis", group_name:"Nair Group",
      stage:"auditor_review", review_status:RS.PENDING_REVIEW, stage_since:d(2), notes:"Books finalised. Turnover ₹2.45 Cr. Please review 43B(h) MSME delays.",
      review:{answers:{turnover:"24500000"}}, updated_at:d(0.2) },
    { id:"2", name:"Sunrise Textiles", entity_type:"firm", pan:"AASFS4321F", assessment_year:"2026-27", itr_form:"ITR-5", assigned_staff:"Shibily",
      stage:"auditor_review", review_status:RS.IN_REVIEW, stage_since:d(4), review:{answers:{bank_recon:"yes",cash_bal:"yes",gst_recon:"yes"}}, updated_at:d(1) },
    { id:"3", name:"Karthik Traders", entity_type:"firm", pan:"AAACK9012M", assessment_year:"2026-27", itr_form:"ITR-5", assigned_staff:"Dhilshad",
      stage:"auditor_review", review_status:RS.QUERIES_RAISED, stage_since:d(6), auditor_notes:"Debtor confirmations missing for top 3 parties; stock valuation basis unclear.", review:{answers:{}}, updated_at:d(1.5) },
    { id:"4", name:"Meridian Exports", entity_type:"firm", pan:"AAMFM2345Q", assessment_year:"2026-27", itr_form:"ITR-5", assigned_staff:"Dennis",
      stage:"auditor_review", review_status:RS.PENDING_CLIENT, pending_client:true, stage_since:d(3), review:{answers:{bank_recon:"yes"}}, updated_at:d(0.5) },
    { id:"5", name:"Green Agro Industries", entity_type:"company", pan:"AAGCG6789R", assessment_year:"2026-27", itr_form:"ITR-6", assigned_staff:"Shibily",
      stage:"auditor_review", review_status:RS.CLIENT_CONFIRMED, stage_since:d(1), review:{answers:{form:"3CB-3CD"}}, audit_form:"3CB-3CD", updated_at:d(0.1) },
    { id:"6", name:"Coastal Marine Foods", entity_type:"firm", pan:"AACFC1234T", assessment_year:"2026-27", itr_form:"ITR-5", assigned_staff:"Dennis",
      stage:"filing_itr", review_status:RS.FILED_3CD, audit_form:"3CB-3CD", udin:"26AAABC1234D567890", filing_3cd_date:"2026-09-20", stage_since:d(0.3), review:{answers:{}}, updated_at:d(0.3) },
    { id:"7", name:"Pioneer Steel Co", entity_type:"company", pan:"AAECP7788K", assessment_year:"2026-27", itr_form:"ITR-6", assigned_staff:"Shibily",
      stage:"docs_forwarded", review_status:RS.ITR_FILED, audit_form:"3CA-3CD", udin:"26AAABC9999Z111213", filing_3cd_date:"2026-09-10",
      filing_date:"2026-09-15", ack_no:"5348811220926", outcome_type:"payable", outcome_amount:128400, everify_date:"2026-09-15", stage_since:d(1), review:{answers:{}}, updated_at:d(0.9) },
  ];
}

/* expose handlers used by inline on* attributes */
Object.assign(window, { setTab, selectCase, act, setAns });
