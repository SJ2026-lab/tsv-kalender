window.tsvCalState = {
  dbHost: "https://kalendertsv-default-rtdb" + ".europe-west1.firebasedatabase.app",
  monateLang: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  monateKurz: ["JAN.", "FEB.", "MÄR.", "APR.", "MAI", "JUN.", "JUL.", "AUG.", "SEP.", "OKT.", "NOV.", "DEZ."],
  wochentageLang: ["SONNTAG", "MONTAG", "DIENSTAG", "MITTWOCH", "DONNERSTAG", "FREITAG", "SAMSTAG"],
  wochentageKurz: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  termine: [],
  datenStand: "",
  liveStream: null,
  ansicht: "MONAT",
  zeigeMonatsblatt: false,
  gewaehltesDatum: heuteIso(),
  jahr: new Date().getFullYear(),
  monat: new Date().getMonth(),
  wochenStart: getMontag(new Date())
};

function heuteIso() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function morgenIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function getMontag(datum) {
  const d = new Date(datum);
  const tag = d.getDay();
  return new Date(d.setDate(d.getDate() - tag + (tag === 0 ? -6 : 1)));
}

function getAktuellerUser() {
  try { return JSON.parse(localStorage.getItem("tsv_user_data")); } catch (e) { return null; }
}

function wechseleAnsicht(modus) {
  window.tsvCalState.ansicht = modus;
  if (modus === "WOCHE") window.tsvCalState.zeigeMonatsblatt = false;
  renderKalenderAnsicht();
}

function oeffneTerminFormular(iso) {
  const modal = document.getElementById("termin-modal");
  if (!modal) return;
  if (typeof bearbeitungsTermin !== "undefined") bearbeitungsTermin = null;
  document.getElementById("editor-sheet-title").textContent = "Neuer Termin";
  ["termin-titel", "termin-uhrzeit", "termin-ende", "termin-ort", "termin-info", "termin-msg"].forEach(id => {
    const f = document.getElementById(id);
    if (f) { if ("value" in f) f.value = ""; else f.textContent = ""; }
  });
  document.getElementById("termin-wdh-wrapper").classList.remove("hidden");
  document.getElementById("editor-save-btn").textContent = "Termin veröffentlichen";
  document.getElementById("editor-del-btn").classList.add("hidden");
  const dFeld = document.getElementById("termin-datum");
  if (dFeld) dFeld.value = iso || window.tsvCalState.gewaehltesDatum;
  modal.classList.remove("hidden");
}

function filtereNachAuswahl(liste) {
  if (typeof ausgewaehlteMannschaften === "undefined" || ausgewaehlteMannschaften.length === 0) return liste;
  return liste.filter(t => t.mannschaft === "Alle Mannschaften" || ausgewaehlteMannschaften.includes(t.mannschaft));
}

function kannTerminBearbeiten(user, team) {
  return typeof darfTeamBearbeiten === "function" ? darfTeamBearbeiten(user, team) : Boolean(user && user.canWrite);
}

function pruefeObTerminGesperrt(t) {
  return typeof findePassendePlatzsperre === "function" ? findePassendePlatzsperre(t.datum, t.uhrzeit, t.endzeit, t.ort) : null;
}

function formatiereDatumsUeberschrift(isoStr) {
  const st = window.tsvCalState;
  if (isoStr === morgenIso()) return "MORGEN";
  const d = new Date(Number(isoStr.slice(0, 4)), Number(isoStr.slice(5, 7)) - 1, Number(isoStr.slice(8, 10)));
  return st.wochentageLang[d.getDay()] + ", " + Number(isoStr.slice(8, 10)) + ". " + st.monateKurz[d.getMonth()];
}

function baueIosTerminBalken(t, user) {
  const sperre = pruefeObTerminGesperrt(t);
  const pill = el("div", { className: "ios-event-pill" + (sperre ? " is-blocked" : "") });
  const titel = el("div", { className: "ios-event-pill-title", textContent: (sperre ? "⛔ " : "") + t.titel + " (" + t.mannschaft + ")" });
  const zeitStr = t.endzeit ? t.uhrzeit + "–" + t.endzeit : t.uhrzeit + " Uhr";
  const zeit = el("div", { className: "ios-event-pill-time", textContent: zeitStr + (sperre ? " • Platz gesperrt" : (t.ort ? " • " + t.ort : "")) });
  pill.append(titel, zeit);
  pill.onclick = () => {
    if (kannTerminBearbeiten(user, t.mannschaft) && typeof oeffneTerminBearbeiten === "function") oeffneTerminBearbeiten(t);
    else if (typeof zeigeTerminDetailsPopup === "function") zeigeTerminDetailsPopup(t);
  };
  return pill;
}

