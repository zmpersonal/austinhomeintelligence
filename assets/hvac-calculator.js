/**
 * HVAC operating-cost / lifespan calculator.
 *
 * All numeric assumptions live in HVAC_CALC_CONFIG so they're easy to audit
 * and replace once verified local data exists. No Austin-specific electricity
 * rate or replacement-cost dataset exists in this repo yet (see
 * data/service-cost-template.csv, data/vendor-database-template.csv — both
 * empty templates), so those outputs render as explicit "coming soon" states
 * rather than invented numbers. Only the equipment service-life range and the
 * maintenance/airflow efficiency-loss estimate are shown as figures, and both
 * are general, widely-cited HVAC guidance rather than proprietary Austin data.
 *
 * Reuse pattern for other niches: build a similarly-shaped CONFIG object
 * (cities/refine-controls/assumptions/sources) and call AHICalculator.mount()
 * with it — the render/state logic below doesn't assume HVAC specifically
 * except for the field labels pulled from the config.
 */
const HVAC_CALC_CONFIG = {
  service: 'hvac',
  cities: ['Austin','Round Rock','Pflugerville','Cedar Park','Georgetown'],
  systemTypes: ['Central AC','Heat pump','Packaged system','Not sure'],
  systemSizes: ['2 ton','2.5 ton','3 ton','3.5 ton','4 ton','5 ton','Not sure'],
  assumptions: {
    serviceLifeLowYears: 15,
    serviceLifeHighYears: 18,
    maintenanceEfficiencyLossPct: 15
  },
  sources: {
    lifeCycle: 'General HVAC equipment life-cycle guidance (industry/consumer sources), not Austin-specific.',
    efficiencyLoss: 'Commonly cited estimate for how much airflow/maintenance problems can raise a system’s energy use for the same cooling output.',
    electricity: 'No verified Austin/ZIP-level electricity-rate dataset in this build yet.',
    replacement: 'No verified local replacement-cost dataset in this build yet (see data/service-cost-template.csv).'
  }
};

