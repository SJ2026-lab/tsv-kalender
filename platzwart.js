const platzDbHost = "https://kalendertsv-default-rtdb" + ".europe-west1.firebasedatabase.app";
const VEREINS_PLAETZE = ["A-Platz", "B-Platz", "Kunstrasen", "Sporthalle"];

let aktivePlatzsperren = [];

// Normalisiert Schreibweisen wie "aplatz", "A-Platz", "A Platz" -> "aplatz"
function normalisierePlatzName(text) {
  const clean = (text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (clean.includes("aplatz") || clean.includes("hauptplatz")) return "aplatz";
  if (clean.includes("bplatz") || clean.includes("nebenplatz")) return "bplatz";
  if (clean.includes("kunstrasen")) return "kunstrasen";
  if (clean.includes("halle")) return "sporthalle";
  return clean;
}

// Prüft, ob ein Termin (Datum, Startzeit, Endzeit, Ort) in eine Platzsperre fällt
function findePassendePlatzsperre(datum, startZeit, endZeit, ortText) {
  if (!datum || !ortText || aktivePlatzsperren.length === 0) return null;
  const ortNorm = normalisierePlatzName(ortText);
  if (!ortNorm) return null;

  const tStart = datum + "T" + (startZeit || "00:00");
  const tEnde = datum + "T" + (endZeit || startZeit || "23:59");

  return aktivePlatzsperren.find(s => {
    const sNorm = normalisierePlatzName(s.platz);
    if (!sNorm || !ortNorm.includes(sNorm)) return false;
    const sStart = s.vonDatum + "T" + (s.vonZeit || "00:00");
    const sEnde = s.bisDatum + "T" + (s.bisZeit || "23:59");
    return tStart <= sEnde && tEnde >= sStart;
  }) || null;
}

function formatiereSperrZeitraum(s) {
  const vD = s.vonDatum.slice(8, 10) + "." + s.vonDatum.slice(5, 7) + "." + s.vonDatum.slice(0, 4);
  const bD = s.bisDatum.slice(8, 10) + "." + s.bisDatum.slice(5, 7) + "." + s.bisDatum.slice(0, 4);
  return vD + " (" + s.vonZeit + " Uhr) bis " + bD + " (" + s.bisZeit + " Uhr)";
}

// Lädt Platzsperren aus Firebase & aktualisiert roten Punkt auf dem Platzwart-Tab
async function ladePlatzsperren() {
  const user = getAktuellerUser();
  if (!user) return;

  try {
    const res = await fetch(platzDbHost + "/platzsperren.json?auth=" + user.idToken);
    if (res.ok) {
      const data = await res.json();
      const heute = new Date().toISOString().slice(0, 10);
      const alle = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];
      // Nur aktuelle und zukünftige Sperren behalten
      aktivePlatzsperren = alle.filter(s => s.bisDatum >= heute);
      aktivePlatzsperren.sort((a, b) => (a.vonDatum + a.vonZeit).localeCompare(b.vonDatum + b.vonZeit));
    }
  } catch (e) {}

  aktualisierePlatzwartBadge();
  const view = document.getElementById("platzwart-view-box");
  if (view) zeichnePlatzwartBereich(view);
  if (typeof renderKalenderAnsicht === "function") renderKalenderAnsicht();
}

// Roter Hinweis-Punkt am Platzwart-Icon unten in der Navigation
function aktualisierePlatzwartBadge() {
  const tab = document.getElementById("nav-tab-platz");
  if (!tab) return;

  let dot = document.getElementById("platzwart-red-dot");
  if (aktivePlatzsperren.length > 0) {
    if (!dot) {
      dot = el("span", {
        id: "platzwart-red-dot",
        textContent: "!",
        style: "position:absolute;top:2px;right:10px;background:var(--danger);color:white;font-size:10px;font-weight:900;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(239,68,68,0.5);"
      });
      tab.style.position = "relative";
      tab.appendChild(dot);
    }
  } else if (dot) {
    dot.remove();
  }
}

