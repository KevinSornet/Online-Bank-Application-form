/**
 * Bank Application -> Google Sheet
 *
 * Paste this into the Google Sheet's Apps Script editor (Extensions -> Apps Script),
 * then Deploy -> New deployment -> Web app (Execute as: Me, Who has access: Anyone).
 * Copy the web app URL into config.js on the website.
 *
 * Each Save from the form writes one row. Saving the same application again
 * updates its row instead of adding a new one. Signatures (PNG) and a PDF of
 * the filled form are stored in Drive folders, and the sheet links to them.
 */

const SHEET_NAME = 'Applications';
const FOLDER_NAME = 'Bank Application Signatures';
const PDF_FOLDER_NAME = 'Bank Application PDFs';
const MAX_PDF = 20000000; // characters of base64 (~15 MB)
const MAX_FIELDS = 400;
const MAX_VALUE = 2000;
const MAX_SIGNATURE = 400000; // characters of base64

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const p = JSON.parse(e.postData.contents);
    if (!/^[0-9a-f-]{36}$/i.test(p.id || '')) throw new Error('Bad record id');
    if (!Array.isArray(p.fields) || p.fields.length > MAX_FIELDS) throw new Error('Bad fields');

    const values = {
      'Record ID': p.id,
      'Saved At': Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      'Branch': String(p.branch || '').slice(0, 100),
    };
    p.fields.forEach(([h, v]) => { values[String(h).slice(0, 200)] = String(v == null ? '' : v).slice(0, MAX_VALUE); });
    Object.entries(p.signatures || {}).forEach(([h, url]) => { values[String(h).slice(0, 200)] = saveSignature_(p.id, h, url); });
    if (p.pdf) values['Saved PDF'] = savePdf_(p.id, p.applicant, p.pdf);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    // Add any columns the sheet doesn't have yet.
    let headers = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    const missing = Object.keys(values).filter(h => headers.indexOf(h) === -1);
    if (missing.length) {
      sh.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
      headers = headers.concat(missing);
      sh.setFrozenRows(1);
    }

    // Update the row for this record if it exists, otherwise add a new row.
    const idCol = headers.indexOf('Record ID') + 1;
    let row = 0;
    if (sh.getLastRow() > 1) {
      const hit = sh.getRange(2, idCol, sh.getLastRow() - 1, 1)
        .createTextFinder(p.id).matchEntireCell(true).findNext();
      if (hit) row = hit.getRow();
    }
    if (!row) row = sh.getLastRow() + 1;

    // Text format keeps leading zeros; the apostrophe stops "=", "+", "-", "@" being read as formulas.
    const out = headers.map(h => asText_(h in values ? values[h] : ''));
    sh.getRange(row, 1, 1, out.length).setNumberFormat('@').setValues([out]);

    return json_({ ok: true, row: row });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, message: 'Bank application endpoint is running.' });
}

function saveSignature_(id, label, url) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(url || ''));
  if (!m || m[1].length > MAX_SIGNATURE) return '';
  const folder = getFolder_();
  const name = id + ' - ' + String(label).replace(/[^\w .-]/g, '') + '.png';
  const old = folder.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true);
  const blob = Utilities.newBlob(Utilities.base64Decode(m[1]), 'image/png', name);
  return folder.createFile(blob).getUrl();
}

function savePdf_(id, applicant, b64) {
  b64 = String(b64 || '');
  if (!b64 || b64.length > MAX_PDF || !/^[A-Za-z0-9+/=]+$/.test(b64)) return '';
  const folder = getFolder_(PDF_FOLDER_NAME);
  const tag = id.slice(0, 8);
  const old = folder.searchFiles("title contains '" + tag + "'");
  while (old.hasNext()) old.next().setTrashed(true);   // replace the earlier PDF of this application
  const who = String(applicant || 'Application').replace(/[^\w ,.\-ñÑ]/g, '').slice(0, 80);
  const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'application/pdf',
    'Bank Application - ' + who + ' - ' + tag + '.pdf');
  return folder.createFile(blob).getUrl();
}

function getFolder_(name) {
  name = name || FOLDER_NAME;
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function asText_(v) {
  v = String(v);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
