# Austin Home Intelligence — GitHub Pages V2

Lead-generation site for `austinhomeintelligence.com` built around this funnel:

**Address → satellite/property confirmation → Austin signals → relevant questions only → free Risk Assessment → email → deeper questions/photos/markers → free Action Plan → explicit quote request**

## What changed in V2

- Austin-forward homepage with more local personality while keeping the interface credible/technical.
- Address-first property reveal on every diagnostic.
- Satellite property view with a no-key fallback.
- When the U.S. Census geocoder returns coordinates, the site uses a free Leaflet + Esri World Imagery satellite map.
- Click-to-mark property concerns is enabled on geocoded maps; tree and pool Action Plans explicitly offer this step.
- The whole-home scan begins with a problem/category selector and dynamically assembles only relevant questions.
- No email gate before the free Risk Assessment.
- Risk Assessment shows the highest-priority area and system breakdown.
- Email is requested for the deeper customized Action Plan, not the initial risk score.
- Action Plan asks additional category-specific questions and allows up to 3 optional photos.
- Photos are compressed in-browser before backend submission.
- Quote request comes after the Action Plan and includes the accumulated property profile so a provider does not have to re-ask the same questions.
- Cloudflare Worker can write **all profile events to Google Sheets** while sending Slack only when someone explicitly requests professional contact.
- Google Apps Script integration can maintain both an append-only `Events` sheet and an updatable `PropertyProfiles` sheet.
- Optional Google Drive photo storage is supported by the Apps Script.
- Vendor and local-cost data schemas are included under `/data/` for the future Austin vendor/pricing intelligence layer.

## Static deployment on GitHub Pages

Upload the contents of this folder to the repository root.

GitHub:
1. **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: **main**
4. Folder: **/(root)**
5. Save

No `.github/workflows` folder is required for this static version.

The included `CNAME` contains `austinhomeintelligence.com`. If you are temporarily testing on another custom domain, GitHub Pages may rewrite the CNAME through the Pages settings. Set the final custom domain when the Austin Home Intelligence domain is ready.

## Lead/profile backend

The site works in demo mode with no backend, but events are only printed to the browser console until `leadEndpoint` is configured.

### 1. Deploy the Cloudflare Worker

Create a Worker and replace its code with `worker/worker.js`.

Set:

- `ALLOWED_ORIGINS` — e.g. `https://austinhomeintelligence.com,https://www.austinhomeintelligence.com`
- `SLACK_WEBHOOK_URL` — **secret**, optional; Slack is used only for explicit `service_lead` requests
- `SHEET_WEBHOOK_URL` — **secret or variable**, optional; deployed Google Apps Script Web App URL
- `SHEET_SHARED_SECRET` — **secret**, optional; must match the Apps Script property

Then put the Worker URL into `assets/config.js`:

```js
window.AHI_CONFIG = {
  leadEndpoint: "https://your-worker.workers.dev/",
  googleMapsEmbedKey: "",
  actionPlanMode: "rules",
  siteName: "Austin Home Intelligence",
  serviceArea: "Austin, Texas"
};
```

Never put the Slack webhook or Sheets shared secret in GitHub/client-side JavaScript.

## Google Sheets + Google Drive setup

The recommended data architecture is:

`Website → Cloudflare Worker → Google Apps Script → Google Sheets / optional Drive`

Slack receives only explicit quote/service requests.

1. Create a Google Spreadsheet.
2. Open **Extensions → Apps Script**.
3. Paste `integrations/google-apps-script.gs` into the project.
4. In Apps Script **Project Settings → Script Properties**, add:
   - `AHI_SHEET_ID` = the Spreadsheet ID
   - `AHI_SHARED_SECRET` = a long random value
   - optional `AHI_DRIVE_FOLDER_ID` = Drive folder ID for homeowner photos
5. **Deploy → New deployment → Web app**.
6. Execute as **Me**.
7. Access: **Anyone** (the shared secret is still checked inside the script).
8. Copy the Web App URL to the Worker's `SHEET_WEBHOOK_URL`.
9. Put the same secret into Worker `SHEET_SHARED_SECRET`.

The script creates:

### `Events`
Append-only event log containing:
- property/session IDs
- assessment and Action Plan events
- answers
- breakdown scores
- photos/markers
- contact/lead status
- source URL

### `PropertyProfiles`
One current row per property, designed for later export to AI/data analysis. It includes separate scores for HVAC, plumbing, pests, trees, ducts, moisture, pool and insurance when available.

## Mapping / property view

### Default
The site attempts to geocode a U.S. address with the free U.S. Census Geocoder. When matched, it renders:
- Leaflet
- Esri World Imagery satellite tiles
- property marker
- optional homeowner concern markers

If geocoding fails, the UI falls back to a Google Maps satellite embed URL and disables click-to-mark functionality.

### Optional Google Maps Embed key
Set `googleMapsEmbedKey` in `assets/config.js` to use Google's official Maps Embed API on fallback maps. Restrict that browser key to your website/domain and the Maps Embed API.

## Live/public data adapters included

`assets/property-data.js` is intentionally fault-tolerant. If an external source fails, the assessment still works.

Currently it attempts to use:

- **U.S. Census Geocoder** for address coordinates
- **National Weather Service API** for near-term weather context
- **City of Austin Issued Construction Permits** public Socrata dataset (`3syk-w9eu`) for address-search permit matches
- **City of Austin Wildfire Risk** ArcGIS layer for mapped-area context
- an explicit **Austin seasonal risk calendar** for the next 3–6 month maintenance context

Important: the seasonal calendar is a climatological/maintenance baseline, not a 3–6 month weather prediction. NWS data is used for actual near-term forecast signals.

## Vendor / pricing intelligence

No prices or vendors are fabricated in this build.

Templates are included:
- `data/vendor-database-template.csv`
- `data/service-cost-template.csv`

The intended future system can store verified Austin-area:
- company/service category
- ZIP/service area
- licenses/insurance verification
- ratings/review counts
- emergency availability
- diagnostic/minimum charges
- typical service/job price bands
- memberships
- lead economics
- last verification date

This can later drive Action Plan cost guidance and provider matching.

## Current Action Plan engine

V2 uses a transparent rule-based plan generator. It does **not** claim that a trained AI model is analyzing the property yet.

When a reviewed AI endpoint/vendor-and-cost database is connected, the same structured payload already contains the property profile, risk breakdown, homeowner answers, deep answers, photos and map markers needed for richer analysis.

## Before paid traffic

- Replace testing custom domain with `austinhomeintelligence.com`.
- Configure the Worker + Google Sheets.
- Test photo storage if using Drive.
- Add a real privacy/deletion contact method.
- Have privacy/consent language reviewed for actual vendor, insurance, SMS/email and AI processing arrangements.
- Configure analytics/Meta Pixel only after updating the privacy disclosures.
- Use named service providers in the final quote consent language when partner routing is known.
