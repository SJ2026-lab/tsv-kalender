function addiereTage(isoDatum, tage) {
  const jahr = parseInt(isoDatum.slice(0, 4), 10);
  const monat = parseInt(isoDatum.slice(5, 7), 10) - 1;
  const tag = parseInt(isoDatum.slice(8, 10), 10);
  const d = new Date(jahr, monat, tag);
  d.setDate(d.getDate() + tage);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

async function speichereTermin() {
  const user = getAktuellerUser();
  if (!user || !user.canWrite) return;

  const titel = document.getElementById("termin-titel").value.trim();
  const datum = document.getElementById("termin-datum").value;
  const uhrzeit = document.getElementById("termin-uhrzeit").value;
  const endzeit = document.getElementById("termin-ende").value;
  const mannschaft = document.getElementById("termin-team").value;
  const wdh = parseInt(document.getElementById("termin-wdh").value, 10) || 1;
  const ort = document.getElementById("termin-ort").value.trim();
  const info = document.getElementById("termin-info").value.trim();
  const msg = document.getElementById("termin-msg");

  if (!titel || !datum || !uhrzeit || !mannschaft) {
    msg.style.color = "#dc2626";
    msg.textContent = "Bitte Titel, Datum, Beginn und Mannschaft ausfüllen!";
    return;
  }

  msg.style.color = "#475569";
  msg.textContent = wdh > 1 ? "Speichere " + wdh + " wöchentliche Termine..." : "Speichere Termin...";
  const serieId = wdh > 1 ? "serie_" + Date.now() : "";

  try {
    for (let i = 0; i < wdh; i++) {
      const terminDatum = addiereTage(datum, i * 7);
      const response = await fetch(kalenderDbHost + "/termine.json?auth=" + user.idToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titel, datum: terminDatum, uhrzeit, endzeit, mannschaft, ort, info, serieId, erstelltVon: user.email })
      });
      if (!response.ok) throw new Error("Status " + response.status);
    }

    document.getElementById("termin-titel").value = "";
    document.getElementById("termin-uhrzeit").value = "";
    document.getElementById("termin-ende").value = "";
    document.getElementById("termin-ort").value = "";
    document.getElementById("termin-info").value = "";
    document.getElementById("termin-wdh").value = "1";
    document.getElementById("termin-modal").classList.add("hidden");
    msg.textContent = "";

    ausgewaehltesDatum = datum;
    ladeTermine(true);
  } catch (err) {
    msg.style.color = "#dc2626";
    msg.textContent = "Fehler: " + err.message;
  }
}

function frageTerminLoeschen(termin) {
  const user = getAktuellerUser();
  if (!user) return;

  const hatNachfolger = termin.serieId && alleTermineCache.some(t => t.serieId === termin.serieId && t.datum > termin.datum);

  if (!hatNachfolger) {
    if (confirm("Diesen Termin wirklich löschen?")) {
      loescheEinzeltermin(termin.id);
    }
    return;
  }

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";

  const sheet = document.createElement("div");
  sheet.className = "bottom-sheet";
  sheet.innerHTML = '<h3 style="margin:0 0 8px;font-size:18px;">Serientermin löschen</h3>' +
    '<p style="font-size:14px;color:var(--muted);margin:0 0 18px;"><strong>' + termin.titel + '</strong> (' + termin.mannschaft + ') ist ein Serientermin. Was möchtest du löschen?</p>';

  const btnNurDieser = Object.assign(document.createElement("button"), { type: "button", className: "btn-secondary", textContent: "Nur diesen einen Termin löschen" });
  btnNurDieser.onclick = async () => { backdrop.remove(); await loescheEinzeltermin(termin.id); };

  const btnAlleNachfolgenden = Object.assign(document.createElement("button"), { type: "button", className: "btn-danger", textContent: "Diesen & alle nachfolgenden löschen" });
  btnAlleNachfolgenden.onclick = async () => { backdrop.remove(); await loescheNachfolgendeSerientermine(termin); };

  const btnAbbrechen = Object.assign(document.createElement("button"), { type: "button", textContent: "Abbrechen" });
  btnAbbrechen.style.cssText = "background:transparent;color:var(--muted);margin-bottom:0;";
  btnAbbrechen.onclick = () => backdrop.remove();

  backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
  sheet.append(btnNurDieser, btnAlleNachfolgenden, btnAbbrechen);
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
}

async function loescheEinzeltermin(id) {
  const user = getAktuellerUser();
  if (!user) return;
  await fetch(kalenderDbHost + "/termine/" + id + ".json?auth=" + user.idToken, { method: "DELETE" });
  ladeTermine(true);
}

async function loescheNachfolgendeSerientermine(startTermin) {
  const user = getAktuellerUser();
  if (!user) return;
  const zuLoeschen = alleTermineCache.filter(t => t.serieId === startTermin.serieId && t.datum >= startTermin.datum);
  for (const t of zuLoeschen) {
    await fetch(kalenderDbHost + "/termine/" + t.id + ".json?auth=" + user.idToken, { method: "DELETE" });
  }
  ladeTermine(true);
}
