# Austin Home Intelligence — GitHub Pages V1

Lead-generation-focused static site for `austinhomeintelligence.com`.

## Included

- Homepage with whole-home address entry and eight service-specific diagnostic funnels
- Whole-Home Risk Scan
- AC Life Check
- Plumbing Risk Check
- Pest Identifier
- Tree Risk Check
- Duct Cleaning Test
- Moisture Risk Check
- Pool Loss Check
- Home Insurance Checkup
- Preliminary result before email capture
- Email/report lead capture
- Final score + findings + conditional professional-help offer
- Service-lead form with phone, preferred contact, timing, and explicit opt-in
- Cloudflare Worker template for safely routing leads to Slack without exposing a webhook secret
- Privacy, disclaimer, robots.txt, sitemap.xml and CNAME

## GitHub Pages

Upload the files in this folder to the repository root. In GitHub:

1. Settings → Pages
2. Deploy from branch
3. Select the main branch / root
4. Set the custom domain to `austinhomeintelligence.com`

The included `CNAME` already contains the domain.

## Connect lead delivery

The site intentionally ships in demo mode so no secret is exposed in client-side JavaScript.

1. Create a Cloudflare Worker.
2. Replace its code with `worker/worker.js`.
3. In Worker Settings → Variables and Secrets, create a **secret** named `SLACK_WEBHOOK_URL` containing your Slack incoming webhook URL.
4. Add a normal variable `ALLOWED_ORIGIN` with `https://austinhomeintelligence.com`.
5. Deploy the Worker.
6. Open `assets/config.js` and paste the Worker URL into `leadEndpoint`.

Example:

```js
window.AHI_CONFIG = {
  leadEndpoint: "https://ahi-leads.your-subdomain.workers.dev/",
  siteName: "Austin Home Intelligence",
  serviceArea: "Austin, Texas"
};
```

Do **not** put the Slack webhook itself in `assets/config.js` or any GitHub file.

## Lead types

`report_lead` is sent after a user sees a preliminary result and supplies name/email to finish the assessment.

`service_lead` is sent only when the user explicitly requests professional contact. It includes service category, score, phone, contact preference, timing and assessment answers.

## Important before paid traffic

- Replace the privacy-policy placeholder contact language with the actual business/contact email.
- Have final consent/privacy wording reviewed for your actual lead-routing, SMS/email, insurance and contractor arrangements.
- Configure analytics/pixels only after updating privacy disclosures.
- Replace generic “participating Austin-area professional” language with named providers when partnerships are finalized; this will usually improve trust and lead conversion.

## Next build phases intentionally excluded

Per project scope, this V1 does not yet include the annual Austin report, paid maintenance alerts, $19/month software, or paid upsells.
