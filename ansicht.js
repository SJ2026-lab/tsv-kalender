const MONATE_LANG = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MONATE_KURZ = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];
const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

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

function setzeAusgewaehltesDatum(iso) {
  ausgewaehltesDatum = iso;
}

function oeffneTerminFormular(iso) {
  const form = document.getElementById("termin-formular");
  const feld = document.getElementById("termin-datum");
  if (form && feld) {
    feld.value = iso;
    form.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth" });
  }
}

function renderKalenderAnsicht() {
  const container = document.getElementById("termine-liste");
  const user = getAktuellerUser();
  if (!container || !user) return;

  const filterEl = document.getElementById("filter-team");
  const filterTeam = filterEl ? filterEl.value : "ALLE";
  const termine = filterTeam === "ALLE" ? alleTermineCache : alleTermineCache.filter(t => t.mannschaft === filterTeam || t.mannschaft === "Alle Mannschaften");

  container.innerHTML = "";

  const switchBar = document.createElement("div");
  switchBar.className = "view-switch";
  const btnM = Object.assign(document.createElement("button"), { type: "button", textContent: "Monatsansicht", className: aktuelleAnsicht === "MONAT" ? "active" : "" });
  const btnW = Object.assign(document.createElement("button"), { type: "button", textContent: "Wochenübersicht", className: aktuelleAnsicht === "WOCHE" ? "active" : "" });
  btnM.onclick = () => { aktuelleAnsicht = "MONAT"; renderKalenderAnsicht(); };
  btnW.onclick = () => { aktuelleAnsicht = "WOCHE"; renderKalenderAnsicht(); };
  switchBar.append(btnM, btnW);
  container.appendChild(switchBar);

  if (aktuelleAnsicht === "MONAT") {
    zeigeMonat(container, termine, user);
  } else {
    zeigeWoche(container, termine, user);
  }
}

function zeigeMonat(container, termine, user) {
  const calBox = document.createElement("div");
  calBox.className = "box";
  calBox.style.marginBottom = "16px";

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

function zeigeWoche(container, termine, user) {
  const wBox = document.createElement("div");
  wBox.className = "box";
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

  const heute = heuteIso();
  for (let i = 0; i < 7; i++) {
    const d = new Date(wochenStartDatum);
    d.setDate(d.getDate() + i);
    const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const block = document.createElement("div");
    block.className = "week-day-block";

    const row = document.createElement("div");
    row.className = "week-day-title" + (iso === heute ? " today-text" : "");
    row.innerHTML = "<span>" + WOCHENTAGE[i] + ", " + String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + ".</span>";
    if (user.canWrite) {
      const plus = Object.assign(document.createElement("span"), { textContent: "+ Termin", style: "color:var(--blue);cursor:pointer;font-size:12px;" });
      plus.onclick = () => oeffneTerminFormular(iso);
      row.appendChild(plus);
    }
    block.appendChild(row);

    const liste = termine.filter(x => x.datum === iso);
    if (liste.length === 0) {
      block.appendChild(Object.assign(document.createElement("div"), { style: "font-size:13px;color:#94a3b8;", textContent: "Keine Termine" }));
    } else {
      liste.forEach(x => block.appendChild(erstelleKarte(x, user)));
    }
    wBox.appendChild(block);
  }
  container.appendChild(wBox);
}

function erstelleKarte(t, user) {
  const dStr = t.datum || "";
  const tag = dStr.slice(8, 10) || "--";
  const mon = MONATE_KURZ[parseInt(dStr.slice(5, 7), 10) - 1] || "---";
  const card = document.createElement("div");
  card.className = "event-card";
  const del = user.canWrite ? `<button type="button" class="btn-delete-small" onclick="loescheTermin('${t.id}')">Löschen</button>` : "";
  card.innerHTML = `
    <div class="date-badge"><div class="day">${tag}</div><div class="month">${mon}</div></div>
    <div class="event-content">
      <span class="team-tag">${t.mannschaft}</span>
      <h3 class="event-title">${t.titel}</h3>
      <div class="event-meta"><span>🕒 ${t.uhrzeit} Uhr</span>${t.ort ? "<span>📍 " + t.ort + "</span>" : ""}</div>
      ${t.info ? '<div class="event-note">' + t.info + '</div>' : ""}
      ${del}
    </div>`;
  return card;
}
