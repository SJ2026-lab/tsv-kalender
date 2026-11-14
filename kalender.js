// kalender.js – Verwaltung aller TSV-Termine in Firebase

const kalenderDbUrl = "https://kalendertsv-default-rtdb" + ".europe-west1.firebasedatabase.app";

// Termine aus Firebase laden und anzeigen
async function ladeTermine() {
  const listeDiv = document.getElementById("termine-liste");
  const filterTeam = document.getElementById("filter-team").value;
  const userJson = localStorage.getItem("tsv_user_data");

  if (!userJson) return;
  const user = JSON.parse(userJson);

  listeDiv.innerHTML = "<p style='color:#666;'>Lade Termine...</p>";

  try {
    const url = kalenderDbUrl + "/termine.json?auth=" + user.idToken;
    const response = await fetch(url);
    
    if (response.status === 401) {
      listeDiv.innerHTML = "<p style='color:red;'>Sitzung abgelaufen. Bitte einmal aus- und wieder einloggen.</p>";
      return;
    }

    const data = await response.json();
    if (!data) {
      listeDiv.innerHTML = "<p style='color:#666;'>Aktuell sind noch keine Termine eingetragen.</p>";
      return;
    }

    // Termine in ein Array umwandeln und nach Datum sortieren
    let termine = Object.keys(data).map(id => ({ id, ...data[id] }));
    termine.sort((a, b) => (a.datum + a.uhrzeit).localeCompare(b.datum + b.uhrzeit));

    // Nach Mannschaft filtern, falls ausgewählt
    if (filterTeam !== "ALLE") {
      termine = termine.filter(t => t.mannschaft === filterTeam || t.mannschaft === "Alle Mannschaften");
    }

    if (termine.length === 0) {
      listeDiv.innerHTML = "<p style='color:#666;'>Keine Termine für diese Auswahl gefunden.</p>";
      return;
    }

    // Termine als saubere Karten darstellen
    listeDiv.innerHTML = "";
    termine.forEach(termin => {
      const datumDeutsch = termin.datum.split("-").reverse().join(".");
      const card = document.createElement("div");
      card.style.cssText = "border: 1px solid #ddd; border-left: 5px solid #039be5; padding: 12px; border-radius: 6px; margin-bottom: 10px; background: #fff;";

      let deleteBtnHtml = "";
      if (user.canWrite) {
        deleteBtnHtml = `<button type="button" onclick="loescheTermin('${termin.id}')" style="background:#e53935; padding:6px 10px; font-size:12px; width:auto; margin-top:8px; margin-bottom:0;">Löschen</button>`;
      }

      card.innerHTML = `
        <div style="font-size:12px; color:#039be5; font-weight:bold;">${termin.mannschaft} • ${datumDeutsch} um ${termin.uhrzeit} Uhr</div>
        <div style="font-size:16px; font-weight:bold; margin:4px 0;">${termin.titel}</div>
        ${termin.ort ? `<div style="font-size:13px; color:#555;">📍 Ort: ${termin.ort}</div>` : ""}
        ${termin.info ? `<div style="font-size:13px; color:#333; margin-top:4px;">${termin.info}</div>` : ""}
        ${deleteBtnHtml}
      `;
      listeDiv.appendChild(card);
    });
  } catch (err) {
    listeDiv.innerHTML = "<p style='color:red;'>Fehler beim Laden der Termine: " + err.message + "</p>";
  }
}

// Neuen Termin speichern (nur für Trainer & Admins)
async function speichereTermin() {
  const userJson = localStorage.getItem("tsv_user_data");
  if (!userJson) return;
  const user = JSON.parse(userJson);

  if (!user.canWrite) {
    alert("Du hast keine Berechtigung, Termine einzutragen.");
    return;
  }

  const titel = document.getElementById("termin-titel").value.trim();
  const datum = document.getElementById("termin-datum").value;
  const uhrzeit = document.getElementById("termin-uhrzeit").value;
  const mannschaft = document.getElementById("termin-team").value;
  const ort = document.getElementById("termin-ort").value.trim();
  const info = document.getElementById("termin-info").value.trim();
  const msg = document.getElementById("termin-msg");

  if (!titel || !datum || !uhrzeit || !mannschaft) {
    msg.style.color = "#d32f2f";
    msg.textContent = "Bitte fülle Titel, Datum, Uhrzeit und Mannschaft aus!";
    return;
  }

  msg.style.color = "#333";
  msg.textContent = "Speichere Termin...";

  const neuerTermin = {
    titel,
    datum,
    uhrzeit,
    mannschaft,
    ort,
    info,
    erstelltVon: user.email,
    erstelltAm: new Date().toISOString()
  };

  try {
    const url = kalenderDbUrl + "/termine.json?auth=" + user.idToken;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(neuerTermin)
    });

    if (!response.ok) {
      throw new Error("Speichern fehlgeschlagen (Status " + response.status + ")");
    }

    // Formular leeren und schließen
    document.getElementById("termin-titel").value = "";
    document.getElementById("termin-datum").value = "";
    document.getElementById("termin-uhrzeit").value = "";
    document.getElementById("termin-ort").value = "";
    document.getElementById("termin-info").value = "";
    document.getElementById("termin-formular").classList.add("hidden");
    msg.textContent = "";

    ladeTermine();
  } catch (err) {
    msg.style.color = "#d32f2f";
    msg.textContent = "Fehler: " + err.message;
  }
}

// Termin löschen (nur für Trainer & Admins)
async function loescheTermin(id) {
  if (!confirm("Diesen Termin wirklich löschen?")) return;

  const userJson = localStorage.getItem("tsv_user_data");
  if (!userJson) return;
  const user = JSON.parse(userJson);

  try {
    const url = kalenderDbUrl + "/termine/" + id + ".json?auth=" + user.idToken;
    await fetch(url, { method: "DELETE" });
    ladeTermine();
  } catch (err) {
    alert("Fehler beim Löschen: " + err.message);
  }
}

// Event-Listener für Kalender-Buttons
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("toggle-termin-form");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      document.getElementById("termin-formular").classList.toggle("hidden");
    });
  }

  const saveBtn = document.getElementById("save-termin-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", speichereTermin);
  }

  const filterSelect = document.getElementById("filter-team");
  if (filterSelect) {
    filterSelect.addEventListener("change", ladeTermine);
  }
});

