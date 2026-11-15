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
let wochenStartDatum = getMontagDerWoche(new Date());

function heuteIso() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function dateZuIso(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function getMontagDerWoche(datum) {
  const d = new Date(datum);
  const tag = d.getDay();
  const diff = d.getDate() - tag + (tag === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getAktuellerUser() {
  const userJson = localStorage.getItem("tsv_user_data");
  if (!userJson) return null;
  try { return JSON.parse(userJson); } catch (e) { return null; }
}

function oeffneTerminFuerDatum(isoDatum) {
  const form = document.getElementById("termin-formular");
  const datumFeld = document.getElementById("termin-datum");
  if (form && datumFeld) {
    datumFeld.value = isoDatum;
    form.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth" });
  }
}

function getGefilterteTermine() {
  const filterSelect = document.getElementById("filter-team");
  const filterTeam = filterSelect ? filterSelect.value : "ALLE";
  if (filterTeam === "ALLE") return alleTermineCache;
  return alleTermineCache.filter(t => t.mannschaft === filterTeam || t.mannschaft === "Alle Mannschaften");
}

function renderKalenderAnsicht() {
  const container = document.getElementById("termine-liste");
  const user = getAktuellerUser();
  if (!container || !user) return;

  const termine = getGefilterteTermine();
  container.innerHTML = "";

  const switchBar = document.createElement("div");
  switchBar.className = "view-switch";
  switchBar.innerHTML = `
    <button type="button" id="btn-view-month" class="${aktuelleAnsicht === 'MONAT' ? 'active' : ''}">Monatsansicht</button>
    <button type="button" id="btn-view-week" class="${aktuelleAnsicht === 'WOCHE' ? 'active' : ''}">Wochenübersicht</button>
  `;
  container.appendChild(switchBar);

  document.getElementById("btn-view-month").onclick = () => { aktuelleAnsicht = "MONAT"; renderKalenderAnsicht(); };
  document.getElementById("btn-view-week").onclick = () => { aktuelleAnsicht = "WOCHE"; renderKalenderAnsicht(); };

  if (aktuelleAnsicht === "MONAT") {
    renderMonatsAnsicht(container, termine, user);
  } else {
    renderWochenAnsicht(container, termine, user);
  }
}

function renderMonatsAnsicht(container, termine, user) {
  const calBox = document.createElement("div");
  calBox.className = "box";
  calBox.style.marginBottom = "16px";

  const header = document.createElement("div");
  header.className = "cal-header";
  header.innerHTML = `
    <button type="button" class="cal-nav-btn" id="prev-month">‹</button>
    <h3>${MONATE_LANG[ansichtMonat]} ${ansichtJahr}</h3>
    <button type="button" class="cal-nav-btn" id="next-month">›</button>
  `;
  calBox.appendChild(header);

  const weekdays = document.createElement("div");
  weekdays.className = "cal-weekdays";
  weekdays.innerHTML = WOCHENTAGE.map(w => `<div>${w}</div>`).join("");
  calBox.appendChild(weekdays);

  const grid = document.createElement("div");
  grid.className = "cal-grid";

  const ersterTag = new Date(ansichtJahr, ansichtMonat, 1);
  let startWochentag = ersterTag.getDay();
  startWochentag = startWochentag === 0 ? 6 : startWochentag - 1;
  const tageImMonat = new Date(ansichtJahr, ansichtMonat + 1, 0).getDate();
  const heute = heuteIso();

  for (let i = 0; i < startWochentag; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-day empty";
    grid.appendChild(empty);
  }

  for (let tag = 1; tag <= tageImMonat; tag++) {
    const iso = ansichtJahr + "-" + String(ansichtMonat + 1).padStart(2, "0") + "-" + String(tag).padStart(2, "0");
    const tagesTermine = termine.filter(t => t.datum === iso);

    const cell = document.createElement("div");
    cell.className = "cal-day";
    if (iso === heute) cell.classList.add("today");
    if (iso === ausgewaehltesDatum) cell.classList.add("selected");

    let dotsHtml = "";
    if (tagesTermine.length > 0) {
      const anzahl = Math.min(tagesTermine.length, 3);
      dotsHtml = '<div class="cal-dots">' + '<span class="cal-dot"></span>'.repeat(anzahl) + '</div>';
    }

    cell.innerHTML = `<span>${tag}</span>${dotsHtml}`;
    cell.onclick = () => {
      ausgewaehltesDatum = iso;
      renderKalenderAnsicht();
    };
    grid.appendChild(cell);
  }

  calBox.appendChild(grid);
  container.appendChild(calBox);

  document.getElementById("prev-month").onclick = () => {
    ansichtMonat--;
    if (ansichtMonat < 0) { ansichtMonat = 11; ansichtJahr--; }
    renderKalenderAnsicht();
  };
  document.getElementById("next-month").onclick = () => {
    ansichtMonat++;
    if (ansichtMonat > 11) { ansichtMonat = 0; ansichtJahr++; }
    renderKalenderAnsicht();
  };

  const detailBox = document.createElement("div");
  detailBox.className = "box";
  const teile = ausgewaehltesDatum.split("-");
  const datumLesbar = teile + "." + teile + "." + teile;
  const tagesTermine = termine.filter(t => t.datum === ausgewaehltesDatum);

  detailBox.innerHTML = `<h3 style="margin:0 0 12px 0; font-size:16px;">Termine am ${datumLesbar}</h3>`;

  if (user.canWrite) {
    const addDayBtn = document.createElement("button");
    addDayBtn.type = "button";
    addDayBtn.className = "btn-success";
    addDayBtn.style.marginBottom = "14px";
    addDayBtn.textContent = "+ Termin am " + teile + "." + teile + ". hinzufügen";
    addDayBtn.onclick = () => oeffneTerminFuerDatum(ausgewaehltesDatum);
    detailBox.appendChild(addDayBtn);
  }

  if (tagesTermine.length === 0) {
    detailBox.innerHTML += `<p style="color:#64748b; font-size:14px; margin:0;">Keine Termine an diesem Tag.</p>`;
  } else {
    tagesTermine.forEach(termin => {
      detailBox.appendChild(baueTerminKarte(termin, user));
    });
  }

  container.appendChild(detailBox);
}

function renderWochenAnsicht(container, termine, user) {
  const weekBox = document.createElement("div");
  weekBox.className = "box";

  const endeWoche = new Date(wochenStartDatum);
  endeWoche.setDate(endeWoche.getDate() + 6);

  const startStr = String(wochenStartDatum.getDate()).padStart(2, "0") + "." + String(wochenStartDatum.getMonth() + 1).padStart(2, "0") + ".";
  const endeStr = String(endeWoche.getDate()).padStart(2, "0") + "." + String(endeWoche.getMonth() + 1).padStart(2, "0") + "." + endeWoche.getFullYear();

  const header = document.createElement("div");
  header.className = "cal-header";
  header.innerHTML = `
    <button type="button" class="cal-nav-btn" id="prev-week">‹</button>
    <h3>${startStr} – ${endeStr}</h3>
    <button type="button" class="cal-nav-btn" id="next-week">›</button>
  `;
  weekBox.appendChild(header);

  const heute = heuteIso();

  for (let i = 0; i < 7; i++) {
    const tagDatum = new Date(wochenStartDatum);
    tagDatum.setDate(tagDatum.getDate() + i);
    const iso = dateZuIso(tagDatum);
    const tagNum = String(tagDatum.getDate()).padStart(2, "0") + "." + String(tagDatum.getMonth() + 1).padStart(2, "0") + ".";
    const tagesTermine = termine.filter(t => t.datum === iso);

    const block = document.createElement("div");
    block.className = "week-day-block";

    const titleRow = document.createElement("div");
    titleRow.className = "week-day-title" + (iso === heute ? " today-text" : "");
    titleRow.innerHTML = `<span>${WOCHENTAGE[i]}, ${tagNum}</span>`;

    if (user.canWrite) {
      const miniAdd = document.createElement("span");
      miniAdd.textContent = "+ Termin";
      miniAdd.style.cssText = "color:var(--blue); cursor:pointer; font-size:12px;";
      miniAdd.onclick = () => oeffneTerminFuerDatum(iso);
      titleRow.appendChild(miniAdd);
    }

    block.appendChild(titleRow);

    if (tagesTermine.length === 0) {
      const leer = document.createElement("div");
      leer.style.cssText = "font-size:13px; color:#94a3b8;";
      leer.textContent = "Keine Termine";
      block.appendChild(leer);
    } else {
      tagesTermine.forEach(t => block.appendChild(baueTerminKarte(t, user)));
    }

    weekBox.appendChild(block);
  }

  container.appendChild(weekBox);

  document.getElementById("prev-week").onclick = () => {
    wochenStartDatum.setDate(wochenStartDatum.getDate() - 7);
    renderKalenderAnsicht();
  };
  document.getElementById("next-week").onclick = () => {
    wochenStartDatum.setDate(wochenStartDatum.getDate() + 7);
    renderKalenderAnsicht();
  };
}

function baueTerminKarte(termin, user) {
  const teile = (termin.datum || "").split("-");
  const tag = teile || "--";
  const monatIndex = parseInt(teile, 10) - 1;
  const monatName = MONATE_KURZ[monatIndex] || "---";

  const card = document.createElement("div");
  card.className = "event-card";

  let deleteBtnHtml = "";
  if (user.canWrite) {
    deleteBtnHtml = `<button type="button" class="btn-delete-small" onclick="loescheTermin('${termin.id}')">Löschen</button>`;
  }

  card.innerHTML = `
    <div class="date-badge">
      <div class="day">${tag}</div>
      <div class="month">${monatName}</div>
    </div>
    <div class="event-content">
      <span class="team-tag">${termin.mannschaft}</span>
      <h3 class="event-title">${termin.titel}</h3>