// Zeichnet die Platzwart-Ansicht (Status für alle + Sperr-Formular für Platzwart/Admin)
function zeichnePlatzwartBereich(container) {
  const user = getAktuellerUser();
  if (!user || !container) return;

  const perms = getPermissions(user);
  const darfSperren = Boolean(perms.isPlatzwart || perms.isAdmin);
  container.innerHTML = "";

  container.appendChild(el("h2", { textContent: "🛠️ Platzstatus & Sperrungen", style: "margin:0 0 12px;color:var(--navy);" }));

  // 1. Live-Übersicht aller Plätze (für alle Vereinsmitglieder sichtbar)
  VEREINS_PLAETZE.forEach(platzName => {
    const sperrenFuerPlatz = aktivePlatzsperren.filter(s => s.platz === platzName);
    const istGesperrt = sperrenFuerPlatz.length > 0;

    const card = el("div", {
      style: "padding:12px 14px;border-radius:14px;margin-bottom:10px;border:1.5px solid " +
             (istGesperrt ? "#fecaca;background:#fef2f2;" : "#bbf7d0;background:#f0fdf4;")
    });

    const topRow = el("div", { style: "display:flex;justify-content:space-between;align-items:center;" });
    topRow.append(
      el("strong", { textContent: platzName, style: "font-size:15px;color:var(--navy);" }),
      el("span", {
        textContent: istGesperrt ? "⛔ GESPERRT" : "✅ FREIGEGEBEN",
        style: "font-size:11px;font-weight:800;padding:3px 9px;border-radius:12px;background:" +
               (istGesperrt ? "#fee2e2;color:#b91c1c;" : "#dcfce7;color:#15803d;")
      })
    );
    card.appendChild(topRow);

    sperrenFuerPlatz.forEach(s => {
      const detailRow = el("div", { style: "margin-top:8px;padding-top:8px;border-top:1px solid #fecaca;display:flex;justify-content:space-between;align-items:center;gap:8px;" });
      const infoText = el("div", { style: "font-size:12px;color:#991b1b;line-height:1.35;" });
      infoText.textContent = "Von " + formatiereSperrZeitraum(s) + (s.grund ? " • Grund: " + s.grund : "");
      detailRow.appendChild(infoText);

      if (darfSperren) {
        const freigebenBtn = el("button", {
          type: "button",
          className: "btn-success",
          textContent: "Aufheben",
          style: "width:auto;padding:6px 10px;margin:0;font-size:11px;flex-shrink:0;"
        });
        freigebenBtn.onclick = async () => {
          if (!confirm("Sperre für " + platzName + " wirklich aufheben?")) return;
          await fetch(platzDbHost + "/platzsperren/" + s.id + ".json?auth=" + user.idToken, { method: "DELETE" });
          await ladePlatzsperren();
        };
        detailRow.appendChild(freigebenBtn);
      }
      card.appendChild(detailRow);
    });

    container.appendChild(card);
  });

  // 2. Formular zum Sperren eines Platzes (nur für Platzwart & Admins)
  if (darfSperren) {
    const formBox = el("div", { style: "margin-top:18px;padding-top:16px;border-top:1.5px solid var(--border);" });
    formBox.appendChild(el("h3", { textContent: "⛔ Neuen Platz sperren", style: "margin:0 0 12px;font-size:16px;color:var(--navy);" }));

    const platzSel = el("select");
    VEREINS_PLAETZE.forEach(p => platzSel.appendChild(el("option", { value: p, textContent: p })));

    const heute = new Date().toISOString().slice(0, 10);

    const vonRow = el("div", { style: "display:flex;gap:8px;" });
    const vonDCol = el("div", { style: "flex:1.2;" });
    const vonDatumIn = erstelleFeld("date", "", "");
    vonDatumIn.value = heute;
    vonDCol.append(erstelleLabel("Gesperrt ab (Datum)"), vonDatumIn);

    const vonZCol = el("div", { style: "flex:0.8;" });
    const vonZeitIn = erstelleFeld("time", "", "");
    vonZeitIn.value = "08:00";
    vonZCol.append(erstelleLabel("Ab Uhrzeit"), vonZeitIn);
    vonRow.append(vonDCol, vonZCol);

    const bisRow = el("div", { style: "display:flex;gap:8px;" });
    const bisDCol = el("div", { style: "flex:1.2;" });
    const bisDatumIn = erstelleFeld("date", "", "");
    bisDatumIn.value = heute;
    bisDCol.append(erstelleLabel("Gesperrt bis (Datum)"), bisDatumIn);

    const bisZCol = el("div", { style: "flex:0.8;" });
    const bisZeitIn = erstelleFeld("time", "", "");
    bisZeitIn.value = "22:00";
    bisZCol.append(erstelleLabel("Bis Uhrzeit"), bisZeitIn);
    bisRow.append(bisDCol, bisZCol);

    const grundIn = erstelleFeld("text", "", "z. B. Dauerregen, Rasenpflege, Turnier");

    const saveBtn = el("button", { type: "button", className: "btn-danger", textContent: "Platz jetzt sperren" });
    saveBtn.onclick = async () => {
      if (!vonDatumIn.value || !bisDatumIn.value) {
        alert("Bitte Start- und Enddatum auswählen!");
        return;
      }
      saveBtn.textContent = "Speichere Sperre...";
      const sperre = {
        platz: platzSel.value,
        vonDatum: vonDatumIn.value,
        vonZeit: vonZeitIn.value || "00:00",
        bisDatum: bisDatumIn.value,
        bisZeit: bisZeitIn.value || "23:59",
        grund: grundIn.value.trim(),
        erstelltVon: user.email
      };
      try {
        const res = await fetch(platzDbHost + "/platzsperren.json?auth=" + user.idToken, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sperre)
        });
        if (!res.ok) throw new Error("Status " + res.status);
        grundIn.value = "";
        await ladePlatzsperren();
      } catch (e) {
        alert("Fehler beim Sperren: " + e.message);
        saveBtn.textContent = "Platz jetzt sperren";
      }
    };

    formBox.append(
      erstelleLabel("Platz auswählen"), platzSel,
      vonRow, bisRow,
      erstelleLabel("Grund (optional)"), grundIn,
      saveBtn
    );
    container.appendChild(formBox);
  }
}

