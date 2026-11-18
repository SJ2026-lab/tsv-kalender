```javascript
window.tsvCalState = {
  dbHost: "https://kalendertsv-default-rtdb" + ".europe-west1.firebasedatabase.app",
  monateLang: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  monateKurz: ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"],
  wochentage: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  termine: [],
  datenStand: "",
  liveStream: null,
  ansicht: "MONAT",
  gewaehltesDatum: heuteIso(),
  tagAngeklickt: false,
  jahr: new Date().getFullYear(),
  monat: new Date().getMonth(),
  wochenStart: getMontag(new Date())
};

function heuteIso() {
  const d = new Date();
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
  renderKalenderAnsicht();
}

function oeffneTerminFormular(iso) {
  const modal = document.getElementById("termin-modal");
  const feld = document.getElementById("termin-datum");
  if (modal) {
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

function getEventIcon(titel) {
  const t = (titel || "").toLowerCase();
  if (t.includes("spiel") || t.includes("vs") || t.includes("turnier")) return "👟";
  if (t.includes("sitzung") || t.includes("besprechung") || t.includes("versammlung")) return "👤";
  return "⚽";
}

function renderKalenderAnsicht() {
  const container = document.getElementById("termine-liste");
  const user = getAktuellerUser();
  if (!container || !user) return;

  const termine = filtereNachAuswahl(window.tsvCalState.termine);
  container.innerHTML = "";

  if (window.tsvCalState.ansicht === "MONAT") {
    zeigeSplitMonat(container, termine, user);
  } else {
    zeigeWoche(container, termine, user);
  }
}

// 2-SPALTEN-DESIGN WIE AUF DEM BILD: LINKS MONAT + '+', RECHTS KOMMENDE EVENTS
function zeigeSplitMonat(container, termine, user) {
  const st = window.tsvCalState;
  const split = document.createElement("div");
  split.className = "split-grid";

  // LINKE KARTE: Kalenderblatt + grünes '+' unten rechts
  const calCard = document.createElement("div");
  calCard.className = "cal-card";

  const topPart = document.createElement("div");
  const header = document.createElement("div");
  header.className = "cal-header";
  const prev = Object.assign(document.createElement("button"), { type: "button", className: "cal-nav-btn", textContent: "‹" });
  const next = Object.assign(document.createElement("button"), { type: "button", className: "cal-nav-btn", textContent: "›" });
  const title = Object.assign(document.createElement("h3"), { textContent: st.monateLang[st.monat] + " " + st.jahr });
  prev.onclick = () => { st.monat--; if (st.monat < 0) { st.monat = 11; st.jahr--; } renderKalenderAnsicht(); };
  next.onclick = () => { st.monat++; if (st.monat > 11) { st.monat = 0; st.jahr++; } renderKalenderAnsicht(); };
  header.append(prev, title, next);
  topPart.appendChild(header);

  const wd = document.createElement("div");
  wd.className = "cal-weekdays";
  wd.innerHTML = st.wochentage.map(w => "<div>" + w + "</div>").join("");
  topPart.appendChild(wd);

  const grid = document.createElement("div");
  grid.className = "cal-grid";
  let start = new Date(st.jahr, st.monat, 1).getDay();
  start = start === 0 ? 6 : start - 1;
  const tage = new Date(st.jahr, st.monat + 1, 0).getDate();
  const heute = heuteIso();

  for (let i = 0; i < start; i++) grid.appendChild(Object.assign(document.createElement("div"), { className: "cal-day empty" }));

  for (let t = 1; t <= tage; t++) {
    const iso = st.jahr + "-" + String(st.monat + 1).padStart(2, "0") + "-" + String(t).padStart(2, "0");
    const hasEvent = termine.some(x => x.datum === iso);
    const cell = document.createElement("div");
    cell.className = "cal-day" + (iso === heute ? " today" : "") + (iso === st.gewaehltesDatum ? " selected" : "");
    cell.innerHTML = "<span>" + t + "</span>" + (hasEvent ? '<span class="cal-dot-mini"></span>' : "");
    cell.onclick = () => {
      st.gewaehltesDatum = iso;
      st.tagAngeklickt = true;
      renderKalenderAnsicht();
    };
    grid.appendChild(cell);
  }
  topPart.appendChild(grid);
  calCard.appendChild(topPart);

  // Grünes '+' unten rechts in der Kalender-Karte (nur Trainer & Admins)
  if (user.canWrite) {
    const fabInline = document.createElement("button");
    fabInline.type = "button";
    fabInline.className = "cal-fab-inline";
    fabInline.textContent = "+";
    fabInline.onclick = () => oeffneTerminFormular(st.gewaehltesDatum);
    calCard.appendChild(fabInline);
  }

  // RECHTE KARTE: Kommende Events (oder Termine des angeklickten Tages)
  const evCard = document.createElement("div");
  evCard.className = "events-card";

  let anzeigeTermine = [];
  let boxTitel = "Kommende Events";

  if (st.tagAngeklickt) {
    const dLesbar = st.gewaehltesDatum.slice(8, 10) + "." + st.gewaehltesDatum.slice(5, 7) + ".";
    boxTitel = "Termine am " + dLesbar;
    anzeigeTermine = termine.filter(x => x.datum === st.gewaehltesDatum);
  } else {
    anzeigeTermine = termine.filter(x => x.datum >= heute).slice(0, 4);
  }

  const evHead = document.createElement("div");
  evHead.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;";
  evHead.innerHTML = '<h3 style="margin:0;">' + boxTitel + '</h3>';

  if (st.tagAngeklickt) {
    const resetLink = document.createElement("span");
    resetLink.textContent = "Alle";
    resetLink.style.cssText = "font-size:11px;color:var(--navy);font-weight:700;cursor:pointer;text-decoration:underline;";
    resetLink.onclick = () => { st.tagAngeklickt = false; renderKalenderAnsicht(); };
    evHead.appendChild(resetLink);
  }
  evCard.appendChild(evHead);

  if (anzeigeTermine.length === 0) {
    const leer = document.createElement("p");
    leer.style.cssText = "font-size:12px;color:var(--muted);margin:0;";
    leer.textContent = "Keine Termine eingetragen.";
    evCard.appendChild(leer);
  } else {
    anzeigeTermine.forEach(t => {
      const row = document.createElement("div");
      row.className = "mini-event-row";
      const dStr = t.datum.slice(8, 10) + "." + t.datum.slice(5, 7) + "." + t.datum.slice(0, 4);
      const zStr = t.endzeit ? t.uhrzeit + "–" + t.endzeit : t.uhrzeit + " Uhr";

      row.innerHTML = '<div class="ev-icon">' + getEventIcon(t.titel) + '</div>' +
        '<div class="ev-details">' +
        '<div class="ev-title">' + t.titel + ' - ' + t.mannschaft + '</div>' +
        '<div class="ev-sub">' + dStr + ', ' + zStr + (t.ort ? ' • ' + t.ort : '') + '</div>' +
        '</div>';

      if (user.canWrite) {
        const delSpan = document.createElement("span");
        delSpan.className = "ev-del-link";
        delSpan.textContent = "Löschen";
        delSpan.onclick = () => { if (typeof frageTerminLoeschen === "function") frageTerminLoeschen(t); };
        row.querySelector(".ev-details").appendChild(delSpan);
      }
      evCard.appendChild(row);
    });
  }

  split.append(calCard, evCard);
  container.appendChild(split);
}

// WOCHENÜBERSICHT (3 Spalten nebeneinander)
function zeigeWoche(container, termine, user) {
  const st = window.tsvCalState;
  const wBox = document.createElement("div");
  wBox.className = "box";
  wBox.style.padding = "14px";
  const ende = new Date(st.wochenStart);
  ende.setDate(ende.getDate() + 6);

  const header = document.createElement("div");
  header.className = "cal-header";
  const prev = Object.assign(document.createElement("button"), { type: "button", className: "cal-nav-btn", textContent: "‹" });
  const next = Object.assign(document.createElement("button"), { type: "button", className: "cal-nav-btn", textContent: "›" });
  const titelText = String(st.wochenStart.getDate()).padStart(2, "0") + "." + String(st.wochenStart.getMonth() + 1).padStart(2, "0") + ". – " +
                    String(ende.getDate()).padStart(2, "0") + "." + String(ende.getMonth() + 1).padStart(2, "0") + "." + ende.getFullYear();
  const title = Object.assign(document.createElement("h3"), { textContent: titelText });
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
    headRow.innerHTML = '' + st.wochentage[i] + ' ' + String(d.getDate()).padStart(2, "0") + '.' + String(d.getMonth() + 1).padStart(2, "0") + '.';
if (user.canWrite) {
const plus = document.createElement("span");
plus.textContent = "+";
plus.style.cssText = "color:var(--navy);font-size:15px;cursor:pointer;padding:0 3px;";
plus.onclick = () => oeffneTerminFormular(iso);
headRow.appendChild(plus);
}
miniCard.appendChild(headRow);
const tagesTermine = termine.filter(x => x.datum === iso);
if (tagesTermine.length === 0) {
const leer = document.createElement("div");
leer.style.cssText = "font-size:11px;color:#94a3b8;text-align:center;margin-top:16px;";
leer.textContent = "Frei";
miniCard.appendChild(leer);
} else {
tagesTermine.forEach(t => {
const ev = document.createElement("div");
ev.className = "week-mini-event";
ev.innerHTML = '' + t.uhrzeit + (t.endzeit ? '-' + t.endzeit : '') + '' +
'' + t.titel + '' +
'' + t.mannschaft + '';
ev.onclick = () => {
st.gewaehltesDatum = iso;
st.tagAngeklickt = true;
const topBtns = document.querySelectorAll(".view-toggle-btn");
if (topBtns.length >= 2) {
topBtns.classList.add("active");
topBtns.classList.remove("active");
}
wechseleAnsicht("MONAT");
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
