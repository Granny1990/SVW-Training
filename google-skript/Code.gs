/**
 * Trainingsplan SV Westfalia Rhynern – Google-Skript
 * --------------------------------------------------
 * Liest und speichert das Blatt "Belegung" für die Webseite.
 *  - Jeder darf LESEN (für den öffentlichen Trainingsplan).
 *  - SPEICHERN nur mit Name + Passwort aus der Liste ADMINS.
 *  - Jede Speicherung wird im Blatt "Protokoll" vermerkt.
 *
 * Einrichtung: siehe ANLEITUNG.md im Repo.
 * Nach jeder Änderung an diesem Code: Bereitstellen > Bereitstellungen verwalten >
 * Bearbeiten (Stift) > Version "Neue Version" > Bereitstellen.
 */

// ===== HIER ANPASSEN =====
// Name: Passwort. Der Name wird beim Login eingegeben (Groß-/Kleinschreibung egal).
const ADMINS = {
  "Jan": "BITTE-AENDERN"
};
// =========================

const SHEET_NAME = "Belegung";
const LOG_NAME = "Protokoll";
const HEADER = ["Woche ab (Montag)","Tag","Platz","Mannschaft","Beginn","Dauer (Min.)","Offenes Ende","Platzanteil","Status","Hinweis","Art","Gegner"];
const DAYS = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag"];
const PITCHES = ["Kleinspielfeld","Rasenplatz 1","Rasenplatz 2","Stadion","Kunstrasen 1","Kunstrasen 2"];
const SHARES = ["ganz","halb","viertel","1/3 d.H.","2/3 d.H."]; // d.H. = der Hälfte
const STATUSES = ["findet statt","abgesagt","Platz gesperrt"];
const ARTS = ["Training","Spiel"];

function doGet() {
  try {
    const sh = sheet_();
    const props = PropertiesService.getScriptProperties().getProperties();
    const versions = {};
    Object.keys(props).forEach(function (k) { if (k.indexOf("v_") === 0) versions[k.slice(2)] = props[k]; });
    return json_({ ok: true, rows: sh.getDataRange().getDisplayValues(), updated: props.LAST_SAVE || null, versions: versions, features: ["spiele", "drittel"] });
  } catch (err) {
    return json_({ ok: false, error: "lesen", detail: String(err) });
  }
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "bad_request" }); }
  const who = auth_(req);
  if (!who) { Utilities.sleep(1500); return json_({ ok: false, error: "auth" }); }
  if (req.action === "check") return json_({ ok: true, name: who });
  if (req.action === "save") {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) return json_({ ok: false, error: "busy" });
    try { return json_(saveWeek_(req, who)); }
    catch (err) { return json_({ ok: false, error: "speichern", detail: String(err) }); }
    finally { lock.releaseLock(); }
  }
  return json_({ ok: false, error: "unknown_action" });
}

function auth_(req) {
  const name = String(req.name || "").trim().toLowerCase();
  const pw = String(req.password || "");
  for (const k in ADMINS) {
    if (k.toLowerCase() === name && ADMINS[k] === pw && pw && pw !== "BITTE-AENDERN") return k;
  }
  return null;
}

