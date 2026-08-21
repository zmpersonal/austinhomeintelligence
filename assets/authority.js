
(async function(){
  const nodes=[...document.querySelectorAll('[data-live-risk]')];
  if(!nodes.length) return;
  try{
    const res=await fetch('/data/live-signals.json',{cache:'no-store'});
    if(!res.ok) throw new Error('no live data');
    const d=await res.json();
    document.querySelectorAll('[data-signal-updated]').forEach(el=>el.textContent=d.generated_at_display||d.generated_at||'');
    nodes.forEach(el=>{
      const k=el.dataset.liveRisk, item=d.risks?.[k];
      if(!item) return;
      const val=el.querySelector('[data-risk-value]');
      const st=el.querySelector('[data-risk-state]');
      if(val) val.textContent=item.value||'—';
      if(st) st.textContent=item.level||'Current';
    });
  }catch(e){
    document.querySelectorAll('[data-signal-updated]').forEach(el=>el.textContent='Seasonal baseline');
  }
})();
