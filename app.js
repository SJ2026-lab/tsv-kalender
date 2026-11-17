const kalenderDbHost = "https://kalendertsv-default-rtdb" + ".europe-west1.firebasedatabase.app";
const MONATE_LANG = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MONATE_KURZ = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];
const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

let alleTermineCache = [];
let aktuellerDatenStand = "";
let liveStream = null;

let aktuelleAnsicht = "MONAT";
let ausgewaehltesDatum = heuteIso();
let ansichtJahr = new Date().getFullYear();
let ansichtMonat = new Date().getMonth();
let wochenStartDatum = getMontag(new Date());

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
  aktuelleAnsicht = modus;
  renderKalenderAnsicht();
}

function oeffneTerminFormular(iso) {
  const modal = document.getElementById("termin-modal");
  const feld = document.getElementById("termin-datum");
  if (modal) {
    if (feld && iso) feld.value = iso;
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

function renderKalenderAnsicht() {
  const container = document.getElementById("termine-liste");
  const user = getAktuellerUser();
  if (!container || !user) return;

  const termine = filtereNachAuswahl(alleTermineCache);
  container.innerHTML = "";

  if (aktuelleAnsicht === "MONAT") {
    zeigeMonat(container, termine, user);
  } else {
    zeigeWoche(container, termine, user);
  }
}

function zeigeMonat(container, termine, user) {
  const calBox = document.createElement("div");
  calBox.className = "box";
  calBox.style.marginBottom = "14px";

  const header = document.createElement("div");
  header.className = "cal-header";
  const prev = Object.assign(document.createElement("button"), { type: "button", className: "cal-nav-btn", textContent: "‹" });
  const next = Object.assign(document.createElement("button"), { type: "button", className: "cal-nav-btn", textContent: "›" });
  const title = Object.assign(document.createElement("h3"), { textContent: MONATE_LANG[ansichtMonat] + " " + ansichtJahr });
  prev.onclick = () => { ansichtMonat--; if (ansichtMonat < 0) { ansichtMonat = 11; ansichtJahr--; } renderKalenderAnsicht(); };
  next.onclick = () => { ansichtMonat++; if (ansichtMonat > 11) { ansichtMonat = 0; ansichtJahr++; } renderKalenderAnsicht(); };
  header.append(prev, title, next);
  calBox.appendChild(header);

  const wd = document.createElement("div");
  wd.className = "cal-weekdays";
  wd.innerHTML = WOCHENTAGE.map(w => "<div>" + w + "</div>").join("");
  calBox.appendChild(wd);

  const grid = document.createElement("div");
  grid.className = "cal-grid";
  let start = new Date(ansichtJahr, ansichtMonat, 1).getDay();
  start = start === 0 ? 6 : start - 1;
  const tage = new Date(ansichtJahr, ansichtMonat + 1, 0).getDate();
  const heute = heuteIso();

  for (let i = 0; i < start; i++) grid.appendChild(Object.assign(document.createElement("div"), { className: "cal-day empty" }));

  for (let t = 1; t <= tage; t++) {
    const iso = ansichtJahr + "-" + String(ansichtMonat + 1).padStart(2, "0") + "-" + String(t).padStart(2, "0");
    const count = termine.filter(x => x.datum === iso).length;
    const cell = document.createElement("div");
    cell.className = "cal-day" + (iso === heute ? " today" : "") + (iso === ausgewaehltesDatum ? " selected" : "");
    const dots = count > 0 ? '<div class="cal-dots">' + '<span class="cal-dot"></span>'.repeat(Math.min(count, 3)) + '</div>' : "";
    cell.innerHTML = "<span>" + t + "</span>" + dots;
    cell.onclick = () => { ausgewaehltesDatum = iso; renderKalenderAnsicht(); };
    grid.appendChild(cell);
  }
  calBox.appendChild(grid);
  container.appendChild(calBox);

  const detBox = document.createElement("div");
  detBox.className = "box";
  const lesbar = ausgewaehltesDatum.slice(8, 10) + "." + ausgewaehltesDatum.slice(5, 7) + "." + ausgewaehltesDatum.slice(0, 4);
  detBox.innerHTML = '<h3 style="margin:0 0 12px;font-size:16px;">Termine am ' + lesbar + '</h3>';

  if (user.canWrite) {
    const addBtn = Object.assign(document.createElement("button"), {
      type: "button", className: "btn-success", style: "margin-bottom:14px;",
      textContent: "+ Termin am " + ausgewaehltesDatum.slice(8, 10) + "." + ausgewaehltesDatum.slice(5, 7) + ". hinzufügen"
    });
    addBtn.onclick = () => oeffneTerminFormular(ausgewaehltesDatum);
    detBox.appendChild(addBtn);
  }

  const liste = termine.filter(x => x.datum === ausgewaehltesDatum);
  if (liste.length === 0) {
    detBox.appendChild(Object.assign(document.createElement("p"), { style: "color:#64748b;font-size:14px;margin:0;", textContent: "Keine Termine an diesem Tag." }));
  } else {
    liste.forEach(x => detBox.appendChild(erstelleKarte(x, user)));
  }
  container.appendChild(detBox);
}

// WOCHENÜBERSICHT: 3 Tage/Spalten nebeneinander für kompakte Darstellung
function zeigeWoche(container, termine, user) {
  const wBox = document.createElement("div");
  wBox.className = "box";
  wBox.style.padding = "14px";
  const ende = new Date(wochenStartDatum);
  ende.setDate(ende.getDate() + 6);

  const header = document.createElement("div");
  header.className = "cal-header";
  const prev = Object.assign(document.createElement("button"), { type: "button", className: "cal-nav-btn", textContent: "‹" });
  const next = Object.assign(document.createElement("button"), { type: "button", className: "cal-nav-btn", textContent: "›" });
  const titelText = String(wochenStartDatum.getDate()).padStart(2, "0") + "." + String(wochenStartDatum.getMonth() + 1).padStart(2, "0") + ". – " +
                    String(ende.getDate()).padStart(2, "0") + "." + String(ende.getMonth() + 1).padStart(2, "0") + "." + ende.getFullYear();
  const title = Object.assign(document.createElement("h3"), { textContent: titelText });
  prev.onclick = () => { wochenStartDatum.setDate(wochenStartDatum.getDate() - 7); renderKalenderAnsicht(); };
  next.onclick = () => { wochenStartDatum.setDate(wochenStartDatum.getDate() + 7); renderKalenderAnsicht(); };
  header.append(prev, title, next);
  wBox.appendChild(header);

  const grid3 = document.createElement("div");
  grid3.className = "week-grid-3";
  const heute = heuteIso();

  for (let i = 0; i < 7; i++) {
    const d = new Date(wochenStartDatum);
    d.setDate(d.getDate() + i);
    const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

    const miniCard = document.createElement("div");
    miniCard.className = "week-mini-card" + (iso === heute ? " today-card" : "");

    const headRow = document.createElement("div");
    headRow.className = "week-mini-head";
    headRow.innerHTML = '<span>' + WOCHENTAGE[i] + ' ' + String(d.getDate()).padStart(2, "0") + '.' + String(d.getMonth() + 1).padStart(2, "0") + '.</span>';

    if (user.canWrite) {
      const plus = document.createElement("span");
      plus.textContent = "+";
      plus.style.cssText = "color:var(--blue);font-size:15px;cursor:pointer;padding:0 3px;";
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
        ev.innerHTML = '<div class="time">' + t.uhrzeit + (t.endzeit ? '-' + t.endzeit : '') + '</div>' +
                       '<div class="title">' + t.titel + '</div>' +
                       '<div class="team">' + t.mannschaft + '</div>';
        ev.onclick = () => {
          ausgewaehltesDatum = iso;
          if (typeof wechseleAnsicht === "function") {
            const topBtns = document.querySelectorAll(".view-toggle-btn");
            if (topBtns.length >= 2) { topBtns.classList.add("active"); topBtns.classList.remove("active"); }
            wechseleAnsicht("MONAT");
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

function erstelleKarte(t, user) {
  const dStr = t.datum || "";
  const tag = dStr.slice(8, 10) || "--";
  const mon = MONATE_KURZ[parseInt(dStr.slice(5, 7), 10) - 1] || "---";
  const card = document.createElement("div");
  card.className = "event-card";

  const serieBadge = t.serieId ? '<span class="team-tag" style="background:#fef3c7;color:#92400e;margin-left:4px;">🔁 Serie</span>' : "";
  const zeitText = t.endzeit ? t.uhrzeit + " – " + t.endzeit + " Uhr" : t.uhrzeit + " Uhr";

  card.innerHTML = '<div class="date-badge"><div class="day">' + tag + '</div><div class="month">' + mon + '</div></div>' +
'' + t.mannschaft + '' + serieBadge + '' +
'' + t.titel + '' +
'🕒 ' + zeitText + '' + (t.ort ? '📍 ' + t.ort + '' : '') + '' +
(t.info ? '' + t.info + '' : '') + '';
if (user.canWrite) {
const delBtn = document.createElement("button");
delBtn.type = "button";
delBtn.className = "btn-delete-small";
delBtn.textContent = "Löschen";
delBtn.onclick = () => { if (typeof frageTerminLoeschen === "function") frageTerminLoeschen(t); };
card.querySelector(".event-content").appendChild(delBtn);
}
return card;
}
async function ladeTermine(stillesUpdate = false) {
const listeDiv = document.getElementById("termine-liste");
const user = getAktuellerUser();
if (!user || !listeDiv) return;
if (!stillesUpdate) renderKalenderAnsicht();
try {
const response = await fetch(kalenderDbHost + "/termine.json?auth=" + user.idToken);
if (response.status === 401) return;
const data = await response.json();
const neuerStand = JSON.stringify(data || {});
if (neuerStand !== aktuellerDatenStand || !stillesUpdate) {
aktuellerDatenStand = neuerStand;
alleTermineCache = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];
alleTermineCache.sort((a, b) => (a.datum + a.uhrzeit).localeCompare(b.datum + b.uhrzeit));
renderKalenderAnsicht();
}
starteLiveSync(user);
} catch (err) {}
}
function starteLiveSync(user) {
if (liveStream) return;
try {
liveStream = new EventSource(kalenderDbHost + "/termine.json?auth=" + user.idToken);
liveStream.addEventListener("put", () => ladeTermine(true));
liveStream.addEventListener("patch", () => ladeTermine(true));
liveStream.onerror = () => { if (liveStream) { liveStream.close(); liveStream = null; } };
} catch (e) {}
}
setInterval(() => {
if (getAktuellerUser() && document.getElementById("termine-liste")) ladeTermine(true);
}, 10000);
