// editor.js – Komplettes Slide-Up-Formular für neue & wiederkehrende Termine

function baueTerminEditor(appContainer, mannschaftenListe) {
  const backdrop = document.createElement("div");
  backdrop.id = "termin-modal";
  backdrop.className = "modal-backdrop hidden";

  const sheet = document.createElement("div");
  sheet.className = "bottom-sheet";
  sheet.id = "termin-formular";

  // Kopfzeile
  const sHead = document.createElement("div");
  sHead.className = "sheet-header";
  sHead.innerHTML = '<h3 style="margin:0;font-size:18px;">Neuer Termin</h3>';
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "sheet-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => backdrop.classList.add("hidden");
  sHead.appendChild(closeBtn);

  // 1. Titel
  const lblTitel = erstelleLabel("Veranstaltung / Titel");
  const titelIn = erstelleFeld("text", "termin-titel", "z. B. Training oder Heimspiel");

  // 2. Mannschaft
  const lblTeam = erstelleLabel("Mannschaft");
  const teamSel = document.createElement("select");
  teamSel.id = "termin-team";
  let teamOptions = '<option value="Alle Mannschaften">Alle Mannschaften (Gesamtverein)</option>';
  mannschaftenListe.forEach(m => {
    teamOptions += '<option value="' + m + '">' + m + '</option>';
  });
  teamSel.innerHTML = teamOptions;

  // 3. Datum & Wiederholung
  const lblDatum = erstelleLabel("Datum (Start)");
  const datumIn = erstelleFeld("date", "termin-datum", "");

  const lblWdh = erstelleLabel("Häufigkeit");
  const wdhSel = document.createElement("select");
  wdhSel.id = "termin-wdh";
  wdhSel.innerHTML = `
    <option value="1">Einmaliger Termin</option>
    <option value="4">Wöchentlich (4 Wochen)</option>
    <option value="8">Wöchentlich (8 Wochen)</option>
    <option value="12">Wöchentlich (12 Wochen)</option>
    <option value="20">Wöchentlich (20 Wochen)</option>
  `;

  // 4. Startzeit & Endzeit nebeneinander
  const zeitRow = document.createElement("div");
  zeitRow.style.cssText = "display:flex; gap:10px;";

  const startCol = document.createElement("div");
  startCol.style.flex = "1";
  startCol.append(erstelleLabel("Beginn"), erstelleFeld("time", "termin-uhrzeit", ""));

  const endCol = document.createElement("div");
  endCol.style.flex = "1";
  endCol.append(erstelleLabel("Ende (optional)"), erstelleFeld("time", "termin-ende", ""));

  zeitRow.append(startCol, endCol);

  // 5. Ort & Info
  const lblOrt = erstelleLabel("Ort / Sportplatz (optional)");
  const ortIn = erstelleFeld("text", "termin-ort", "z. B. Hauptplatz, Sporthalle");

  const lblInfo = erstelleLabel("Zusatzinfos (optional)");
  const infoIn = document.createElement("textarea");
  infoIn.id = "termin-info";
  infoIn.rows = 2;
  infoIn.placeholder = "Treffpunkt, Trikots, Hinweise...";

  // 6. Speichern-Button & Status
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn-success";
  saveBtn.textContent = "Termin veröffentlichen";
  saveBtn.onclick = () => {
    if (typeof speichereTermin === "function") speichereTermin();
  };

  const msgP = document.createElement("p");
  msgP.id = "termin-msg";
  msgP.style.cssText = "font-size:13px;font-weight:600;margin:0;";

  backdrop.onclick = (e) => {
    if (e.target === backdrop) backdrop.classList.add("hidden");
  };

  sheet.append(
    sHead,
    lblTitel, titelIn,
    lblTeam, teamSel,
    lblDatum, datumIn,
    lblWdh, wdhSel,
    zeitRow,
    lblOrt, ortIn,
    lblInfo, infoIn,
    saveBtn, msgP
  );

  backdrop.appendChild(sheet);
  appContainer.appendChild(backdrop);
}

function erstelleLabel(text) {
  const l = document.createElement("label");
  l.textContent = text;
  return l;
}

function erstelleFeld(art, idName, hinweis) {
  const f = document.createElement("in" + "put");
  f.setAttribute("type", art);
  f.id = idName;
  if (hinweis) f.placeholder = hinweis;
  return f;
}
