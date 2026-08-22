/**
 * Reusable professional-help lead form.
 *
 * Two modes, both driven by the same config shape:
 * - Flat (default): work-type chips + optional match-count selector + one
 *   contact-form panel, all visible at once. Used by hvac.html's simpler
 *   secondary lead form.
 * - Multi-step (cfg.multiStep = true): the same three groups rendered as
 *   separate steps with a progress indicator and Back/Continue navigation.
 *   Used by the contractor-finder template (hvac-pros.html), where this
 *   form IS the primary conversion path.
 *
 * Submits through the same worker endpoint and payload shape tools.js
 * already uses (type:'service_lead') — no backend changes required.
 *
 * matchCounts (optional): array of {value, label, kicker, desc, bullets[],
 * recommendWhen[]} — recommendWhen lists workType labels that auto-highlight
 * that card as "Recommended".
 *
 * urgentWorkType/urgentMatchValue (optional): powers presetUrgent() below,
 * a one-click shortcut for "I need help right now" visitors.
 */
const LEAD_FORM_CONFIGS = {
  hvac: {
    service: 'hvac',
    proLabel: 'HVAC',
    workTypes: [
      'AC not cooling','No AC / urgent','AC repair','System replacement',
      'Maintenance / tune-up','Second opinion on a quote','Comfort / airflow issue','Not sure yet'
    ]
  },
  hvacPros: {
    service: 'hvac',
    proLabel: 'HVAC',
    multiStep: true,
    submitLabel: 'Get My HVAC Matches',
    urgentWorkType: 'No AC / urgent',
    urgentMatchValue: 1,
    workTypes: [
      'No AC / urgent','AC repair','Replacement','Maintenance','Second opinion','Airflow / comfort','Not sure'
    ],
    systemTypes: ['Central AC','Heat pump','Packaged system','Not sure'],
    systemAges: ['Under 5 years','5–10 years','10–15 years','15+ years','Not sure'],
    symptomTags: ['Weak airflow upstairs','Longer run times','Higher electric bill','Strange noise','Water near the unit','Nothing specific'],
    repairPreferences: ['Repair if reasonable','Open to replacement if needed','Not sure yet'],
    matchCounts: [
      {
        value:1, label:'One contractor', kicker:'Keep it simple',
        desc:"We'll look for one vetted professional that fits the job, location and timing you give us.",
        bullets:['You need help quickly','You don’t want several calls','It’s a smaller repair or service visit'],
        recommendWhen:['No AC / urgent']
      },
      {
        value:3, label:'Three contractors', kicker:'Compare before you choose', badge:'Recommended for bigger jobs',
        desc:'Hear from up to three vetted professionals so you can compare recommendations, availability and quotes.',
        bullets:['Replacement is being discussed','It’s an expensive repair','You want a second opinion','Scopes or quotes are very different'],
        recommendWhen:['Replacement','Second opinion']
      }
    ]
  }
};