function renderKalenderAnsicht() {
  const container = document.getElementById("termine-liste");
  const user = getAktuellerUser();
  if (!container || !user) return;

  const termine = filtereNachAuswahl(window.tsvCalState.termine);
  container.innerHTML = "";

  const sponEl = document.getElementById("sponsor-slot");
  const istVollbildMonat = window.tsvCalState.ansicht === "MONAT" && window.tsvCalState.zeigeMonatsblatt;
  if (sponEl) {
    if (istVollbildMonat) sponEl.classList.add("hidden");
    else sponEl.classList.remove("hidden");
  }

  if (window.tsvCalState.ansicht === "MONAT") {
    if (istVollbildMonat) zeigeVollbildMonatsblatt(container, termine, user);
    else zeigeIosWidgetAnsicht(container, termine, user);
  } else {
    zeigeWoche(container, termine, user);
  }
}

function baueMehrLink(anzahl) {
  const st = window.tsvCalState;
  const link = el("div", {
    textContent: "+ " + anzahl + (anzahl === 1 ? " weiterer Termin" : " weitere Termine"),
    style: "font-size:12px;font-weight:700;color:var(--navy);margin-top:4px;cursor:pointer;"
  });
  link.onclick = () => { st.zeigeMonatsblatt = true; renderKalenderAnsicht(); };
  return link;
}

function zeigeIosWidgetAnsicht(container, termine, user) {
  const st = window.tsvCalState;
  const heute = heuteIso();
  const aktivIso = st.gewaehltesDatum || heute;
  const tag = Number(aktivIso.slice(8, 10));
  const aktivDate = new Date(Number(aktivIso.slice(0, 4)), Number(aktivIso.slice(5, 7)) - 1, tag);

  const card = el("div", { className: "ios-widget-card" });
  const grid = el("div", { className: "ios-widget-grid" });

  const leftCol = el("div", { className: "ios-left-col" });
  const topInfo = el("div");
  topInfo.append(
    el("div", { className: "ios-weekday-red", textContent: st.wochentageLang[aktivDate.getDay()] }),
    el("div", { className: "ios-day-big", textContent: String(tag) })
  );
  leftCol.appendChild(topInfo);

  const tagesTermine = termine.filter(x => x.datum === aktivIso);
  if (tagesTermine.length === 0) {
    leftCol.appendChild(el("div", { className: "ios-today-empty", textContent: aktivIso === heute ? "Heute keine Ereignisse mehr" : "Keine Ereignisse an diesem Tag" }));
  } else {
    const heuteList = el("div");
    tagesTermine.slice(0, 2).forEach(t => heuteList.appendChild(baueIosTerminBalken(t, user)));
    if (tagesTermine.length > 2) heuteList.appendChild(baueMehrLink(tagesTermine.length - 2));
    leftCol.appendChild(heuteList);
  }

  const rightCol = el("div", { className: "ios-right-col", style: "overflow:hidden;" });
  const kommende = termine.filter(x => x.datum > aktivIso);
  if (kommende.length === 0) {
    rightCol.appendChild(el("div", { className: "ios-today-empty", textContent: "Keine weiteren Termine geplant", style: "font-size:13px;" }));
  } else {
    let letztesDatum = "";
    kommende.slice(0, 2).forEach(t => {
      if (t.datum !== letztesDatum) {
        letztesDatum = t.datum;
        rightCol.appendChild(el("div", { className: "ios-group-label", textContent: formatiereDatumsUeberschrift(t.datum) }));
      }
      rightCol.appendChild(baueIosTerminBalken(t, user));
    });
    if (kommende.length > 2) rightCol.appendChild(baueMehrLink(kommende.length - 2));
  }

  grid.append(leftCol, rightCol);
  card.appendChild(grid);

  const footer = el("div", { className: "ios-widget-footer" });
  const monthBtn = el("button", { type: "button", className: "ios-month-toggle", textContent: st.monateLang[st.monat] + " " + st.jahr + " ▾" });
  monthBtn.onclick = () => { st.zeigeMonatsblatt = true; renderKalenderAnsicht(); };
  footer.appendChild(monthBtn);

  if (st.gewaehltesDatum !== heute) {
    const heuteBtn = el("button", { type: "button", className: "ios-month-toggle", textContent: "Heute" });
    heuteBtn.onclick = () => { st.gewaehltesDatum = heute; renderKalenderAnsicht(); };
    footer.appendChild(heuteBtn);
  }

  if (user.canWrite) {
    const addBtn = el("button", { type: "button", className: "cal-fab-inline", textContent: "+", style: "margin:0;" });
    addBtn.onclick = () => oeffneTerminFormular(aktivIso);
    footer.appendChild(addBtn);
  }

  card.appendChild(footer);
  container.appendChild(card);
}