function saveWeek_(req, who) {
  const week = String(req.week || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return { ok: false, error: "week" };
  const monday = isoToDate_(week);
  if (monday.getUTCDay() !== 1) return { ok: false, error: "week" };

  const props = PropertiesService.getScriptProperties();
  const vKey = "v_" + week;
  const current = props.getProperty(vKey) || "";
  if (req.base !== undefined && req.base !== null && String(req.base) !== current) {
    return { ok: false, error: "conflict", version: current };
  }

  const rows = Array.isArray(req.rows) ? req.rows : [];
  if (rows.length > 300) return { ok: false, error: "too_many" };
  const fresh = [];
  for (let i = 0; i < rows.length; i++) {
    const r = clean_(rows[i]);
    if (!r) return { ok: false, error: "row", row: i };
    fresh.push([monday, r.tag, r.platz, r.team, r.beginn, r.dauer, r.offen, r.anteil, r.status, r.hinweis, r.art, r.gegner]);
  }

  const sh = sheet_();
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const last = sh.getLastRow();
  const old = last > 1 ? sh.getRange(2, 1, last - 1, HEADER.length).getValues() : [];
  const keep = [];
  old.forEach(function (r) {
    if (r.join("") === "") return;
    const wk = weekKeyOf_(r[0], tz);
    if (wk === week) return;
    keep.push([wk ? isoToDate_(wk) : r[0], r[1], r[2], r[3], timeText_(r[4], tz), r[5], r[6], r[7], r[8], r[9], r[10], r[11]]);
  });

  const all = keep.concat(fresh);
  all.sort(function (a, b) {
    const da = a[0] instanceof Date ? a[0].getTime() : 0, db = b[0] instanceof Date ? b[0].getTime() : 0;
    if (da !== db) return da - db;
    const ta = DAYS.indexOf(a[1]), tb = DAYS.indexOf(b[1]);
    if (ta !== tb) return ta - tb;
    const pa = PITCHES.indexOf(a[2]), pb = PITCHES.indexOf(b[2]);
    if (pa !== pb) return pa - pb;
    return String(a[4]).localeCompare(String(b[4]));
  });

  if (last > 1) sh.getRange(2, 1, last - 1, HEADER.length).clearContent();
  if (all.length) {
    sh.getRange(2, 1, all.length, 1).setNumberFormat("dd.MM.yyyy");
    sh.getRange(2, 5, all.length, 1).setNumberFormat("@");
    sh.getRange(2, 1, all.length, HEADER.length).setValues(all);
  }

  const version = new Date().toISOString();
  props.setProperty(vKey, version);
  props.setProperty("LAST_SAVE", version);
  log_(who, week, fresh.length);
  return { ok: true, version: version, updated: version };
}

function clean_(r) {
  if (!r || typeof r !== "object") return null;
  const tag = String(r.tag || ""), platz = String(r.platz || ""), status = String(r.status || "findet statt");
  if (DAYS.indexOf(tag) < 0 || PITCHES.indexOf(platz) < 0 || STATUSES.indexOf(status) < 0) return null;
  if (status === "Platz gesperrt") return { tag: tag, platz: platz, team: "", beginn: "", dauer: "", offen: "", anteil: "", status: status, hinweis: "", art: "", gegner: "" };
  const team = safe_(r.team, 40);
  const beginn = String(r.beginn || "");
  const dauer = parseInt(r.dauer, 10);
  const anteil = String(r.anteil || "ganz");
  const art = String(r.art || "Training");
  if (!team || !/^\d{1,2}:\d{2}$/.test(beginn) || !(dauer >= 15 && dauer <= 300) || SHARES.indexOf(anteil) < 0 || ARTS.indexOf(art) < 0) return null;
  return { tag: tag, platz: platz, team: team, beginn: beginn, dauer: dauer, offen: r.offen ? "ja" : "", anteil: anteil, status: status, hinweis: safe_(r.hinweis, 120),
           art: art, gegner: art === "Spiel" ? safe_(r.gegner, 60) : "" };
}

// Text ohne Formel-Anfang, gekürzt
function safe_(v, max) {
  let s = String(v || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  // Kopfzeile ergänzen (z. B. die Spalten "Art" und "Gegner" in älteren Tabellen)
  const head = sh.getRange(1, 1, 1, HEADER.length).getDisplayValues()[0];
  if (head.some(function (h, i) { return h === "" && HEADER[i]; })) {
    sh.getRange(1, 1, 1, HEADER.length).setValues([head.map(function (h, i) { return h || HEADER[i]; })]);
  }
  return sh;
}

function log_(who, week, count) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(LOG_NAME);
  if (!sh) { sh = ss.insertSheet(LOG_NAME); sh.appendRow(["Zeitpunkt", "Name", "Woche ab", "Einträge"]); }
  sh.appendRow([new Date(), who, week, count]);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Datum als 12 Uhr mittags UTC: zeigt in jeder Zeitzone Europas/Amerikas denselben Kalendertag.
function isoToDate_(s) { const p = s.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)); }

function toDate_(v) {
  if (v instanceof Date) return v;
  const m = String(v || "").trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12)) : null;
}

// Montag der Woche, in der Zeitzone der Tabelle. Sa/So zählen zur folgenden Woche
// (repariert Montage, die früher durch eine Zeitzonen-Verschiebung als Sonntag gespeichert wurden).
function weekKeyOf_(v, tz) {
  let d = toDate_(v);
  if (!d) return "";
  if (v instanceof Date) d = isoToDate_(Utilities.formatDate(v, tz, "yyyy-MM-dd"));
  const dow = d.getUTCDay();
  const shift = dow === 0 ? 1 : dow === 6 ? 2 : -((dow + 6) % 7);
  const mon = new Date(d.getTime() + shift * 86400000);
  return mon.toISOString().slice(0, 10);
}

function timeText_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, "HH:mm");
  return v === null || v === undefined ? "" : String(v);
}

/**
 * EINMALIG im Editor ausführen: stellt alle Trainings mit 75 Minuten auf 90 Minuten um.
 * Spiele und andere Dauern (z. B. 105 Minuten) bleiben unverändert.
 */
function trainingsAuf90Minuten() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return;
  const range = sh.getRange(2, 6, last - 1, 7); // Spalten F (Dauer) bis L (Art)
  const vals = range.getValues();
  let n = 0;
  vals.forEach(function (r) { if (Number(r[0]) === 75 && r[6] !== "Spiel") { r[0] = 90; n++; } });
  sh.getRange(2, 6, last - 1, 1).setValues(vals.map(function (r) { return [r[0]]; }));
  const props = PropertiesService.getScriptProperties();
  const version = new Date().toISOString();
  Object.keys(props.getProperties()).forEach(function (k) { if (k.indexOf("v_") === 0) props.setProperty(k, version); });
  props.setProperty("LAST_SAVE", version);
  Logger.log(n + " Trainings auf 90 Minuten umgestellt.");
}

/** Zum Testen im Editor: Funktion "testLesen" auswählen und Ausführen. */
function testLesen() {
  Logger.log(doGet().getContent().slice(0, 500));
}
