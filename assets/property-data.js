(function(){
  const AUSTIN_CENTER={lat:30.2672,lng:-97.7431};
  const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const riskCalendar={
    hvac:{label:'AC / extreme heat',months:[0,0,1,2,3,3,3,3,3,2,0,0]},
    plumbing:{label:'Plumbing / freeze',months:[3,3,1,0,0,0,0,0,0,0,1,2]},
    tree:{label:'Trees / storm',months:[1,1,2,3,3,2,1,1,2,2,1,1]},
    pest:{label:'Pest pressure',months:[1,1,2,3,3,3,3,3,3,2,1,1]},
    moisture:{label:'Moisture / storms',months:[1,1,2,3,3,2,1,1,2,2,1,1]},
    pool:{label:'Pool water stress',months:[0,0,0,1,2,3,3,3,2,1,0,0]},
    wildfire:{label:'Wildfire conditions',months:[0,0,0,0,1,1,2,3,3,2,1,0]}
  };

  function normalizeAddress(address){return String(address||'').trim().replace(/\s+/g,' ')}
  function simpleHash(input){let h=2166136261;for(const ch of String(input).toLowerCase()){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
  function propertyId(address){return 'prop_'+simpleHash(normalizeAddress(address))}
  function sessionId(){const k='ahi_session_id';let v=sessionStorage.getItem(k);if(!v){v='sess_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);sessionStorage.setItem(k,v)}return v}

  async function geocode(address){
    const a=normalizeAddress(address);
    if(!a)return null;
    const urls=[
      `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(a)}&benchmark=Public_AR_Current&format=json`,
      `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(a)}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`
    ];
    for(const url of urls){
      try{
        const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)continue;const j=await r.json();const m=j?.result?.addressMatches?.[0];
        if(m?.coordinates){return {lat:Number(m.coordinates.y),lng:Number(m.coordinates.x),matchedAddress:m.matchedAddress||a,source:'U.S. Census Geocoder'}}
      }catch(e){}
    }
    return null;
  }

  function googleEmbedUrl(address){
    const key=window.AHI_CONFIG?.googleMapsEmbedKey||'';
    if(key)return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(address)}&maptype=satellite&zoom=20`;
    return `https://www.google.com/maps?q=${encodeURIComponent(address)}&t=k&z=20&output=embed`;
  }
  function googleMapsLink(address){return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}

  function loadLeaflet(){
    if(window.L)return Promise.resolve(window.L);
    return new Promise((resolve,reject)=>{
      if(!document.querySelector('link[data-ahi-leaflet]')){const l=document.createElement('link');l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';l.dataset.ahiLeaflet='1';document.head.appendChild(l)}
      const existing=document.querySelector('script[data-ahi-leaflet]');if(existing){existing.addEventListener('load',()=>resolve(window.L));existing.addEventListener('error',reject);return}
      const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.dataset.ahiLeaflet='1';s.onload=()=>resolve(window.L);s.onerror=reject;document.head.appendChild(s);
    })
  }

  async function renderPropertyMap(el,address,coords,opts={}){
    if(!el)return null;
    el.innerHTML='';
    if(coords){
      try{
        const L=await loadLeaflet();
        const mapDiv=document.createElement('div');mapDiv.className='leaflet-map';el.appendChild(mapDiv);
        const map=L.map(mapDiv,{zoomControl:true,scrollWheelZoom:false}).setView([coords.lat,coords.lng],19);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:20,attribution:'Imagery © Esri'}).addTo(map);
        L.circleMarker([coords.lat,coords.lng],{radius:8,color:'#e96d48',weight:3,fillColor:'#ffffff',fillOpacity:.95}).addTo(map).bindTooltip('Your property',{permanent:false});
        const markers=[];
        let markMode=false;
        map.on('click',e=>{
          if(!markMode)return;
          const note=prompt('What is this area? (example: oak tree, drainage issue, pool equipment)');
          if(!note)return;
          const marker=L.marker(e.latlng).addTo(map).bindPopup(note);
          const item={lat:Number(e.latlng.lat.toFixed(6)),lng:Number(e.latlng.lng.toFixed(6)),note};markers.push(item);marker.openPopup();
          opts.onMarker?.(item,[...markers]);
        });
        return {type:'leaflet',map,markers,setMarkMode(v){markMode=!!v;mapDiv.style.cursor=markMode?'crosshair':''},getMarkers(){return [...markers]}};
      }catch(e){}
    }
    const iframe=document.createElement('iframe');iframe.loading='lazy';iframe.referrerPolicy='no-referrer-when-downgrade';iframe.allowFullscreen=true;iframe.src=googleEmbedUrl(address);el.appendChild(iframe);
    return {type:'embed',markers:[],setMarkMode(){},getMarkers(){return []}};
  }

  function seasonalOutlook(month=new Date().getMonth(),months=6){
    const period=[];
    for(let i=0;i<months;i++){const m=(month+i)%12;const ranked=Object.entries(riskCalendar).map(([key,v])=>({key,label:v.label,level:v.months[m]})).sort((a,b)=>b.level-a.level);period.push({month:monthNames[m],top:ranked.slice(0,3),all:ranked})}
    const now=period[0]?.all||[];
    return {period,currentTop:now.filter(x=>x.level>0).slice(0,4)};
  }
  function levelName(n){return n>=3?'High':n===2?'Moderate':n===1?'Seasonal':'Low'}
  function levelClass(n){return n>=3?'high':n===2?'med':'low'}

  async function fetchNws(coords){
    if(!coords)return null;
    try{
      const p=await fetch(`https://api.weather.gov/points/${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`,{headers:{Accept:'application/geo+json'}});if(!p.ok)return null;const pj=await p.json();const fu=pj?.properties?.forecast;if(!fu)return null;
      const f=await fetch(fu,{headers:{Accept:'application/geo+json'}});if(!f.ok)return null;const fj=await f.json();const periods=fj?.properties?.periods||[];if(!periods.length)return null;
      const temps=periods.map(x=>x.temperature).filter(Number.isFinite);const probs=periods.map(x=>x.probabilityOfPrecipitation?.value).filter(Number.isFinite);
      const max=Math.max(...temps),min=Math.min(...temps),rain=probs.length?Math.max(...probs):null;
      let label='Normal near-term weather';let level='low';
      if(max>=100){label='Extreme heat in 7-day forecast';level='high'}else if(min<=32){label='Freeze risk in 7-day forecast';level='high'}else if(rain>=70){label='High rain chance in 7-day forecast';level='med'}else if(max>=95){label='High heat in 7-day forecast';level='med'}
      return {label,level,max,min,rain,source:'National Weather Service'};
    }catch(e){return null}
  }

  async function fetchPermitCount(address){
    const a=normalizeAddress(address).replace(/,\s*(Austin|TX|Texas).*$/i,'').trim();if(!a)return null;
    try{
      const url=`https://data.austintexas.gov/resource/3syk-w9eu.json?$limit=12&$select=permit_number,permit_type_desc,issue_date,description,original_address,permit_location&$q=${encodeURIComponent(a)}`;
      const r=await fetch(url);if(!r.ok)return null;const rows=await r.json();return {count:Array.isArray(rows)?rows.length:0,rows:Array.isArray(rows)?rows.slice(0,6):[],source:'City of Austin Open Data'};
    }catch(e){return null}
  }

  async function fetchWildfireLayer(coords){
    if(!coords)return null;
    try{
      const q=new URLSearchParams({f:'json',geometry:`${coords.lng},${coords.lat}`,geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'NAME,DESCRIPTION,GEOGRAPHY_DEFINITION',returnGeometry:'false'});
      const url=`https://maps.austintexas.gov/arcgis/rest/services/LongRangeCIP/CityInitiatives/MapServer/3/query?${q}`;
      const r=await fetch(url);if(!r.ok)return null;const j=await r.json();const hit=j?.features?.[0]?.attributes||null;return {matched:!!hit,name:hit?.NAME||'',description:hit?.DESCRIPTION||'',source:'City of Austin Wildfire Risk layer'};
    }catch(e){return null}
  }

  async function loadSignals(address,coords){
    const seasonal=seasonalOutlook();
    const [weather,permits,wildfire]=await Promise.allSettled([fetchNws(coords),fetchPermitCount(address),fetchWildfireLayer(coords)]);
    return {
      seasonal,
      weather:weather.status==='fulfilled'?weather.value:null,
      permits:permits.status==='fulfilled'?permits.value:null,
      wildfire:wildfire.status==='fulfilled'?wildfire.value:null
    };
  }

  function renderSignalCards(el,signals){
    if(!el)return;
    const seasonal=signals?.seasonal?.currentTop?.[0];const cards=[];
    if(seasonal)cards.push(`<div class="signal-card"><small>Next 30–90 days</small><strong>${escapeHtml(seasonal.label)}</strong><span class="risk-chip ${levelClass(seasonal.level)}">${levelName(seasonal.level)}</span><p>Austin seasonal baseline; your answers refine this.</p></div>`);
    if(signals?.weather)cards.push(`<div class="signal-card"><small>Live weather signal</small><strong>${escapeHtml(signals.weather.label)}</strong><span class="risk-chip ${signals.weather.level}">${signals.weather.level==='high'?'High':signals.weather.level==='med'?'Watch':'Low'}</span><p>NWS 7-day forecast near this property.</p></div>`);
    else cards.push(`<div class="signal-card"><small>Live weather signal</small><strong>Checking local forecast</strong><span class="risk-chip low">Context</span><p>Live data appears when the address can be geocoded.</p></div>`);
    if(signals?.permits)cards.push(`<div class="signal-card"><small>Public permit search</small><strong>${signals.permits.count} recent matches</strong><span class="risk-chip low">City data</span><p>Address search against Austin's issued-permit dataset.</p></div>`);
    else cards.push(`<div class="signal-card"><small>Public records</small><strong>Permit history check</strong><span class="risk-chip low">City data</span><p>Available for Austin addresses when the city dataset returns a match.</p></div>`);
    if(signals?.wildfire?.matched)cards.push(`<div class="signal-card"><small>Wildfire planning layer</small><strong>Mapped area match</strong><span class="risk-chip med">Review</span><p>${escapeHtml(signals.wildfire.name||'City of Austin mapped wildfire area')}</p></div>`);
    el.innerHTML=cards.slice(0,4).join('');
  }

  function sixMonthHtml(){const o=seasonalOutlook();return o.period.map(p=>{const x=p.top[0];return `<div class="signal-card"><small>${p.month}</small><strong>${escapeHtml(x.label)}</strong><span class="risk-chip ${levelClass(x.level)}">${levelName(x.level)}</span></div>`}).join('')}
  function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

  window.AHIProperty={AUSTIN_CENTER,normalizeAddress,propertyId,sessionId,geocode,renderPropertyMap,googleMapsLink,loadSignals,renderSignalCards,seasonalOutlook,sixMonthHtml,levelName,levelClass,escapeHtml};
})();