function zeigeVollbildMonatsblatt(container, termine, user) {
  const st = window.tsvCalState;
  const heute = heuteIso();
  const aktivIso = st.gewaehltesDatum || heute;

  const fullCard = el("div", { className: "ios-widget-card", style: "padding:16px;" });
  const topBar = el("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;" });
  const navGroup = el("div", { style: "display:flex;align-items:center;gap:8px;" });

  const prev = el("button", { type: "button", className: "cal-nav-btn", textContent: "‹", style: "font-size:20px;" });
  const title = el("h3", { textContent: st.monateLang[st.monat] + " " + st.jahr, style: "margin:0;font-size:16px;color:var(--navy);" });
  const next = el("button", { type: "button", className: "cal-nav-btn", textContent: "›", style: "font-size:20px;" });
  prev.onclick = () => { st.monat--; if (st.monat < 0) { st.monat = 11; st.jahr--; } renderKalenderAnsicht(); };
  next.onclick = () => { st.monat++; if (st.monat > 11) { st.monat = 0; st.jahr++; } renderKalenderAnsicht(); };
  navGroup.append(prev, title, next);

  const closeBtn = el("button", { type: "button", className: "ios-month-toggle", textContent: "Übersicht ▴" });
  closeBtn.onclick = () => { st.zeigeMonatsblatt = false; renderKalenderAnsicht(); };
  topBar.append(navGroup, closeBtn);
  fullCard.appendChild(topBar);

  const wd = el("div", { className: "cal-weekdays", style: "font-size:11px;margin-bottom:8px;" });