// Auffälliges Warn-Popup, wenn im Kalender ein gesperrter Platz (z. B. "aplatz", "A-Platz") eingegeben wird
function zeigePlatzsperreWarnungPopup(sperre, onTrotzdemSpeichern) {
  const backdrop = el("div", { className: "modal-backdrop", style: "z-index:200;" });
  const sheet = el("div", { className: "bottom-sheet" });

  sheet.append(
    el("h3", { textContent: "⛔ Achtung: " + sperre.platz + " gesperrt!", style: "margin:0 0 8px;font-size:19px;color:var(--danger);" }),
    el("p", {
      textContent: "Der Platzwart hat den " + sperre.platz + " in diesem Zeitraum gesperrt:",
      style: "font-size:14px;color:var(--navy);margin:0 0 8px;font-weight:600;"
    }),
    el("div", {
      textContent: "📅 " + formatiereSperrZeitraum(sperre) + (sperre.grund ? "\nGrund: " + sperre.grund : ""),
style: "background:#fef2f2;border:1.5px solid #fecaca;color:#991b1b;padding:12px;border-radius:12px;font-size:13px;font-weight:700;white-space:pre-line;margin-bottom:16px;"
})
);
const btnAendern = el("button", { type: "button", className: "btn-success", textContent: "Ort / Datum anpassen" });
btnAendern.onclick = () => backdrop.remove();
const btnTrotzdem = el("button", { type: "button", className: "btn-secondary", textContent: "Trotzdem mit Warnhinweis eintragen" });
btnTrotzdem.onclick = () => {
backdrop.remove();
if (typeof onTrotzdemSpeichern === "function") onTrotzdemSpeichern();
};
backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
sheet.append(btnAendern, btnTrotzdem);
backdrop.appendChild(sheet);
document.body.appendChild(backdrop);
}
