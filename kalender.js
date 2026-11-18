window.tsvCalState = {
  dbHost: "https://kalendertsv-default-rtdb" + ".europe-west1.firebasedatabase.app",
  monateLang: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
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

function zeigeSplitMonat(container, termine, user) {
  const st = window.tsvCalState;
  const split = document.createElement("div");
  split.className = "split-grid";

  const calCard = document.createElement("div");
  calCard.className = "cal-card";

  const topPart = document.createElement("div");
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

  const title = document.createElement("h3");
  title.textContent = st.monateLang[st.monat] + " " + st.jahr;

  prev.onclick = () => { st.monat--; if (st.monat < 0) { st.monat = 11; st.jahr--; } renderKalenderAnsicht(); };
  next.onclick = () => { st.monat++; if (st.monat > 11) { st.monat = 0; st.jahr++; } renderKalenderAnsicht(); };
  header.append(prev, title, next);
  topPart.appendChild(header);

  const wd = document.createElement("div");
  wd.className = "cal-weekdays";
  st.wochentage.forEach(w => {
    const dEl = document.createElement("div");
    dEl.textContent = w;
    wd.appendChild(dEl);
  });
  topPart.appendChild(wd);

  const grid = document.createElement("div");
  grid.className = "cal-grid";
  let start = new Date(st.jahr, st.monat, 1).getDay();
  start = start === 0 ? 6 : start - 1;
  const tage = new Date(st.jahr, st.monat + 1, 0).getDate();
  const heute = heuteIso();

  for (let i = 0; i < start; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-day empty";
    grid.appendChild(empty);
  }

  for (let t = 1; t <= tage; t++) {
    const iso = st.jahr + "-" + String(st.monat + 1).padStart(2, "0") + "-" + String(t).padStart(2, "0");
    const hasEvent = termine.some(x => x.datum === iso);
    const cell = document.createElement("div");
    cell.className = "cal-day" + (iso === heute ? " today" : "") + (iso === st.gewaehltesDatum ? " selected" : "");

    const numSpan = document.createElement("span");
    numSpan.textContent = String(t);
    cell.appendChild(numSpan);

    if (hasEvent) {
      const dot = document.createElement("span");
      dot.className = "cal-dot-mini";
      cell.appendChild(dot);
    }

    cell.onclick = () => {
      st.gewaehltesDatum = iso;
      st.tagAngeklickt = true;
      renderKalenderAnsicht();
    };
    grid.appendChild(cell);
  }
  topPart.appendChild(grid);
  calCard.appendChild(topPart);

  if (user.canWrite) {
    const fabInline = document.createElement("button");
    fabInline.type = "button";
    fabInline.className = "cal-fab-inline";
    fabInline.textContent = "+";
    fabInline.onclick = () => oeffneTerminFormular(st.gewaehltesDatum);
    calCard.appendChild(fabInline);
  }

  const evCard = document.createElement("div");
  evCard.className = "events-card";

  let anzeigeTermine = [];
  let boxTitel = "Kommende Events";

  if (st.tagAngeklickt) {
    const dLesbar = st.gewaehltesDatum.slice(8, 10) + "." + st.gewaehltesDatum.slice(5, 7) + ".";
    boxTitel = "Termine am " + dLesbar;
    anzeigeTermine = termine.filter(x => x.datum === st.gewaehltesDatum);
  } else {
    anzeigeTermine = termine.filter(x => x.datum >= heute);
  }

  const evHead = document.createElement("div");
  evHead.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-shrink:0;";
  const h3El = document.createElement("h3");
  h3El.style.margin = "0";
  h3El.textContent = boxTitel;
  evHead.appendChild(h3El);

  if (st.tagAngeklickt) {
    const resetLink = document.createElement("span");
    resetLink.textContent = "Alle";
    resetLink.style.cssText = "font-size:11px;color:var(--navy);font-weight:700;cursor:pointer;text-decoration:underline;";
    resetLink.onclick = () => { st.tagAngeklickt = false; renderKalenderAnsicht(); };
    evHead.appendChild(resetLink);
  }
  evCard.appendChild(evHead);

  const scrollArea = document.createElement("div");
  scrollArea.className = "events-scroll-list";

  if (anzeigeTermine.length === 0) {
    const leer = document.createElement("p");
    leer.style.cssText = "font-size:12px;color:var(--muted);margin:0;";
    leer.textContent = "Keine Termine eingetragen.";
    scrollArea.appendChild(leer);
  } else {
    anzeigeTermine.forEach(t => {
      const row = document.createElement("div");
      row.className = "mini-event-row";

      const iconDiv = document.createElement("div");
      iconDiv.className = "ev-icon";
      iconDiv.textContent = getEventIcon(t.titel);

      const detDiv = document.createElement("div");
      detDiv.className = "ev-details";

      const titleDiv = document.createElement("div");
      titleDiv.className = "ev-title";
      titleDiv.textContent = t.titel + " - " + t.mannschaft;

      const dStr = t.datum.slice(8, 10) + "." + t.datum.slice(5, 7) + "." + t.datum.slice(0, 4);
      const zStr = t.endzeit ? t.uhrzeit + "–" + t.endzeit : t.uhrzeit + " Uhr";
      const subDiv = document.createElement("div");
      subDiv.className = "ev-sub";
      subDiv.textContent = dStr + ", " + zStr + (t.ort ? " • " + t.ort : "");

      detDiv.append(titleDiv, subDiv);

      if (user.canWrite) {
        const delSpan = document.createElement("span");
        delSpan.className = "ev-del-link";
        delSpan.textContent = "Löschen";
        delSpan.onclick = () => { if (typeof frageTerminLoeschen === "function") frageTerminLoeschen(t); };
        detDiv.appendChild(delSpan);
      }

      row.append(iconDiv, detDiv);
      scrollArea.appendChild(row);
    });
  }

  evCard.appendChild(scrollArea);
  split.append(calCard, evCard);
  container.appendChild(split);
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
daySpan.textContent = st.wochentage[i] + " " + String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + ".";
headRow.appendChild(daySpan);
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
const tDiv = document.createElement("div");
tDiv.style.cssText = "font-weight:800;color:var(--navy);";
tDiv.textContent = t.uhrzeit + (t.endzeit ? "-" + t.endzeit : "");
const nDiv = document.createElement("div");
nDiv.style.cssText = "font-weight:700;margin:2px 0;";
nDiv.textContent = t.titel;
const mDiv = document.createElement("div");
mDiv.style.cssText = "color:var(--muted);font-size:9px;";
mDiv.textContent = t.mannschaft;
ev.append(tDiv, nDiv, mDiv);
ev.onclick = () => {
st.gewaehltesDatum = iso;
st.tagAngeklickt = true;
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
