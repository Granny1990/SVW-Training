/* Gemeinsamer Code für Trainingsplan (index.html) und Admin (admin.html). */
"use strict";
const CFG = window.SVW_CONFIG || {};
const PITCHES = [
  {id:"kf", short:"Klein",   name:"Kleinspielfeld", area:"Westfalia Sportpark"},
  {id:"r1", short:"Rasen 1", name:"Rasenplatz 1",   area:"Sportpark · Vereinsheimseite", pair:"rasen"},
  {id:"r2", short:"Rasen 2", name:"Rasenplatz 2",   area:"Sportpark · Rhynernseite", pair:"rasen"},
  {id:"st", short:"Stadion", name:"Stadion",        area:"Kümpel-Hellmeister-Arena", request:true},
  {id:"k1", short:"Kunst 1", name:"Kunstrasen 1",   area:"Campus powered by Munk · Vereinsheimseite", pair:"kunst"},
  {id:"k2", short:"Kunst 2", name:"Kunstrasen 2",   area:"Campus powered by Munk · Rhynernseite", pair:"kunst"}
];
const TRAIN_DUR = 90, GAME_DUR = 120;
const FOOTER = "Änderungen witterungsbedingt vorbehalten.";
const DAYS = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag"];
const DSHORT = ["Mo","Di","Mi","Do","Fr"];
/* Jede Mannschaft eine eigene Farbe. Schriftfarbe (hell/dunkel) wird nach Kontrast gewählt. */
const TEAM_COLORS = {
  "A1":"#2e9e44", "A2":"#a3d977",
  "B1":"#f07d1a", "B2":"#7b4fc9",
  "C1":"#f5c518", "C2":"#8c1d40",
  "D1":"#d6309f", "D2":"#d93b2b", "D3":"#139e9b",
  "E1":"#3b9de6", "E2":"#9fe0d6", "E3":"#b38ce6",
  "F1":"#f7a08c", "F2":"#e6d3a3", "Minis":"#f7b6d2",
  "1.M":"#275aa2", "2.M":"#1c2a48", "Dritte":"#6b7a99",
  "Alte Herren":"#7a5230", "Walking Football":"#5f7d2a"
};
/* Für Mannschaften, die nicht oben stehen: feste Farbe aus dem Namen. */
const EXTRA_COLORS = ["#00838f","#ad1457","#ef6c00","#558b2f","#4527a0","#9e9d24","#6d4c41","#c2185b"];
/* Platzanteile. "d.H." = der Hälfte: ⅓ bzw. ⅔ einer Platzhälfte. */
const SHARE_LABEL = {"1/2":"½ Platz","1/4":"¼ Platz","h13":"⅓ d.H.","h23":"⅔ d.H."};
const SHARE_SHORT = {"1/2":"½","1/4":"¼","h13":"⅓ d.H.","h23":"⅔ d.H."};
const SHARE_WORD = {"1/2":"halb","1/4":"viertel","h13":"1/3 d.H.","h23":"2/3 d.H."};

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const el = (tag, attrs={}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "style") n.style.cssText = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, "");
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};
const toMin = t => { const [h,m] = t.split(":").map(Number); return h*60+m; };
const fmt = m => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
const pad = n => String(n).padStart(2,"0");
const parseISO = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const dm = d => `${pad(d.getDate())}.${pad(d.getMonth()+1)}.`;
const mondayOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay()+6)%7)); };
/* Woche zu einem Datum in Spalte "Woche ab". Sa/So zählen zur folgenden Woche
   (ein Montag, der durch eine Zeitzonen-Verschiebung als Sonntag gespeichert wurde). */
const weekKeyOf = d => { const wd = d.getDay(); return isoDate(mondayOf(wd===0 ? addDays(d,1) : wd===6 ? addDays(d,2) : d)); };
function inkOn(hex){
  const lin = c => { c /= 255; return c <= .03928 ? c/12.92 : ((c+.055)/1.055)**2.4; };
  const n = parseInt(hex.slice(1),16); const L = .2126*lin(n>>16)+.7152*lin((n>>8)&255)+.0722*lin(n&255);
  return (L+.05)/.0625 >= 1.05/(L+.05) ? "#16203a" : "#ffffff";
}
function colorOf(team){
  let bg = TEAM_COLORS[team];
  if (!bg){ let h = 0; for (const ch of String(team)) h = (h*31 + ch.charCodeAt(0)) >>> 0; bg = EXTRA_COLORS[h % EXTRA_COLORS.length]; }
  return [bg, inkOn(bg)];
}
const gameLabel = s => "Spiel" + (s.opp ? " gg. " + s.opp : "");
const pitch = id => PITCHES.find(p => p.id === id);
/* Zusammengehörige Plätze (Rasen 1+2, Kunstrasen 1+2) werden farblich als Block dargestellt. */
const pairCls = p => p.pair ? " pair-" + p.pair : "";
const byTime = (a,b) => toMin(a.t)-toMin(b.t);
const startLabel = s => (s.ab ? "ab " : "") + s.t;
const store = { get(k){ try { return localStorage.getItem(k); } catch { return null; } },
                set(k,v){ try { localStorage.setItem(k,v); } catch {} } };