const AHILeadForm = (function(){
  function esc(s){return window.AHIProperty?.escapeHtml(s) ?? String(s??'')}

  function mount(el, cfg){
    if(!el || !cfg) return;
    const state = {
      step: cfg.multiStep ? 1 : 0, // 0 = flat/non-stepped mode
      selectedWork: [],
      selectedSymptoms: [],
      selectedMatch: cfg.matchCounts?.[0]?.value ?? null,
      submitted: false
    };
    const totalSteps = cfg.matchCounts ? 3 : 2;

    function submitLabel(){
      if(cfg.submitLabel) return cfg.submitLabel;
      const countTxt = cfg.matchCounts && state.selectedMatch ? `My ${state.selectedMatch} ` : 'My ';
      return `Request ${countTxt}${esc(cfg.proLabel)} Option${state.selectedMatch===1?'':'s'} →`;
    }

    function progressHtml(stepNum){
      if(!cfg.multiStep) return '';
      return `<div class="progress-meta"><span>STEP ${stepNum} OF ${totalSteps}</span><span>About 60 seconds total</span></div><div class="progress"><span style="width:${Math.round((stepNum/totalSteps)*100)}%"></span></div>`;
    }

    function workTypeGridHtml(){
      return `<div class="worktype-grid" role="group" aria-label="What do you need help with?">${cfg.workTypes.map(l=>`<button type="button" class="worktype-chip${state.selectedWork.includes(l)?' selected':''}" aria-pressed="${state.selectedWork.includes(l)}">${esc(l)}</button>`).join('')}</div>`;
    }

    function matchGridHtml(){
      if(!cfg.matchCounts) return '';
      return `<div class="match-count-grid" role="group" aria-label="How many pros would you like to hear from?">${cfg.matchCounts.map(mc=>{
        const recommended = state.selectedWork.some(w=>mc.recommendWhen?.includes(w));
        return `<button type="button" class="match-card${mc.value===state.selectedMatch?' selected':''}" data-value="${mc.value}" aria-pressed="${mc.value===state.selectedMatch}">${recommended?'<span class="match-badge">Recommended</span>':''}<div class="match-kicker">${esc(mc.kicker)}${mc.badge?` · <span style="color:var(--forest)">${esc(mc.badge)}</span>`:''}</div><h3>${esc(mc.label)}</h3><p>${esc(mc.desc)}</p><ul>${mc.bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul></button>`;
      }).join('')}</div><div class="microcopy" style="margin-top:2px">You choose how many companies get your information. We don't send your request to a long list of contractors. You can change your choice below before submitting.</div>`;
    }

    function contactFieldsHtml(){
      const systemFieldsHtml = cfg.systemTypes ? `
        <div class="field"><label for="lf-systype-${cfg.service}">System type (optional)</label><select id="lf-systype-${cfg.service}" name="systemType"><option value="">Not sure</option>${cfg.systemTypes.map(s=>`<option>${esc(s)}</option>`).join('')}</select></div>
        <div class="field"><label for="lf-sysage-${cfg.service}">System age (optional)</label><select id="lf-sysage-${cfg.service}" name="systemAge"><option value="">Not sure</option>${cfg.systemAges.map(s=>`<option>${esc(s)}</option>`).join('')}</select></div>` : '';
      const symptomFieldsHtml = cfg.symptomTags ? `
        <div class="field"><label>What have you noticed? (optional)</label><div class="worktype-grid" id="lf-symptoms-${cfg.service}" role="group" aria-label="What have you noticed?">${cfg.symptomTags.map(s=>`<button type="button" class="worktype-chip symptom-chip${state.selectedSymptoms.includes(s)?' selected':''}" aria-pressed="${state.selectedSymptoms.includes(s)}">${esc(s)}</button>`).join('')}</div></div>` : '';
      const preferenceFieldHtml = cfg.repairPreferences ? `
        <div class="field"><label for="lf-pref-${cfg.service}">Repair or replace? (optional)</label><select id="lf-pref-${cfg.service}" name="repairPreference"><option value="">Not sure yet</option>${cfg.repairPreferences.map(s=>`<option>${esc(s)}</option>`).join('')}</select></div>` : '';
      return `
        <div class="field"><label for="lf-name-${cfg.service}">Name</label><input id="lf-name-${cfg.service}" name="name" autocomplete="name" required></div>
        <div class="field"><label for="lf-phone-${cfg.service}">Phone</label><input id="lf-phone-${cfg.service}" name="phone" type="tel" inputmode="tel" autocomplete="tel" required></div>
        <div class="field"><label for="lf-address-${cfg.service}">Address or ZIP</label><input id="lf-address-${cfg.service}" name="address" autocomplete="postal-code" placeholder="78704 or full address" required></div>
        <div class="field"><label for="lf-timing-${cfg.service}">Urgency / preferred timing</label><select id="lf-timing-${cfg.service}" name="timing"><option>As soon as possible</option><option>This week</option><option>This month</option><option>Just researching</option></select></div>
        ${systemFieldsHtml}
        ${symptomFieldsHtml}
        ${preferenceFieldHtml}
        <div class="field"><label for="lf-note-${cfg.service}">Anything else? (optional)</label><textarea id="lf-note-${cfg.service}" name="note" rows="3" placeholder="Recent repairs, or anything else worth mentioning"></textarea></div>
        <div class="lead-disclosure"><strong>Free for Austin homeowners — currently, no obligation.</strong> Some participating contractors may pay Austin Home Intelligence for introductions. Payment does not improve a company's vetting status. We share your request only with the ${state.selectedMatch||'company/companies'} you chose.</div>
        <button class="btn btn-primary lead-submit-btn" type="submit">${submitLabel()}</button>
        <div class="lead-form-status" aria-live="polite"></div>`;
    }

    function successHtml(){
      return `<div class="lead-success">
        <div class="tool-icon" style="margin:0 auto 14px">✓</div>
        <h3 style="text-align:center">Request sent.</h3>
        <div class="action-list" style="margin-top:18px">
          <div class="action-item"><div class="action-num">1</div><div><h4>We organize your request</h4><p>Job type, urgency, location and the number of companies you chose.</p></div></div>
          <div class="action-item"><div class="action-num">2</div><div><h4>We contact only your selected companies</h4><p>Not a long list — just the ${state.selectedMatch||'company/companies'} you picked.</p></div></div>
          <div class="action-item"><div class="action-num">3</div><div><h4>Companies reach out directly</h4><p>Using the contact details you provided.</p></div></div>
        </div>
      </div>`;
    }

    function render(){
      if(state.submitted){ el.innerHTML = successHtml(); return }
      if(!cfg.multiStep){
        el.innerHTML = `${workTypeGridHtml()}${matchGridHtml()}<form class="lead-contact-form${state.selectedWork.length?'':' hidden'}" novalidate>${contactFieldsHtml()}</form>`;
        wireWorktype(); wireMatch(); wireForm(); wireSymptoms();
        return;
      }
      // multi-step
      if(state.step===1){
        el.innerHTML = `${progressHtml(1)}${workTypeGridHtml()}<div class="actions"><span></span><button type="button" class="btn btn-primary" id="lf-next1" ${state.selectedWork.length?'':'disabled'}>Continue →</button></div>`;
        wireWorktype(()=>{ document.getElementById('lf-next1').disabled = state.selectedWork.length===0 });
        document.getElementById('lf-next1').onclick = ()=>{ state.step = cfg.matchCounts?2:3; render() };
      } else if(state.step===2 && cfg.matchCounts){
        el.innerHTML = `${progressHtml(2)}<div class="question-kicker">How many pros would you like to hear from?</div>${matchGridHtml()}<div class="actions"><button type="button" class="btn btn-ghost" id="lf-back2">← Back</button><button type="button" class="btn btn-primary" id="lf-next2">Continue →</button></div>`;
        wireMatch();
        document.getElementById('lf-back2').onclick = ()=>{ state.step=1; render() };
        document.getElementById('lf-next2').onclick = ()=>{ state.step=3; render() };
      } else {
        el.innerHTML = `${progressHtml(totalSteps)}<form class="lead-contact-form" novalidate><div class="actions" style="margin-top:0;margin-bottom:8px"><button type="button" class="btn btn-ghost" id="lf-back3">← Back</button><span></span></div>${contactFieldsHtml()}</form>`;
        document.getElementById('lf-back3').onclick = ()=>{ state.step = cfg.matchCounts?2:1; render() };
        wireForm(); wireSymptoms();
      }
    }

    function wireWorktype(onChange){
      el.querySelectorAll('.worktype-chip').forEach(b=>{
        b.onclick=()=>{
          const label = b.textContent;
          const idx = state.selectedWork.indexOf(label);
          if(idx>-1) state.selectedWork.splice(idx,1); else state.selectedWork.push(label);
          if(cfg.multiStep){ b.classList.toggle('selected'); b.setAttribute('aria-pressed', state.selectedWork.includes(label)); onChange?.() }
          else render();
        };
      });
    }
    function wireMatch(){
      el.querySelectorAll('.match-card').forEach(c=>{
        c.onclick=()=>{ state.selectedMatch = Number(c.dataset.value); render() };
      });
    }
    function wireSymptoms(){
      el.querySelectorAll('.symptom-chip').forEach(b=>{
        b.classList.toggle('selected', state.selectedSymptoms.includes(b.textContent));
        b.setAttribute('aria-pressed', state.selectedSymptoms.includes(b.textContent));
        b.onclick=()=>{
          const label = b.textContent;
          const idx = state.selectedSymptoms.indexOf(label);
          if(idx>-1) state.selectedSymptoms.splice(idx,1); else state.selectedSymptoms.push(label);
          b.classList.toggle('selected'); b.setAttribute('aria-pressed', state.selectedSymptoms.includes(label));
        };
      });
    }
    function wireForm(){
      const form = el.querySelector('.lead-contact-form');
      if(!form) return;
      form.addEventListener('submit', async e=>{
        e.preventDefault();
        const statusEl = form.querySelector('.lead-form-status');
        const btn = form.querySelector('.lead-submit-btn');
        const answers = form.note.value.trim() ? {note: form.note.value.trim()} : {};
        if(cfg.matchCounts) answers.requestedContractors = state.selectedMatch;
        if(cfg.systemTypes){
          if(form.systemType.value) answers.systemType = form.systemType.value;
          if(form.systemAge.value) answers.systemAge = form.systemAge.value;
        }
        if(cfg.symptomTags && state.selectedSymptoms.length) answers.symptoms = state.selectedSymptoms;
        if(cfg.repairPreferences && form.repairPreference.value) answers.repairPreference = form.repairPreference.value;
        const payload = {
          type:'service_lead', service:cfg.service, tool:cfg.service,
          firstName: form.name.value.trim(), phone: form.phone.value.trim(),
          address: form.address.value.trim(), contactPreference:'Either',
          timing: form.timing.value, selectedConcerns: state.selectedWork, answers,
          requestedContractors: cfg.matchCounts ? state.selectedMatch : undefined,
          propertyId: window.AHIProperty?.propertyId(form.address.value.trim()),
          source: location.href, createdAt: new Date().toISOString()
        };
        btn.disabled = true; btn.textContent = 'Sending…';
        const ok = await sendLead(payload);
        if(ok){ state.submitted = true; render(); return }
        statusEl.textContent = 'Saved locally (demo mode) — connect the Worker endpoint in assets/config.js before paid traffic.';
        btn.disabled = false; btn.textContent = submitLabel();
      });
    }

    render();

    return {
      presetUrgent(){
        if(!cfg.urgentWorkType) return;
        state.selectedWork = [cfg.urgentWorkType];
        if(cfg.urgentMatchValue) state.selectedMatch = cfg.urgentMatchValue;
        state.step = cfg.multiStep ? (cfg.matchCounts?2:3) : 0;
        render();
      }
    };
  }

  async function sendLead(payload){
    const endpoint = window.AHI_CONFIG?.leadEndpoint;
    if(!endpoint){ console.info('AHI lead (demo mode):', payload); return false }
    try{
      const res = await fetch(endpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      return res.ok;
    }catch(e){ console.error(e); return false }
  }

  function focusOrScroll(el){
    if(!el) return;
    el.scrollIntoView({behavior:'smooth', block:'start'});
    el.querySelector('.worktype-chip')?.focus();
  }

  return {mount, focusOrScroll, configs: LEAD_FORM_CONFIGS};
})();
