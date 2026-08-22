/**
 * Reusable professional-help lead form.
 *
 * Renders a "what do you need help with" work-type selector, an optional
 * 1-vs-3 match-count selector (for contractor-finder style pages), and a
 * compact contact form — then submits through the same worker endpoint and
 * payload shape tools.js already uses (type:'service_lead'). No backend
 * changes required — worker.js is field-agnostic and already renders
 * selectedConcerns/answers/firstName/phone/address/timing to Slack.
 *
 * Usage: AHILeadForm.mount(el, config). Future niche pages supply their own
 * config — workTypes/proLabel/service always differ; matchCounts is optional
 * and only the contractor-finder template uses it today.
 *
 * matchCounts (optional): array of {value, label, kicker, desc, bullets[],
 * recommendWhen[]} — recommendWhen lists workType labels that should
 * auto-highlight that card as "Recommended" once selected.
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
    workTypes: [
      'No AC / urgent','AC repair','Replacement','Maintenance','Second opinion','Airflow / comfort','Not sure'
    ],
    matchCounts: [
      {
        value:1, label:'One contractor', kicker:'Keep it simple',
        desc:"We'll look for one vetted professional that fits the job, location and timing you give us.",
        bullets:['You need help quickly','You don’t want several calls','It’s a smaller repair or service visit'],
        recommendWhen:['No AC / urgent']
      },
      {
        value:3, label:'Three contractors', kicker:'Compare before you choose',
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
    let selectedWork = [];
    let selectedMatch = cfg.matchCounts?.[0]?.value ?? null;

    const matchHtml = cfg.matchCounts ? `
      <div class="question-kicker" style="margin:22px 0 4px">How many pros would you like to hear from?</div>
      <div class="match-count-grid" role="group" aria-label="How many pros would you like to hear from?"></div>
      <div class="microcopy" style="margin-bottom:6px">You choose how many companies get your information. We don't send your request to a long list of contractors. You can change your choice before submitting.</div>` : '';

    el.innerHTML = `
      <div class="worktype-grid" role="group" aria-label="What do you need help with?"></div>
      ${matchHtml}
      <form class="lead-contact-form hidden" novalidate>
        <div class="field"><label for="lf-name-${cfg.service}">Name</label><input id="lf-name-${cfg.service}" name="name" autocomplete="name" required></div>
        <div class="field"><label for="lf-phone-${cfg.service}">Phone</label><input id="lf-phone-${cfg.service}" name="phone" type="tel" autocomplete="tel" required></div>
        <div class="field"><label for="lf-address-${cfg.service}">Address or ZIP</label><input id="lf-address-${cfg.service}" name="address" autocomplete="postal-code" placeholder="78704 or full address" required></div>
        <div class="field"><label for="lf-timing-${cfg.service}">Preferred timing</label><select id="lf-timing-${cfg.service}" name="timing"><option>As soon as possible</option><option>This week</option><option>This month</option><option>Just researching</option></select></div>
        <div class="field"><label for="lf-note-${cfg.service}">Anything else? (optional)</label><textarea id="lf-note-${cfg.service}" name="note" rows="3" placeholder="Optional details about the problem"></textarea></div>
        <button class="btn btn-primary lead-submit-btn" type="submit">${esc(cfg.submitLabel || `Have an ${cfg.proLabel} Pro Contact Me →`)}</button>
        <div class="microcopy">Your information is shared only after you submit this request. Participating providers do not change your underlying risk score.</div>
        <div class="lead-form-status" aria-live="polite"></div>
      </form>`;

    const grid = el.querySelector('.worktype-grid');
    const form = el.querySelector('.lead-contact-form');
    const matchGrid = el.querySelector('.match-count-grid');

    function renderMatchCards(){
      if(!matchGrid) return;
      matchGrid.innerHTML='';
      cfg.matchCounts.forEach(mc=>{
        const recommended = selectedWork.some(w => mc.recommendWhen?.includes(w));
        const card = document.createElement('button');
        card.type='button'; card.className='match-card'+(mc.value===selectedMatch?' selected':'');
        card.setAttribute('aria-pressed', mc.value===selectedMatch?'true':'false');
        card.innerHTML = `${recommended?'<span class="match-badge">Recommended</span>':''}<div class="match-kicker">${esc(mc.kicker)}</div><h3>${esc(mc.label)}</h3><p>${esc(mc.desc)}</p><ul>${mc.bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>`;
        card.onclick = ()=>{ selectedMatch = mc.value; renderMatchCards() };
        matchGrid.appendChild(card);
      });
    }
    if(cfg.matchCounts) renderMatchCards();

    cfg.workTypes.forEach(label=>{
      const b = document.createElement('button');
      b.type='button'; b.className='worktype-chip'; b.setAttribute('aria-pressed','false');
      b.textContent=label;
      b.onclick=()=>{
        b.classList.toggle('selected');
        b.setAttribute('aria-pressed', b.classList.contains('selected')?'true':'false');
        selectedWork = [...grid.querySelectorAll('.worktype-chip.selected')].map(x=>x.textContent);
        form.classList.toggle('hidden', selectedWork.length===0);
        if(cfg.matchCounts) renderMatchCards();
      };
      grid.appendChild(b);
    });

    form.addEventListener('submit', async e=>{
      e.preventDefault();
      const statusEl = form.querySelector('.lead-form-status');
      const btn = form.querySelector('.lead-submit-btn');
      const answers = form.note.value.trim() ? {note: form.note.value.trim()} : {};
      if(cfg.matchCounts) answers.requestedMatches = selectedMatch;
      const payload = {
        type:'service_lead',
        service:cfg.service,
        tool:cfg.service,
        firstName: form.name.value.trim(),
        phone: form.phone.value.trim(),
        address: form.address.value.trim(),
        contactPreference:'Either',
        timing: form.timing.value,
        selectedConcerns: selectedWork,
        answers,
        propertyId: window.AHIProperty?.propertyId(form.address.value.trim()),
        source: location.href,
        createdAt: new Date().toISOString()
      };
      const submitLabel = cfg.submitLabel || `Have an ${cfg.proLabel} Pro Contact Me →`;
      btn.disabled = true; btn.textContent = 'Sending…';
      const ok = await sendLead(payload);
      statusEl.textContent = ok
        ? 'Request sent. A participating provider may reach out using the contact details above.'
        : 'Saved locally (demo mode) — connect the Worker endpoint in assets/config.js before paid traffic.';
      btn.disabled = false; btn.textContent = submitLabel;
      if(ok) form.reset();
    });
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
    const firstChip = el.querySelector('.worktype-chip');
    firstChip?.focus();
  }

  return {mount, focusOrScroll, configs: LEAD_FORM_CONFIGS};
})();
