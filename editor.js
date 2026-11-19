let bearbeitungsTermin = null;

function baueTerminEditor(appContainer, mannschaftenListe, darfGesamtverein = true) {
  const backdrop = document.createElement("div");
  backdrop.id = "termin-modal";
  backdrop.className = "modal-backdrop hidden";

  const sheet = document.createElement("div");
  sheet.className = "bottom-sheet";
  sheet.id = "termin-formular";

  const sHead = document.createElement("div");
  sHead.className = "sheet-header";
  const sheetTitle = document.createElement("h3");
  sheetTitle.id = "editor-sheet-title";
  sheetTitle.style.cssText = "margin:0;font-size:18px;color:var(--navy);";
  sheetTitle.textContent = "Neuer Termin";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "sheet-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => backdrop.classList.add("hidden");
  sHead.append(sheetTitle, closeBtn);

  const lblTitel = erstelleLabel("Veranstaltung / Titel");
  const titelIn = erstelleFeld("text", "termin-titel", "z. B. Training oder Heimspiel");

  const lblTeam = erstelleLabel("Mannschaft");
  const teamSel = document.createElement("select");
  teamSel.id = "termin-team";

  if (darfGesamtverein) {
    const optAlle = document.createElement("option");
    optAlle.value = "Alle Mannschaften";
    optAlle.textContent = "Alle Mannschaften (Gesamtverein)";
    teamSel.appendChild(optAlle);
  }

  (mannschaftenListe || []).forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    teamSel.appendChild(opt);
  });

  const lblDatum = erstelleLabel("Datum");
  const datumIn = erstelleFeld("date", "termin-datum", "");

  const wdhWrapper = document.createElement("div");
  wdhWrapper.id = "termin-wdh-wrapper";
  const lblWdh = erstelleLabel("Häufigkeit");
  const wdhSel = document.createElement("select");
  wdhSel.id = "termin-wdh";
  [
    { val: "1", text: "Einmaliger Termin" },
    { val: "4", text: "Wöchentlich (4 Wochen)" },
    { val: "8", text: "Wöchentlich (8 Wochen)" },
    { val: "12", text: "Wöchentlich (12 Wochen)" },
    { val: "20", text: "Wöchentlich (20 Wochen)" }
  ].forEach(item => {
    const o = document.createElement("option");
    o.value = item.val;
    o.textContent = item.text;
    wdhSel.appendChild(o);
  });
  wdhWrapper.append(lblWdh, wdhSel);

  const zeitRow = document.createElement("div");
  zeitRow.style.cssText = "display:flex; gap:10px;";

  const startCol = document.createElement("div");
  startCol.style.flex = "1";
  startCol.append(erstelleLabel("Beginn"), erstelleFeld("time", "termin-uhrzeit", ""));

  const endCol = document.createElement("div");
  endCol.style.flex = "1";
  endCol.append(erstelleLabel("Ende (optional)"), erstelleFeld("time", "termin-ende", ""));

  zeitRow.append(startCol, endCol);

  const lblOrt = erstelleLabel("Ort / Sportplatz (optional)");
  const ortIn = erstelleFeld("text", "termin-ort", "z. B. Hauptplatz, Sporthalle");

  const lblInfo = erstelleLabel("Zusatzinfos (optional)");
  const infoIn = document.createElement("textarea");
  infoIn.id = "termin-info";
  infoIn.rows = 2;
  infoIn.placeholder = "Treffpunkt, Trikots, Hinweise...";

  const saveBtn = document.createElement("button");
  saveBtn.id = "editor-save-btn";
  saveBtn.type = "button";
  saveBtn.className = "btn-success";
  saveBtn.textContent = "Termin veröffentlichen";
  saveBtn.onclick = () => {
    if (typeof speichereTermin === "function") speichereTermin();
  };

  const delBtn = document.createElement("button");
  delBtn.id = "editor-del-btn";
  delBtn.type = "button";
  delBtn.className = "btn-danger hidden";
  delBtn.textContent = "Termin löschen";
  delBtn.onclick = () => {
    backdrop.classList.add("hidden");
    if (bearbeitungsTermin && typeof frageTerminLoeschen === "function") {
      frageTerminLoeschen(bearbeitungsTermin);
    }
  };

  const msgP = document.createElement("p");
  msgP.id = "termin-msg";
  msgP.style.cssText = "font-size:13px;font-weight:600;margin:6px 0 0;";

  backdrop.onclick = (e) => {
    if (e.target === backdrop) backdrop.classList.add("hidden");
  };

  sheet.append(
    sHead,
    lblTitel, titelIn,
    lblTeam, teamSel,
    lblDatum, datumIn,
    wdhWrapper,
    zeitRow,
    lblOrt, ortIn,
    lblInfo, infoIn,
    saveBtn, delBtn, msgP
  );

  backdrop.appendChild(sheet);
  appContainer.appendChild(backdrop);
}

function oeffneTerminBearbeiten(termin) {
  const modal = document.getElementById("termin-modal");
  if (!modal || !termin) return;

  bearbeitungsTermin = termin;

  document.getElementById("editor-sheet-title").textContent = "Termin bearbeiten";
  document.getElementById("termin-titel").value = termin.titel || "";
  document.getElementById("termin-team").value = termin.mannschaft || "Alle Mannschaften";
  document.getElementById("termin-datum").value = termin.datum || "";
  document.getElementById("termin-uhrzeit").value = termin.uhrzeit || "";
  document.getElementById("termin-ende").value = termin.endzeit || "";
  document.getElementById("termin-ort").value = termin.ort || "";
  document.getElementById("termin-info").value = termin.info || "";
  document.getElementById("termin-msg").textContent = "";

  document.getElementById("termin-wdh-wrapper").classList.add("hidden");
  document.getElementById("editor-save-btn").textContent = "Änderungen speichern";
  document.getElementById("editor-del-btn").classList.remove("hidden");

  modal.classList.remove("hidden");
}

function zeigeTerminDetailsPopup(t) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";

  const sheet = document.createElement("div");
  sheet.className = "bottom-sheet";

  const head = document.createElement("div");
  head.className = "sheet-header";
  const h3 = document.createElement("h3");
  h3.style.cssText = "margin:0;font-size:18px;color:var(--navy);";
  h3.textContent = t.titel;

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "sheet-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => backdrop.remove();
  head.append(h3, closeBtn);
  sheet.appendChild(head);

  const dLesbar = t.datum ? t.datum.slice(8, 10) + "." + t.datum.slice(5, 7) + "." + t.datum.slice(0, 4) : "";
  const zText = t.endzeit ? t.uhrzeit + " – " + t.endzeit + " Uhr" : t.uhrzeit + " Uhr";

  [
    "Mannschaft: " + t.mannschaft,
    "Datum: " + dLesbar,
    "Uhrzeit: " + zText,
    t.ort ? "Ort: " + t.ort : ""
  ].filter(Boolean).forEach(line => {
    const p = document.createElement("p");
    p.style.cssText = "margin:0 0 8px;font-size:14px;font-weight:600;";
    p.textContent = line;
    sheet.appendChild(p);
  });

  if (t.info) {
    const note = document.createElement("div");
    note.style.cssText = "background:#f8fafc;padding:12px;border-radius:12px;font-size:13px;margin-top:10px;border:1px solid var(--border);";
    note.textContent = t.info;
    sheet.appendChild(note);
  }

  backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
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