const AHICalculator = (function(){
  function esc(s){return window.AHIProperty?.escapeHtml(s) ?? String(s??'')}
  function validZip(z){return /^\d{5}$/.test(String(z||'').trim())}

  function mount(el, cfg){
    if(!el || !cfg) return;
    const state = {city: cfg.cities[0], zip:'', systemType:'', systemSize:'', seer:''};

    el.innerHTML = `
      <div class="calc-controls">
        <div class="field"><label for="calc-city-${cfg.service}">Choose city</label>
          <select id="calc-city-${cfg.service}">${cfg.cities.map(c=>`<option${c===state.city?' selected':''}>${esc(c)}</option>`).join('')}</select>
        </div>
        <div class="field"><label for="calc-zip-${cfg.service}">Or enter your ZIP code</label>
          <input id="calc-zip-${cfg.service}" inputmode="numeric" placeholder="78704" maxlength="5">
          <small class="field-error" id="calc-zip-error-${cfg.service}" role="alert"></small>
        </div>
        <details class="calc-refine">
          <summary>Refine my estimate +</summary>
          <div class="calc-refine-grid">
            <div class="field"><label for="calc-systype-${cfg.service}">System type</label>
              <select id="calc-systype-${cfg.service}"><option value="">Not sure</option>${cfg.systemTypes.map(s=>`<option>${esc(s)}</option>`).join('')}</select>
            </div>
            <div class="field"><label for="calc-syssize-${cfg.service}">System size</label>
              <select id="calc-syssize-${cfg.service}"><option value="">Not sure</option>${cfg.systemSizes.map(s=>`<option>${esc(s)}</option>`).join('')}</select>
            </div>
            <div class="field"><label for="calc-seer-${cfg.service}">SEER2 (optional)</label>
              <input id="calc-seer-${cfg.service}" inputmode="numeric" placeholder="e.g. 15">
            </div>
          </div>
        </details>
      </div>
      <div class="calc-results" id="calc-results-${cfg.service}"></div>
      <details class="calc-methodology">
        <summary>How this is calculated</summary>
        <ul>
          <li><strong>Electricity rate:</strong> ${esc(cfg.sources.electricity)}</li>
          <li><strong>Service life:</strong> ${esc(cfg.sources.lifeCycle)} (${cfg.assumptions.serviceLifeLowYears}–${cfg.assumptions.serviceLifeHighYears} years shown here)</li>
          <li><strong>Maintenance scenario:</strong> ${esc(cfg.sources.efficiencyLoss)} (up to ~${cfg.assumptions.maintenanceEfficiencyLossPct}% shown here)</li>
          <li><strong>Replacement cost:</strong> ${esc(cfg.sources.replacement)}</li>
          <li><strong>Fallback logic:</strong> Where a verified local number doesn’t exist yet, this calculator shows an explicit "coming soon" state instead of an invented figure.</li>
        </ul>
      </details>`;

    const citySel = el.querySelector(`#calc-city-${cfg.service}`);
    const zipInput = el.querySelector(`#calc-zip-${cfg.service}`);
    const zipError = el.querySelector(`#calc-zip-error-${cfg.service}`);
    const systypeSel = el.querySelector(`#calc-systype-${cfg.service}`);
    const syssizeSel = el.querySelector(`#calc-syssize-${cfg.service}`);
    const seerInput = el.querySelector(`#calc-seer-${cfg.service}`);
    const resultsEl = el.querySelector(`#calc-results-${cfg.service}`);

    function render(){
      const location = state.zip ? `ZIP ${esc(state.zip)}` : esc(state.city);
      resultsEl.innerHTML = `
        <div class="calc-card"><small>LOCAL ELECTRICITY PRICE</small><strong>Rate data coming soon</strong><p>We don’t yet have a verified rate for ${location}. Austin Energy uses tiered residential pricing, so a single citywide number wouldn’t be accurate anyway.</p></div>
        <div class="calc-card"><small>ESTIMATED ANNUAL COOLING COST</small><strong>Coming soon</strong><p>Once verified local electricity pricing is available, this becomes a personalized range for your system size and efficiency instead of a guess.</p></div>
        <div class="calc-card"><small>TYPICAL REFERENCE LIFE</small><strong>${cfg.assumptions.serviceLifeLowYears}–${cfg.assumptions.serviceLifeHighYears} years</strong><p>Actual life varies with equipment, installation, climate, use and maintenance — this is a general reference range, not a failure prediction.</p></div>
        <div class="calc-card"><small>LOCAL REPLACEMENT COST</small><strong>Local replacement benchmark coming soon</strong><p>We normalize prices by scope (tonnage, SEER2, ductwork, electrical, permit) before publishing a number — not a single wide range.</p></div>
        <div class="calc-card calc-card-wide"><small>MAINTENANCE OPPORTUNITY</small><strong>Up to ~${cfg.assumptions.maintenanceEfficiencyLossPct}% more energy use when poorly maintained</strong><p>This is an efficiency-loss scenario, not a guaranteed savings estimate — actual savings depend on your system’s current condition. Airflow and maintenance problems can raise energy use for the same cooling output by roughly this much.</p></div>`;
    }

    citySel.onchange = ()=>{state.city=citySel.value; state.zip=''; zipInput.value=''; zipError.textContent=''; render()};
    zipInput.oninput = ()=>{
      const v = zipInput.value.replace(/\D/g,'').slice(0,5);
      zipInput.value = v;
      if(v.length===5 && !validZip(v)){zipError.textContent='Enter a valid 5-digit ZIP code.'; return}
      zipError.textContent = v.length===5 || v.length===0 ? '' : '';
      state.zip = v.length===5 ? v : '';
      if(v.length===5) render();
    };
    systypeSel.onchange = ()=>{state.systemType=systypeSel.value; render()};
    syssizeSel.onchange = ()=>{state.systemSize=syssizeSel.value; render()};
    seerInput.oninput = ()=>{state.seer=seerInput.value.replace(/\D/g,'').slice(0,2); seerInput.value=state.seer};

    render();
  }

  return {mount};
})();
