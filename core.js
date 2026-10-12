/* Gemeinsamer Code für Trainingsplan (index.html) und Admin (admin.html). */
"use strict";
const CFG = window.SVW_CONFIG || {};
const PITCHES = [
  {id:"kf", short:"Klein",   name:"Kleinspielfeld", area:"Westfalia Sportpark"},
  {id:"r1", short:"Rasen 1", name:"Rasenplatz 1",   area:"Sportpark · Vereinsheimseite"},
  {id:"r2", short:"Rasen 2", name:"Rasenplatz 2",   area:"Sportpark · Rhynernseite"},
  {id:"st", short:"Stadion", name:"Stadion",        area:"Kümpel-Hellmeister-Arena", request:true},
  {id:"k1", short:"Kunst 1", name:"Kunstrasen 1",   area:"Campus powered by Munk · Vereinsheimseite"},
  {id:"k2", short:"Kunst 2", name:"Kunstrasen 2",   area:"Campus powered by Munk · Rhynernseite"}
];
const FOOTER = "Trainingszeit 75 min. Änderungen witterungsbedingt vorbehalten.";
const DAYS = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag"];
const DSHORT = ["Mo","Di","Mi","Do","Fr"];
const TEAM_COLORS = {
  "A1":["#2fae3c","#0d2410"], "A2":["#8fd3c9","#0f2b27"],
  "B1":["#ee8a2a","#2b1500"], "B2":["#7f55c4","#ffffff"],
  "C1":["#f1cd1f","#2a2300"], "C2":["#7c1e3f","#ffffff"],
  "D1":["#d92aa8","#ffffff"], "D2":["#ea5b1f","#ffffff"], "D3":["#1aa6a2","#ffffff"],
  "E1":["#c9d3e6","#16203a"], "E2":["#c9d3e6","#16203a"], "E3":["#c9d3e6","#16203a"],
  "F1":["#dfe5f0","#16203a"], "F2":["#dfe5f0","#16203a"],
  "1.M":["#5d6577","#ffffff"], "2.M":["#2b313e","#ffffff"], "Dritte":["#3c4a6b","#ffffff"],
  "Alte Herren":["#8a6d45","#ffffff"], "Walking Football":["#5f7f3a","#ffffff"],
  "Minis":["#f3a6c4","#3a0f20"]
};
const DEFAULT_COLOR = ["#c9d3e6","#16203a"];
const SHARE_LABEL = {"1/2":"½ Platz","1/4":"¼ Platz"};
const SHARE_SHORT = {"1/2":"½","1/4":"¼"};
const SHARE_WORD = {"1/2":"halb","1/4":"viertel"};

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
const colorOf = team => TEAM_COLORS[team] || DEFAULT_COLOR;
const pitch = id => PITCHES.find(p => p.id === id);
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
             dur:col("dauer"), ab:col("offenes"), share:col("platzanteil"), st:col("status"), note:col("hinweis")};
  if (C.w<0 || C.d<0 || C.p<0) throw new Error("spalten");
  const weeks = {}; let n = 0;
  for (const r of rows.slice(1)){
    const date = parseDate(r[C.w]); if (!date) continue;
    const key = isoDate(mondayOf(date));
    const d = DAYS.findIndex(x => norm(x) === norm(r[C.d]) || norm(x).slice(0,2) === norm(r[C.d]).slice(0,2));
    const p = PITCHES.find(x => norm(x.name) === norm(r[C.p]));
    if (d < 0 || !p) continue;
    const wk = weeks[key] ||= {closed:{}, slots:[]};
    const status = norm(r[C.st]);
    if (status.startsWith("platz gesperrt") || status === "gesperrt"){ wk.closed[`${p.id}-${d}`] = "Gesperrt"; continue; }
    const tm = (r[C.t]||"").match(/(\d{1,2})[:.](\d{2})/); const team = (r[C.team]||"").trim();
    if (!tm || !team) continue;
    const dur = parseInt(r[C.dur],10);
    wk.slots.push({id:"r"+(n++), d, p:p.id, team, t:`${pad(+tm[1])}:${tm[2]}`, dur: dur>=15 && dur<=300 ? dur : 75,
      ab: norm(r[C.ab]) === "ja", share: {halb:"1/2", viertel:"1/4"}[norm(r[C.share])],
      off: status === "abgesagt", note:(r[C.note]||"").trim() || undefined});
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
    return {plan, updated: j.updated ? new Date(j.updated) : null, versions: j.versions || {}};
  }
  if (!CFG.CSV_URL) throw new Error("keine Quelle");
  const r = await fetch(CFG.CSV_URL + (CFG.CSV_URL.includes("?") ? "&" : "?") + "t=" + Date.now());
  if (!r.ok) throw new Error("http");
  return {plan: buildPlanFromRows(parseCSV(await r.text())), updated: null, versions: {}};
}

/* ---------- logic ---------- */
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
