/**
 * Austin Home Intelligence lead receiver for Cloudflare Workers.
 * Set a secret named SLACK_WEBHOOK_URL in Worker Settings > Variables and Secrets.
 * Optionally set ALLOWED_ORIGIN to https://austinhomeintelligence.com
 */
export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || 'https://austinhomeintelligence.com';
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': origin === allowed || allowed === '*' ? origin || '*' : allowed,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ ok:false, error:'Method not allowed' }, 405, cors);
    if (!env.SLACK_WEBHOOK_URL) return json({ ok:false, error:'SLACK_WEBHOOK_URL is not configured' }, 500, cors);
    try {
      const body = await request.json();
      if (!body || !['report_lead','service_lead'].includes(body.type)) return json({ ok:false, error:'Invalid payload' }, 400, cors);
      const safe = (v,max=1400) => String(v ?? '').replace(/[<>]/g,'').slice(0,max);
      const fields = [
        ['Type', body.type], ['Service', body.service || body.tool], ['Score', body.score != null ? `${body.score} (${body.status || ''})` : ''],
        ['Name', body.firstName], ['Email', body.email], ['Phone', body.phone], ['Address', body.address],
        ['Contact', body.contactPreference], ['Timing', body.timing], ['Source', body.source]
      ].filter(([,v])=>v!==undefined && v!==null && String(v).trim()!=='');
      const answers = body.answers ? Object.entries(body.answers).slice(0,20).map(([k,v])=>`• ${safe(k,80)}: ${safe(Array.isArray(v)?v.join(', '):v,240)}`).join('\n') : '';
      const text = `*Austin Home Intelligence — ${body.type === 'service_lead' ? 'SERVICE LEAD' : 'REPORT LEAD'}*\n${fields.map(([k,v])=>`*${k}:* ${safe(v)}`).join('\n')}${answers?`\n\n*Answers*\n${answers}`:''}`;
      const slack = await fetch(env.SLACK_WEBHOOK_URL, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
      if (!slack.ok) return json({ok:false,error:'Lead destination rejected request'},502,cors);
      return json({ok:true},200,cors);
    } catch (e) {
      return json({ok:false,error:'Invalid request'},400,cors);
    }
  }
};
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}})}