const sstore = { get(k){ try { return sessionStorage.getItem(k); } catch { return null; } },
                 set(k,v){ try { sessionStorage.setItem(k,v); } catch {} },
                 del(k){ try { sessionStorage.removeItem(k); } catch {} } };
function toast(msg, ms=2600){
  const h = $("#toastHost"); h.replaceChildren(el("div",{class:"toast",role:"status"},msg));
  clearTimeout(toast.t); toast.t = setTimeout(()=>h.replaceChildren(), ms);
}
function teamTag(t){ const [bg,fg] = colorOf(t); return el("span",{class:"tag",style:`background:${bg};color:${fg}`}, t); }
function teamSort(a,b){
  const rank = t => /^[A-F]\d$/.test(t) ? "0"+t : /^\d\.M$/.test(t) ? "1"+t : "2"+t;
  return rank(a).localeCompare(rank(b),"de");
}

/* ---------- rows -> plan ---------- */
function parseCSV(text){
  const rows = []; let row = [], f = "", q = false;
  for (let i=0; i<text.length; i++){
    const c = text[i];
    if (q){ if (c === '"'){ if (text[i+1] === '"'){ f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ""; }
    else if (c === '\n' || c === '\r'){ if (c === '\r' && text[i+1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f !== "" || row.length){ row.push(f); rows.push(row); }
  return rows;
}
const norm = s => String(s ?? "").trim().toLowerCase();
function parseDate(v){
  v = String(v ?? "").trim(); let m;
  if ((m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/))) return new Date(+(m[3].length===2?"20"+m[3]:m[3]), +m[2]-1, +m[1]);
  if ((m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(+m[1], +m[2]-1, +m[3]);
  if ((m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return new Date(+m[3], +m[1]-1, +m[2]);
  return null;
}
function buildPlanFromRows(rowsIn){
  const rows = rowsIn.map(r => r.map(c => String(c ?? ""))).filter(r => r.some(c => c.trim() !== ""));
  if (!rows.length) return {weeks:{}};
  const H = rows[0].map(norm);
  const col = name => H.findIndex(h => h.startsWith(name));
  const C = {w:col("woche"), d:col("tag"), p:col("platz"), team:col("mannschaft"), t:col("beginn"),
             dur:col("dauer"), ab:col("offenes"), share:col("platzanteil"), st:col("status"), note:col("hinweis"),
             art:col("art"), opp:col("gegner")};
  if (C.w<0 || C.d<0 || C.p<0) throw new Error("spalten");
  const weeks = {}; let n = 0;
  for (const r of rows.slice(1)){
    const date = parseDate(r[C.w]); if (!date) continue;
    const key = weekKeyOf(date);
    const d = DAYS.findIndex(x => norm(x) === norm(r[C.d]) || norm(x).slice(0,2) === norm(r[C.d]).slice(0,2));
    const p = PITCHES.find(x => norm(x.name) === norm(r[C.p]));
    if (d < 0 || !p) continue;
    const wk = weeks[key] ||= {closed:{}, slots:[]};
    const status = norm(r[C.st]);
    if (status.startsWith("platz gesperrt") || status === "gesperrt"){ wk.closed[`${p.id}-${d}`] = "Gesperrt"; continue; }
    const tm = (r[C.t]||"").match(/(\d{1,2})[:.](\d{2})/); const team = (r[C.team]||"").trim();
    if (!tm || !team) continue;
    const dur = parseInt(r[C.dur],10); const game = C.art >= 0 && norm(r[C.art]) === "spiel";
    wk.slots.push({id:"r"+(n++), d, p:p.id, team, t:`${pad(+tm[1])}:${tm[2]}`, dur: dur>=15 && dur<=300 ? dur : game ? GAME_DUR : TRAIN_DUR,
      ab: norm(r[C.ab]) === "ja", share: {"halb":"1/2", "viertel":"1/4", "1/3 d.h.":"h13", "2/3 d.h.":"h23"}[norm(r[C.share])],
      off: status === "abgesagt", note:(r[C.note]||"").trim() || undefined,
      game: game || undefined, opp: game ? ((r[C.opp]||"").trim() || undefined) : undefined});
  }
  return {weeks};
}

/* Lädt den Plan: über das Google-Skript (aktuell) oder das veröffentlichte CSV (Notlösung). */
async function loadPlanData(){
  if (CFG.SCRIPT_URL){
    const r = await fetch(CFG.SCRIPT_URL + (CFG.SCRIPT_URL.includes("?") ? "&" : "?") + "t=" + Date.now());
    if (!r.ok) throw new Error("http");
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "skript");
    const plan = buildPlanFromRows(j.rows || []);
    return {plan, updated: j.updated ? new Date(j.updated) : null, versions: j.versions || {}, features: j.features || []};
  }
  if (!CFG.CSV_URL) throw new Error("keine Quelle");
  const r = await fetch(CFG.CSV_URL + (CFG.CSV_URL.includes("?") ? "&" : "?") + "t=" + Date.now());
  if (!r.ok) throw new Error("http");
  return {plan: buildPlanFromRows(parseCSV(await r.text())), updated: null, versions: {}, features: []};
}

/* ---------- logic ---------- */
/* Überschneidungen (derzeit nicht angezeigt). */
function conflicts(slots){
  const bad = new Set();
  for (let i=0;i<slots.length;i++) for (let j=i+1;j<slots.length;j++){
    const a=slots[i], b=slots[j];
    if (a.p!==b.p || a.d!==b.d || a.off || b.off || (a.share && b.share)) continue;
    const as=toMin(a.t), ae=as+a.dur, bs=toMin(b.t), be=bs+b.dur;
    if (as<be && bs<ae){ bad.add(a.id); bad.add(b.id); }
  }
  return bad;
}
function currentWeekKey(){
  const now = new Date(); const wd = now.getDay();
  return isoDate((wd===0||wd===6) ? addDays(mondayOf(now),7) : mondayOf(now));
}

/* ---------- PDF / Drucken ----------
   Eigenes Druckblatt (A4 quer) für die angezeigte Woche. Im Druckfenster "Als PDF speichern" bzw. am Handy "Teilen". */
const PRINT_CSS = `
#printSheet{display:none}
@media print{
  @page{size:A4 landscape;margin:8mm}
  body > *:not(#printSheet){display:none!important}
  html,body{height:auto!important;background:#fff!important;overflow:visible!important}
  #printSheet{display:block;color:#141a2b;font:8.5pt/1.25 "Barlow",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pr-head{display:flex;align-items:center;gap:4mm;border-bottom:1mm solid #275aa2;padding-bottom:2mm;margin-bottom:2.5mm}
  .pr-head img{height:15mm;width:auto}
  .pr-head small{display:block;font:600 8pt/1 "Barlow Condensed",Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#275aa2}
  .pr-head b{display:block;font:700 20pt/1 "Barlow Condensed",Arial,sans-serif;text-transform:uppercase;margin-top:.6mm}
  .pr-range{margin-left:auto;text-align:right;font:700 15pt/1.1 "Barlow Condensed",Arial,sans-serif}
  .pr-range small{color:#5b6478;letter-spacing:0;text-transform:none;font:500 8pt "Barlow",Arial,sans-serif;margin-top:1mm}
  .pr-draft{color:#b4530b!important;font-weight:700!important}
  table.pr{width:100%;border-collapse:collapse;table-layout:fixed}
  .pr th,.pr td{border:.25mm solid #c9d1e0;vertical-align:top;padding:1mm}
  .pr thead th{background:#275aa2;color:#fff;font:700 10.5pt/1 "Barlow Condensed",Arial,sans-serif;text-transform:uppercase;text-align:left;padding:1.6mm 1.4mm}
  .pr thead th small{font:500 8pt "Barlow",Arial,sans-serif;opacity:.85;margin-left:1mm;text-transform:none}
  .pr th.pl{width:27mm;background:#f2f5fa;text-align:left;vertical-align:middle}
  .pr th.pl b{display:block;font:700 10pt/1.05 "Barlow Condensed",Arial,sans-serif;text-transform:uppercase}
  .pr th.pl small{display:block;font-weight:400;font-size:6.5pt;color:#5b6478;line-height:1.2;margin-top:.5mm}
  .pr tr.pair-rasen td,.pr tr.pair-rasen th{background:#edf5ea}
  .pr tr.pair-kunst td,.pr tr.pair-kunst th{background:#eaf0f9}
  .pr tr.pair-rasen th.pl,.pr tr.pair-kunst th.pl{padding-left:2.8mm}
  .pr tr.pair-rasen th.pl{box-shadow:inset 1.4mm 0 0 #4a9a52}
  .pr tr.pair-kunst th.pl{box-shadow:inset 1.4mm 0 0 #275aa2}
  .pr tr{break-inside:avoid}
  thead{display:table-header-group}
  .pr-s{display:flex;flex-wrap:wrap;align-items:center;gap:0 1.2mm;border-radius:1mm;padding:.7mm 1.3mm;margin-bottom:.8mm}
  .pr-s b{font:700 9.5pt/1.1 "Barlow Condensed",Arial,sans-serif}
  .pr-s i{font-style:normal;font-size:7pt;opacity:.9}
  .pr-s em{font:700 6.5pt/1 "Barlow Condensed",Arial,sans-serif;font-style:normal;letter-spacing:.06em;text-transform:uppercase;padding:.3mm .8mm;border-radius:.6mm}
  .pr-s .t{margin-left:auto;font:600 8.5pt/1.1 "Barlow Condensed",Arial,sans-serif;white-space:nowrap}
  .pr-s .sub{flex-basis:100%;font-size:6.8pt;line-height:1.2}
  .pr-s.off{background:#fff!important;color:#b3261e!important;box-shadow:inset 0 0 0 .25mm #b3261e}
  .pr-s.off b,.pr-s.off .t{text-decoration:line-through}
  .pr-fill{font:600 8pt/1 "Barlow Condensed",Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;text-align:center;padding:1.6mm 0;color:#b3261e}
  .pr-fill.req{color:#5b6478}
  .pr-foot{margin-top:2mm;font-size:7.5pt;color:#5b6478;display:flex;gap:4mm;justify-content:space-between}
}`;
function printWeek(w, weekKey, info){
  if (!document.getElementById("print-css")) document.head.append(el("style",{id:"print-css"}, PRINT_CSS));
  const mon = parseISO(weekKey); const fri = addDays(mon,4);
  const head = el("div",{class:"pr-head"},
    el("img",{src:"logo.svg",alt:""}),
    el("div",{}, el("small",{},"SV Westfalia Rhynern e.V."), el("b",{},"Trainingsplan")),
    el("div",{class:"pr-range"}, `${dm(mon)} – ${dm(fri)}${fri.getFullYear()}`,
      el("small",{class:info.draft ? "pr-draft" : ""}, info.stand || "")));
  const thead = el("thead",{}, el("tr",{}, el("th",{class:"pl"}),
    ...DAYS.map((n,d)=>el("th",{}, n, el("small",{},dm(addDays(mon,d)))))));
  const tbody = el("tbody",{});
  for (const p of PITCHES){
    const tr = el("tr",{class:p.pair ? "pair-"+p.pair : ""}, el("th",{class:"pl"}, el("b",{},p.name), el("small",{},p.area)));
    for (let d=0; d<5; d++){
      const td = el("td",{}); const ps = w.slots.filter(s=>s.p===p.id && s.d===d).sort(byTime);
      const closed = w.closed[`${p.id}-${d}`];
      if (closed) td.append(el("div",{class:"pr-fill"},closed));
      else if (p.request && !ps.length) td.append(el("div",{class:"pr-fill req"},"nach Rücksprache"));
      for (const s of ps){
        const [bg,fg] = colorOf(s.team);
        const sub = [s.game && s.opp ? "gg. "+s.opp : null, s.off ? "abgesagt" : null, s.note].filter(Boolean).join(" · ");
        td.append(el("div",{class:"pr-s"+(s.off?" off":""),style:`background:${bg};color:${fg}`},
          el("b",{},s.team), s.game ? el("em",{style:`background:${fg};color:${bg}`},"Spiel") : null,
          s.share ? el("i",{},SHARE_SHORT[s.share]) : null,
          el("span",{class:"t"}, startLabel(s)),
          sub ? el("span",{class:"sub"},sub) : null));
      }
      tr.append(td);
    }
    tbody.append(tr);
  }
  const foot = el("div",{class:"pr-foot"},
    el("span",{}, FOOTER, " Platzanteil: ½ · ¼ · ⅓/⅔ d.H. (der Hälfte)."));
  const sheet = el("div",{id:"printSheet"}, head, el("table",{class:"pr"}, thead, tbody), foot);
  document.getElementById("printSheet")?.remove(); document.body.append(sheet);
  const title = document.title;
  document.title = `Trainingsplan SVW ${isoDate(mon)}`;       // Vorschlag für den Dateinamen
  window.addEventListener("afterprint", () => { document.title = title; }, {once:true});
  const img = sheet.querySelector("img");
  const go = () => setTimeout(() => window.print(), 50);
  if (img.complete) go(); else { img.onload = go; img.onerror = go; }
}
