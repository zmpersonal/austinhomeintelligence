/**
 * Austin Home Intelligence -> Google Sheets / Drive webhook.
 * Deploy this Apps Script as a Web App: Execute as Me, access Anyone.
 * Script Properties required:
 *   AHI_SHEET_ID = destination Google Spreadsheet ID
 *   AHI_SHARED_SECRET = same value as Cloudflare Worker SHEET_SHARED_SECRET
 * Optional:
 *   AHI_DRIVE_FOLDER_ID = Drive folder where compressed homeowner photos are stored
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty('AHI_SHARED_SECRET') || '';
    if (expected && body.sheetToken !== expected) return json_({ok:false,error:'Unauthorized'});
    delete body.sheetToken;

    var ss = SpreadsheetApp.openById(props.getProperty('AHI_SHEET_ID'));
    var photoUrls = savePhotos_(body, props.getProperty('AHI_DRIVE_FOLDER_ID'));
    body.photoUrls = photoUrls;
    appendEvent_(ss, body);
    upsertProfile_(ss, body);
    return json_({ok:true,photoUrls:photoUrls});
  } catch (err) {
    return json_({ok:false,error:String(err && err.message ? err.message : err)});
  }
}

function appendEvent_(ss, b) {
  var headers = ['created_at','event_type','event','property_id','session_id','tool','service','address','first_name','email','phone','contact_preference','timing','score','status','top_priority','selected_concerns','breakdown_json','answers_json','deep_answers_json','signals_json','markers_json','photo_urls','source'];
  var sh = getSheet_(ss,'Events',headers);
  sh.appendRow([
    b.createdAt || new Date().toISOString(), b.type || '', b.event || '', b.propertyId || '', b.sessionId || '', b.tool || '', b.service || '', b.address || '', b.firstName || '', b.email || '', b.phone || '', b.contactPreference || '', b.timing || '', val_(b.score), b.status || '', b.topPriority || '',
    list_(b.selectedConcerns), JSON.stringify(b.breakdown || []), JSON.stringify(b.answers || {}), JSON.stringify(b.deepAnswers || {}), JSON.stringify(b.signals || {}), JSON.stringify(b.markers || []), list_(b.photoUrls), b.source || ''
  ]);
}

function upsertProfile_(ss, b) {
  if (!b.propertyId) return;
  var headers = ['property_id','last_seen','address','first_name','email','phone','selected_concerns','top_priority','overall_score','overall_status','hvac_score','plumbing_score','pest_score','tree_score','ducts_score','moisture_score','pool_score','insurance_score','wants_contact','timing','answers_json','deep_answers_json','signals_json','markers_json','photo_urls','last_source'];
  var sh = getSheet_(ss,'PropertyProfiles',headers);
  var row = findRow_(sh, b.propertyId);
  var existing = row > 1 ? sh.getRange(row,1,1,headers.length).getValues()[0] : new Array(headers.length).fill('');
  var obj = {}; headers.forEach(function(h,i){obj[h]=existing[i]});
  obj.property_id=b.propertyId;
  obj.last_seen=b.createdAt || new Date().toISOString();
  obj.address=b.address || obj.address;
  obj.first_name=b.firstName || obj.first_name;
  obj.email=b.email || obj.email;
  obj.phone=b.phone || obj.phone;
  obj.selected_concerns=list_(b.selectedConcerns) || obj.selected_concerns;
  obj.top_priority=b.topPriority || obj.top_priority;
  if (b.score !== undefined && b.score !== null) obj.overall_score=b.score;
  obj.overall_status=b.status || obj.overall_status;
  (b.breakdown || []).forEach(function(x){var key=x.category+'_score';if(headers.indexOf(key)>=0)obj[key]=x.score});
  obj.wants_contact=b.type==='service_lead' ? 'YES' : obj.wants_contact;
  obj.timing=b.timing || obj.timing;
  if (b.answers) obj.answers_json=JSON.stringify(b.answers);
  if (b.deepAnswers) obj.deep_answers_json=JSON.stringify(b.deepAnswers);
  if (b.signals) obj.signals_json=JSON.stringify(b.signals);
  if (b.markers && b.markers.length) obj.markers_json=JSON.stringify(b.markers);
  if (b.photoUrls && b.photoUrls.length) obj.photo_urls=list_(b.photoUrls);
  obj.last_source=b.source || obj.last_source;
  var values=headers.map(function(h){return obj[h] === undefined ? '' : obj[h]});
  if (row > 1) sh.getRange(row,1,1,headers.length).setValues([values]); else sh.appendRow(values);
}

function savePhotos_(b, folderId) {
  if (!folderId || !b.photos || !b.photos.length) return [];
  var folder = DriveApp.getFolderById(folderId);
  var urls=[];
  b.photos.slice(0,3).forEach(function(p,i){
    if (!p.dataUrl) return;
    var safe=(b.propertyId || 'property')+'_'+(b.sessionId || 'session')+'_'+i+'_'+String(p.name || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g,'_');
    var existing=folder.getFilesByName(safe);
    if(existing.hasNext()){urls.push(existing.next().getUrl());return;}
    var parts=p.dataUrl.match(/^data:([^;]+);base64,(.+)$/);if(!parts)return;
    var blob=Utilities.newBlob(Utilities.base64Decode(parts[2]),parts[1],safe);
    var file=folder.createFile(blob);urls.push(file.getUrl());
  });
  return urls;
}

function getSheet_(ss,name,headers){
  var sh=ss.getSheetByName(name)||ss.insertSheet(name);
  if(sh.getLastRow()===0){sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1)}
  return sh;
}
function findRow_(sh,id){if(sh.getLastRow()<2)return -1;var found=sh.getRange(2,1,sh.getLastRow()-1,1).createTextFinder(String(id)).matchEntireCell(true).findNext();return found?found.getRow():-1}
function list_(v){return Array.isArray(v)?v.join(' | '):(v||'')}
function val_(v){return v===undefined||v===null?'':v}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