st.wochentageKurz.forEach(w => wd.appendChild(el("div", { textContent: w })));
fullCard.appendChild(wd);
const calGrid = el("div", { className: "cal-grid", style: "gap:6px;" });
let start = new Date(st.jahr, st.monat, 1).getDay();
start = start === 0 ? 6 : start - 1;
const tage = new Date(st.jahr, st.monat + 1, 0).getDate();
for (let i = 0; i < start; i++) calGrid.appendChild(el("div", { className: "cal-day empty" }));
for (let t = 1; t <= tage; t++) {
const iso = st.jahr + "-" + String(st.monat + 1).padStart(2, "0") + "-" + String(t).padStart(2, "0");
const cell = el("div", {
className: "cal-day" + (iso === heute ? " today" : "") + (iso === aktivIso ? " selected" : ""),
style: "font-size:13px;"
});
cell.appendChild(el("span", { textContent: String(t) }));
if (termine.some(x => x.datum === iso)) {
cell.appendChild(el("span", { className: "cal-dot-mini", style: "width:5px;height:5px;" }));
}
cell.onclick = () => { st.gewaehltesDatum = iso; renderKalenderAnsicht(); };
calGrid.appendChild(cell);
}
fullCard.appendChild(calGrid);
const daySection = el("div", { style: "margin-top:16px;padding-top:14px;border-top:1px solid #f1f5f9;" });
const dayHeader = el("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;" });
const dLesbar = aktivIso.slice(8, 10) + "." + aktivIso.slice(5, 7) + "." + aktivIso.slice(0, 4);
dayHeader.appendChild(el("h4", { textContent: "Termine am " + dLesbar, style: "margin:0;font-size:14px;color:var(--navy);" }));
if (user.canWrite) {
const addBtn = el("button", { type: "button", className: "cal-fab-inline", textContent: "+", style: "margin:0;" });
addBtn.onclick = () => oeffneTerminFormular(aktivIso);
dayHeader.appendChild(addBtn);
}
daySection.appendChild(dayHeader);
const tagesTermine = termine.filter(x => x.datum === aktivIso);
if (tagesTermine.length === 0) {
daySection.appendChild(el("p", { textContent: "Keine Termine an diesem Tag.", style: "font-size:13px;color:var(--muted);margin:0;" }));
} else {
tagesTermine.forEach(t => daySection.appendChild(baueIosTerminBalken(t, user)));
}
fullCard.appendChild(daySection);
container.appendChild(fullCard);
}
function zeigeWoche(container, termine, user) {
const st = window.tsvCalState;
const wBox = el("div", { className: "box", style: "padding:14px;" });
const ende = new Date(st.wochenStart);
ende.setDate(ende.getDate() + 6);
const header = el("div", { className: "cal-header" });
const prev = el("button", { type: "button", className: "cal-nav-btn", textContent: "‹" });
const next = el("button", { type: "button", className: "cal-nav-btn", textContent: "›" });
const titelText = String(st.wochenStart.getDate()).padStart(2, "0") + "." + String(st.wochenStart.getMonth() + 1).padStart(2, "0") + ". – " +
String(ende.getDate()).padStart(2, "0") + "." + String(ende.getMonth() + 1).padStart(2, "0") + "." + ende.getFullYear();
prev.onclick = () => { st.wochenStart.setDate(st.wochenStart.getDate() - 7); renderKalenderAnsicht(); };
next.onclick = () => { st.wochenStart.setDate(st.wochenStart.getDate() + 7); renderKalenderAnsicht(); };
header.append(prev, el("h3", { textContent: titelText }), next);
wBox.appendChild(header);
const grid3 = el("div", { className: "week-grid-3" });
const heute = heuteIso();
for (let i = 0; i < 7; i++) {
const d = new Date(st.wochenStart);
d.setDate(d.getDate() + i);
const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const miniCard = el("div", { className: "week-mini-card" + (iso === heute ? " today-card" : "") });
const headRow = el("div", { className: "week-mini-head" });
headRow.appendChild(el("span", { textContent: st.wochentageKurz[i] + " " + String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." }));
if (user.canWrite) {
const plus = el("span", { textContent: "+", style: "color:var(--navy);font-size:15px;cursor:pointer;padding:0 3px;" });
plus.onclick = () => oeffneTerminFormular(iso);
headRow.appendChild(plus);
}
miniCard.appendChild(headRow);
const tagesTermine = termine.filter(x => x.datum === iso);
if (tagesTermine.length === 0) {
miniCard.appendChild(el("div", { textContent: "Frei", style: "font-size:11px;color:#94a3b8;text-align:center;margin-top:16px;" }));
} else {
tagesTermine.forEach(t => {
const sperre = pruefeObTerminGesperrt(t);
const ev = el("div", { className: "week-mini-event", style: "cursor:pointer;" + (sperre ? "border-left-color:var(--danger);background:#fef2f2;" : "") });
ev.append(
el("div", { textContent: t.uhrzeit + (t.endzeit ? "-" + t.endzeit : ""), style: "font-weight:800;color:" + (sperre ? "var(--danger)" : "var(--navy)") }),
el("div", { textContent: t.titel, style: "font-weight:700;margin:2px 0;" }),
el("div", { textContent: t.mannschaft, style: "color:var(--muted);font-size:9px;" })
);
if (sperre) {
ev.appendChild(el("div", {
textContent: "⛔ Platz gesperrt",
style: "margin-top:4px;padding:2px 4px;border-radius:4px;background:#fee2e2;color:#b91c1c;font-size:9px;font-weight:800;"
}));
}
ev.onclick = () => {
if (kannTerminBearbeiten(user, t.mannschaft) && typeof oeffneTerminBearbeiten === "function") oeffneTerminBearbeiten(t);
else if (typeof zeigeTerminDetailsPopup === "function") zeigeTerminDetailsPopup(t);
};
miniCard.appendChild(ev);
});
}
grid3.appendChild(miniCard);
}
wBox.appendChild(grid3);
container.appendChild(wBox);
}
async function ladeTermine(stillesUpdate = false) {
const st = window.tsvCalState;
const listeDiv = document.getElementById("termine-liste");
const user = getAktuellerUser();
if (!user || !listeDiv) return;
if (!stillesUpdate) renderKalenderAnsicht();
try {
const res = await fetch(st.dbHost + "/termine.json?auth=" + user.idToken);
if (res.status === 401) return;
const data = await res.json();
const neuerStand = JSON.stringify(data || {});
if (neuerStand !== st.datenStand || !stillesUpdate) {
st.datenStand = neuerStand;
st.termine = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];
st.termine.sort((a, b) => (a.datum + a.uhrzeit).localeCompare(b.datum + b.uhrzeit));
renderKalenderAnsicht();
}
starteLiveSync(user);
} catch (err) {}
}
function starteLiveSync(user) {
const st = window.tsvCalState;
if (st.liveStream) return;
try {
st.liveStream = new EventSource(st.dbHost + "/termine.json?auth=" + user.idToken);
st.liveStream.addEventListener("put", () => ladeTermine(true));
st.liveStream.addEventListener("patch", () => ladeTermine(true));
st.liveStream.onerror = () => { if (st.liveStream) { st.liveStream.close(); st.liveStream = null; } };
} catch (e) {}
}
setInterval(() => {
if (getAktuellerUser() && document.getElementById("termine-liste")) ladeTermine(true);
}, 10000);
