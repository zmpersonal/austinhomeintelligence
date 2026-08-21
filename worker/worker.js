/**
 * Austin Home Intelligence lead/profile receiver for Cloudflare Workers.
 *
 * Optional secrets / variables:
 * - SLACK_WEBHOOK_URL: Slack incoming webhook. Used ONLY for service_lead events.
 * - SHEET_WEBHOOK_URL: deployed Google Apps Script Web App URL.
 * - SHEET_SHARED_SECRET: shared secret also stored in Apps Script properties.
 * - ALLOWED_ORIGINS: comma-separated origins, e.g.
 *   https://austinhomeintelligence.com,https://www.austinhomeintelligence.com,https://zenzebra.art
 */
export default {
  async fetch(request, env) {
    const origin=request.headers.get('Origin')||'';
    const allowed=(env.ALLOWED_ORIGINS||env.ALLOWED_ORIGIN||'https://austinhomeintelligence.com').split(',').map(x=>x.trim()).filter(Boolean);
    const allowOrigin=allowed.includes('*')?'*':(allowed.includes(origin)?origin:allowed[0]);
    const cors={'Access-Control-Allow-Origin':allowOrigin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'};
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(request.method!=='POST')return json({ok:false,error:'Method not allowed'},405,cors);
    if(origin&&allowed[0]!=='*'&&!allowed.includes(origin))return json({ok:false,error:'Origin not allowed'},403,cors);
    try{
      const body=await request.json();
      const allowedTypes=['action_plan_request','profile_event','service_lead','report_lead'];
      if(!body||!allowedTypes.includes(body.type))return json({ok:false,error:'Invalid payload'},400,cors);
      const result={ok:true,sheetSaved:false,slackSent:false,photoUrls:[]};

      // Structured data destination: all profile and lead events.
      if(env.SHEET_WEBHOOK_URL){
        const sheetPayload={...body,sheetToken:env.SHEET_SHARED_SECRET||''};
        const sr=await fetch(env.SHEET_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sheetPayload)});
        if(sr.ok){
          result.sheetSaved=true;
          try{const sj=await sr.json();if(Array.isArray(sj.photoUrls))result.photoUrls=sj.photoUrls}catch(e){}
        } else result.sheetError=`HTTP ${sr.status}`;
      }

      // Slack should stay quiet until someone explicitly requests contact.
      if(body.type==='service_lead'&&env.SLACK_WEBHOOK_URL){
        const text=slackText(body,result.photoUrls);
        const slack=await fetch(env.SLACK_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
        result.slackSent=slack.ok;
        if(!slack.ok)result.slackError=`HTTP ${slack.status}`;
      }

      // A configured destination is not required while the site is being tested.
      result.demoMode=!env.SHEET_WEBHOOK_URL&&!env.SLACK_WEBHOOK_URL;
      return json(result,200,cors);
    }catch(e){return json({ok:false,error:'Invalid request'},400,cors)}
  }
};
function slackText(body,photoUrls=[]){
  const safe=(v,max=1500)=>String(v??'').replace(/[<>]/g,'').slice(0,max);
  const fields=[['Service',body.service||body.tool],['Score',body.score!=null?`${body.score} (${body.status||''})`:'' ],['Top priority',body.topPriority],['Name',body.firstName],['Email',body.email],['Phone',body.phone],['Address',body.address],['Contact',body.contactPreference],['Timing',body.timing],['Property ID',body.propertyId]].filter(([,v])=>String(v??'').trim());
  const concerns=Array.isArray(body.selectedConcerns)&&body.selectedConcerns.length?body.selectedConcerns.join(', '):'';
  const markers=Array.isArray(body.markers)&&body.markers.length?body.markers.map((m,i)=>`• ${i+1}: ${safe(m.note,120)} (${m.lat}, ${m.lng})`).join('\n'):'';
  const answers=body.answers?Object.entries(body.answers).slice(0,24).map(([k,v])=>`• ${safe(k,80)}: ${safe(Array.isArray(v)?v.join(', '):v,220)}`).join('\n'):'';
  const photos=photoUrls.length?photoUrls.map((u,i)=>`• Photo ${i+1}: ${u}`).join('\n'):'';
  return `*Austin Home Intelligence — SERVICE LEAD*\n${fields.map(([k,v])=>`*${k}:* ${safe(v)}`).join('\n')}${concerns?`\n*Selected concerns:* ${safe(concerns)}`:''}${markers?`\n\n*Property markers*\n${markers}`:''}${photos?`\n\n*Photos*\n${photos}`:''}${answers?`\n\n*Assessment answers*\n${answers}`:''}`;
}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}})}
