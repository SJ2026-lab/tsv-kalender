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
  const userJson = localStorage.getItem("tsv_user_data");
  if (!userJson) return null;
  try { return JSON.parse(userJson); } catch (e) { return null; }
}

function wechseleAnsicht(modus) {
  window.tsvCalState.ansicht = modus;
  if (modus === "WOCHE") {
    window.tsvCalState.zeigeMonatsblatt = false;
  }
  renderKalenderAnsicht();
}

function oeffneTerminFormular(iso) {
  const modal = document.getElementById("termin-modal");
  const feld = document.getElementById("termin-datum");
  if (modal) {
    if (typeof bearbeitungsTermin !== "undefined") bearbeitungsTermin = null;
    document.getElementById("editor-sheet-title").textContent = "Neuer Termin";
    document.getElementById("termin-titel").value = "";
    document.getElementById("termin-uhrzeit").value = "";
    document.getElementById("termin-ende").value = "";
    document.getElementById("termin-ort").value = "";
    document.getElementById("termin-info").value = "";
    document.getElementById("termin-msg").textContent = "";
    document.getElementById("termin-wdh-wrapper").classList.remove("hidden");
    document.getElementById("editor-save-btn").textContent = "Termin veröffentlichen";
    document.getElementById("editor-del-btn").classList.add("hidden");
    if (feld) feld.value = iso || window.tsvCalState.gewaehltesDatum;
    modal.classList.remove("hidden");
  }
}

function filtereNachAuswahl(termineListe) {
  if (typeof ausgewaehlteMannschaften === "undefined" || ausgewaehlteMannschaften.length === 0) {
    return termineListe;
  }
  return termineListe.filter(t =>
    t.mannschaft === "Alle Mannschaften" || ausgewaehlteMannschaften.includes(t.mannschaft)
  );
}

function kannTerminBearbeiten(user, mannschaft) {
  if (typeof darfTeamBearbeiten === "function") return darfTeamBearbeiten(user, mannschaft);
  return Boolean(user && user.canWrite);
}

function pruefeObTerminGesperrt(t) {
  if (typeof findePassendePlatzsperre === "function") {
    return findePassendePlatzsperre(t.datum, t.uhrzeit, t.endzeit, t.ort);
  }
  return null;
}

function formatiereDatumsUeberschrift(isoStr) {
  const st = window.tsvCalState;
  if (isoStr === morgenIso()) return "MORGEN";
  const jahr = parseInt(isoStr.slice(0, 4), 10);
  const mon = parseInt(isoStr.slice(5, 7), 10) - 1;
  const tag = parseInt(isoStr.slice(8, 10), 10);
  const d = new Date(jahr, mon, tag);
  return st.wochentageLang[d.getDay()] + ", " + tag + ". " + st.monateKurz[mon];
}

function baueIosTerminBalken(t, user) {
  const sperre = pruefeObTerminGesperrt(t);
  const pill = document.createElement("div");
  pill.className = "ios-event-pill" + (sperre ? " is-blocked" : "");

  const titel = document.createElement("div");
  titel.className = "ios-event-pill-title";
  titel.textContent = (sperre ? "⛔ " : "") + t.titel + " (" + t.mannschaft + ")";

  const zeit = document.createElement("div");
  zeit.className = "ios-event-pill-time";
  const zeitStr = t.endzeit ? t.uhrzeit + "–" + t.endzeit : t.uhrzeit + " Uhr";
  zeit.textContent = zeitStr + (sperre ? " • Platz gesperrt" : (t.ort ? " • " + t.ort : ""));

  pill.append(titel, zeit);

  pill.onclick = () => {
    if (kannTerminBearbeiten(user, t.mannschaft) && typeof oeffneTerminBearbeiten === "function") {
      oeffneTerminBearbeiten(t);
    } else if (typeof zeigeTerminDetailsPopup === "function") {
      zeigeTerminDetailsPopup(t);
    }
  };

  return pill;
}

function steuereBannerSichtbarkeit(vollbildMonatAktiv) {
  const sponEl = document.getElementById("sponsor-slot");
  if (sponEl) {
    if (vollbildMonatAktiv) sponEl.classList.add("hidden");
    else sponEl.classList.remove("hidden");
  }
}

function renderKalenderAnsicht() {
  const container = document.getElementById("termine-liste");
  const user = getAktuellerUser();
  if (!container || !user) return;

  const termine = filtereNachAuswahl(window.tsvCalState.termine);
  container.innerHTML = "";

  const istVollbildMonat = window.tsvCalState.ansicht === "MONAT" && window.tsvCalState.zeigeMonatsblatt;
  steuereBannerSichtbarkeit(istVollbildMonat);

  if (window.tsvCalState.ansicht === "MONAT") {
    if (window.tsvCalState.zeigeMonatsblatt) {
      zeigeVollbildMonatsblatt(container, termine, user);
    } else {
      zeigeIosWidgetAnsicht(container, termine, user);
    }
  } else {
    zeigeWoche(container, termine, user);
  }
}

// KOMPAKTE iOS-WIDGET-KACHEL (Maximal 2 Termine pro Spalte + "+ X weitere Termine")
function zeigeIosWidgetAnsicht(container, termine, user) {
  const st = window.tsvCalState;
  const heute = heuteIso();
  const aktivIso = st.gewaehltesDatum || heute;

  const jahr = parseInt(aktivIso.slice(0, 4), 10);
  const mon = parseInt(aktivIso.slice(5, 7), 10) - 1;
  const tag = parseInt(aktivIso.slice(8, 10), 10);
  const aktivDate = new Date(jahr, mon, tag);

  const card = document.createElement("div");
  card.className = "ios-widget-card";

  const grid = document.createElement("div");
  grid.className = "ios-widget-grid";

  // LINKE SPALTE: Roter Wochentag, große Zahl, max. 2 Termine des Tages
  const leftCol = document.createElement("div");
  leftCol.className = "ios-left-col";

  const topInfo = document.createElement("div");
  const wDay = document.createElement("div");
  wDay.className = "ios-weekday-red";
  wDay.textContent = st.wochentageLang[aktivDate.getDay()];

  const dayNum = document.createElement("div");
  dayNum.className = "ios-day-big";
  dayNum.textContent = String(tag);

  topInfo.append(wDay, dayNum);
  leftCol.appendChild(topInfo);

  const tagesTermine = termine.filter(x => x.datum === aktivIso);
  if (tagesTermine.length === 0) {
    const leer = document.createElement("div");
    leer.className = "ios-today-empty";
    leer.textContent = aktivIso === heute ? "Heute keine Ereignisse mehr" : "Keine Ereignisse an diesem Tag";
    leftCol.appendChild(leer);
  } else {
    const heuteList = document.createElement("div");
    tagesTermine.slice(0, 2).forEach(t => heuteList.appendChild(baueIosTerminBalken(t, user)));

    if (tagesTermine.length > 2) {
      const restHeute = tagesTermine.length - 2;
      const mehrBtn = document.createElement("div");
      mehrBtn.style.fontSize = "12px";
      mehrBtn.style.fontWeight = "700";
      mehrBtn.style.color = "var(--navy)";
      mehrBtn.style.marginTop = "4px";
      mehrBtn.style.cursor = "pointer";
      mehrBtn.textContent = "+ " + restHeute + (restHeute === 1 ? " weiterer Termin" : " weitere Termine");
      mehrBtn.onclick = () => {
        st.zeigeMonatsblatt = true;
        renderKalenderAnsicht();
      };
      heuteList.appendChild(mehrBtn);
    }
    leftCol.appendChild(heuteList);
  }

  // RECHTE SPALTE: Maximal 2 kommende Termine + "+ X weitere Termine"
  const rightCol = document.createElement("div");
  rightCol.className = "ios-right-col";
  rightCol.style.overflow = "hidden";

  const kommende = termine.filter(x => x.datum > aktivIso);
  if (kommende.length === 0) {
    const leerRechts = document.createElement("div");
    leerRechts.className = "ios-today-empty";
    leerRechts.style.fontSize = "13px";
    leerRechts.textContent = "Keine weiteren Termine geplant";
    rightCol.appendChild(leerRechts);
  } else {
    let letztesDatum = "";
    kommende.slice(0, 2).forEach(t => {
      if (t.datum !== letztesDatum) {
        letztesDatum = t.datum;
        const grp = document.createElement("div");
        grp.className = "ios-group-label";
        grp.textContent = formatiereDatumsUeberschrift(t.datum);
        rightCol.appendChild(grp);
      }
      rightCol.appendChild(baueIosTerminBalken(t, user));
    });

    if (kommende.length > 2) {
      const restKommend = kommende.length - 2;
      const mehrRechts = document.createElement("div");
      mehrRechts.style.fontSize = "12px";
      mehrRechts.fontWeight = "700";
      mehrRechts.style.color = "var(--navy)";
      mehrRechts.style.marginTop = "4px";
      mehrRechts.style.cursor = "pointer";
      mehrRechts.textContent = "+ " + restKommend + (restKommend === 1 ? " weiterer Termin" : " weitere Termine");
      mehrRechts.onclick = () => {
        st.zeigeMonatsblatt = true;
        renderKalenderAnsicht();
      };
      rightCol.appendChild(mehrRechts);
    }
  }

  grid.append(leftCol, rightCol);
  card.appendChild(grid);

  const footer = document.createElement("div");
  footer.className = "ios-widget-footer";

  const monthToggleBtn = document.createElement("button");
  monthToggleBtn.type = "button";
  monthToggleBtn.className = "ios-month-toggle";
  monthToggleBtn.textContent = st.monateLang[st.monat] + " " + st.jahr + " ▾";
  monthToggleBtn.onclick = () => {
    st.zeigeMonatsblatt = true;
    renderKalenderAnsicht();
};
footer.appendChild(monthToggleBtn);
if (st.gewaehltesDatum !== heute) {
const heuteBtn = document.createElement("button");
heuteBtn.type = "button";
heuteBtn.className = "ios-month-toggle";
heuteBtn.textContent = "Heute";
heuteBtn.onclick = () => {
st.gewaehltesDatum = heute;
renderKalenderAnsicht();
};
footer.appendChild(heuteBtn);
}
if (user.canWrite) {
const addBtn = document.createElement("button");
addBtn.type = "button";
addBtn.className = "cal-fab-inline";
addBtn.style.margin = "0";
addBtn.textContent = "+";
addBtn.onclick = () => oeffneTerminFormular(aktivIso);
footer.appendChild(addBtn);
}
card.appendChild(footer);
container.appendChild(card);
}
// VOLLBILD-MONATSANSICHT (Zeigt alle Termine des ausgewählten Tages)
function zeigeVollbildMonatsblatt(container, termine, user) {
const st = window.tsvCalState;
const heute = heuteIso();
const aktivIso = st.gewaehltesDatum || heute;
const fullCard = document.createElement("div");
fullCard.className = "ios-widget-card";
fullCard.style.padding = "16px";
const topBar = document.createElement("div");
topBar.style.display = "flex";
topBar.style.justifyContent = "space-between";
topBar.style.alignItems = "center";
topBar.style.marginBottom = "12px";
const navGroup = document.createElement("div");
navGroup.style.display = "flex";
navGroup.style.alignItems = "center";
navGroup.style.gap = "8px";
const prev = document.createElement("button");
prev.type = "button";
prev.className = "cal-nav-btn";
prev.textContent = "‹";
prev.style.fontSize = "20px";
const title = document.createElement("h3");
title.style.margin = "0";
title.style.fontSize = "16px";
title.style.color = "var(--navy)";
title.textContent = st.monateLang[st.monat] + " " + st.jahr;
const next = document.createElement("button");
next.type = "button";
next.className = "cal-nav-btn";
next.textContent = "›";
next.style.fontSize = "20px";
prev.onclick = () => { st.monat--; if (st.monat < 0) { st.monat = 11; st.jahr--; } renderKalenderAnsicht(); };
next.onclick = () => { st.monat++; if (st.monat > 11) { st.monat = 0; st.jahr++; } renderKalenderAnsicht(); };
navGroup.append(prev, title, next);
const closeFullBtn = document.createElement("button");
closeFullBtn.type = "button";
closeFullBtn.className = "ios-month-toggle";
closeFullBtn.textContent = "Übersicht ▴";
closeFullBtn.onclick = () => {
st.zeigeMonatsblatt = false;
renderKalenderAnsicht();
};
topBar.append(navGroup, closeFullBtn);
fullCard.appendChild(topBar);
const wd = document.createElement("div");
wd.className = "cal-weekdays";
wd.style.fontSize = "11px";
wd.style.marginBottom = "8px";
st.wochentageKurz.forEach(w => {
const dEl = document.createElement("div");
dEl.textContent = w;
wd.appendChild(dEl);
});
fullCard.appendChild(wd);
const calGrid = document.createElement("div");
calGrid.className = "cal-grid";
calGrid.style.gap = "6px";
let start = new Date(st.jahr, st.monat, 1).getDay();
start = start === 0 ? 6 : start - 1;
const tage = new Date(st.jahr, st.monat + 1, 0).getDate();
for (let i = 0; i < start; i++) {
const empty = document.createElement("div");
empty.className = "cal-day empty";
calGrid.appendChild(empty);
}
for (let t = 1; t <= tage; t++) {
const iso = st.jahr + "-" + String(st.monat + 1).padStart(2, "0") + "-" + String(t).padStart(2, "0");
const hasEvent = termine.some(x => x.datum === iso);
const cell = document.createElement("div");
cell.className = "cal-day" + (iso === heute ? " today" : "") + (iso === aktivIso ? " selected" : "");
cell.style.fontSize = "13px";
const numSpan = document.createElement("span");
numSpan.textContent = String(t);
cell.appendChild(numSpan);
if (hasEvent) {
const dot = document.createElement("span");
dot.className = "cal-dot-mini";
dot.style.width = "5px";
dot.style.height = "5px";
cell.appendChild(dot);
}
cell.onclick = () => {
st.gewaehltesDatum = iso;
renderKalenderAnsicht();
};
calGrid.appendChild(cell);
}
fullCard.appendChild(calGrid);
const daySection = document.createElement("div");
daySection.style.marginTop = "16px";
daySection.style.paddingTop = "14px";
daySection.style.borderTop = "1px solid #f1f5f9";
const dayHeader = document.createElement("div");
dayHeader.style.display = "flex";
dayHeader.style.justifyContent = "space-between";
dayHeader.style.alignItems = "center";
dayHeader.style.marginBottom = "10px";
const dLesbar = aktivIso.slice(8, 10) + "." + aktivIso.slice(5, 7) + "." + aktivIso.slice(0, 4);
const dayTitle = document.createElement("h4");
dayTitle.style.margin = "0";
dayTitle.style.fontSize = "14px";
dayTitle.style.color = "var(--navy)";
dayTitle.textContent = "Termine am " + dLesbar;
dayHeader.appendChild(dayTitle);
if (user.canWrite) {
const addBtn = document.createElement("button");
addBtn.type = "button";
addBtn.className = "cal-fab-inline";
addBtn.style.margin = "0";
addBtn.textContent = "+";
addBtn.onclick = () => oeffneTerminFormular(aktivIso);
dayHeader.appendChild(addBtn);
}
daySection.appendChild(dayHeader);
const tagesTermine = termine.filter(x => x.datum === aktivIso);
if (tagesTermine.length === 0) {
const leer = document.createElement("p");
leer.style.fontSize = "13px";
leer.style.color = "var(--muted)";
leer.style.margin = "0";
leer.textContent = "Keine Termine an diesem Tag.";
daySection.appendChild(leer);
} else {
tagesTermine.forEach(t => daySection.appendChild(baueIosTerminBalken(t, user)));
}
fullCard.appendChild(daySection);
container.appendChild(fullCard);
}
function zeigeWoche(container, termine, user) {
const st = window.tsvCalState;
const wBox = document.createElement("div");
wBox.className = "box";
wBox.style.padding = "14px";
const ende = new Date(st.wochenStart);
ende.setDate(ende.getDate() + 6);
const header = document.createElement("div");
header.className = "cal-header";
const prev = document.createElement("button");
prev.type = "button";
prev.className = "cal-nav-btn";
prev.textContent = "‹";
const next = document.createElement("button");
next.type = "button";
next.className = "cal-nav-btn";
next.textContent = "›";
const titelText = String(st.wochenStart.getDate()).padStart(2, "0") + "." + String(st.wochenStart.getMonth() + 1).padStart(2, "0") + ". – " +
String(ende.getDate()).padStart(2, "0") + "." + String(ende.getMonth() + 1).padStart(2, "0") + "." + ende.getFullYear();
const title = document.createElement("h3");
title.textContent = titelText;
prev.onclick = () => { st.wochenStart.setDate(st.wochenStart.getDate() - 7); renderKalenderAnsicht(); };
next.onclick = () => { st.wochenStart.setDate(st.wochenStart.getDate() + 7); renderKalenderAnsicht(); };
header.append(prev, title, next);
wBox.appendChild(header);
const grid3 = document.createElement("div");
grid3.className = "week-grid-3";
const heute = heuteIso();
for (let i = 0; i < 7; i++) {
const d = new Date(st.wochenStart);
d.setDate(d.getDate() + i);
const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const miniCard = document.createElement("div");
miniCard.className = "week-mini-card" + (iso === heute ? " today-card" : "");
const headRow = document.createElement("div");
headRow.className = "week-mini-head";
const daySpan = document.createElement("span");
daySpan.textContent = st.wochentageKurz[i] + " " + String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + ".";
headRow.appendChild(daySpan);
if (user.canWrite) {
const plus = document.createElement("span");
plus.textContent = "+";
plus.style.color = "var(--navy)";
plus.style.fontSize = "15px";
plus.style.cursor = "pointer";
plus.style.padding = "0 3px";
plus.onclick = () => oeffneTerminFormular(iso);
headRow.appendChild(plus);
}
miniCard.appendChild(headRow);
const tagesTermine = termine.filter(x => x.datum === iso);
if (tagesTermine.length === 0) {
const leer = document.createElement("div");
leer.style.fontSize = "11px";
leer.style.color = "#94a3b8";
leer.style.textAlign = "center";
leer.style.marginTop = "16px";
leer.textContent = "Frei";
miniCard.appendChild(leer);
} else {
tagesTermine.forEach(t => {
const sperre = pruefeObTerminGesperrt(t);
const ev = document.createElement("div");
ev.className = "week-mini-event";
ev.style.cursor = "pointer";
if (sperre) {
ev.style.borderLeftColor = "var(--danger)";
ev.style.background = "#fef2f2";
}
const tDiv = document.createElement("div");
tDiv.style.fontWeight = "800";
tDiv.style.color = sperre ? "var(--danger)" : "var(--navy)";
tDiv.textContent = t.uhrzeit + (t.endzeit ? "-" + t.endzeit : "");
const nDiv = document.createElement("div");
nDiv.style.fontWeight = "700";
nDiv.style.margin = "2px 0";
nDiv.textContent = t.titel;
const mDiv = document.createElement("div");
mDiv.style.color = "var(--muted)";
mDiv.style.fontSize = "9px";
mDiv.textContent = t.mannschaft;
ev.append(tDiv, nDiv, mDiv);
if (sperre) {
const spBadge = document.createElement("div");
spBadge.style.marginTop = "4px";
spBadge.style.padding = "2px 4px";
spBadge.style.borderRadius = "4px";
spBadge.style.background = "#fee2e2";
spBadge.style.color = "#b91c1c";
spBadge.style.fontSize = "9px";
spBadge.style.fontWeight = "800";
spBadge.style.lineHeight = "1.15";
spBadge.textContent = "⛔ Platz gesperrt";
ev.appendChild(spBadge);
}
ev.onclick = () => {
if (kannTerminBearbeiten(user, t.mannschaft) && typeof oeffneTerminBearbeiten === "function") {
oeffneTerminBearbeiten(t);
} else if (typeof zeigeTerminDetailsPopup === "function") {
zeigeTerminDetailsPopup(t);
}
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
const response = await fetch(st.dbHost + "/termine.json?auth=" + user.idToken);
if (response.status === 401) return;
const data = await response.json();
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
