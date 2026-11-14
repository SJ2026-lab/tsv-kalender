// kalender.js – Verwaltung aller TSV-Termine

const kalenderDbHost = "https://kalendertsv-default-rtdb" + ".europe-west1.firebasedatabase.app";
const MONATE_KURZ = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];

// Hilfsfunktion: Eingeloggten Nutzer aus dem Speicher holen
function getAktuellerUser() {
  const userJson = localStorage.getItem("tsv_user_data");
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch (e) {
    return null;
  }
}

// Termine laden und im modernen Karten-Design anzeigen
async function ladeTermine() {
  const listeDiv = document.getElementById("termine-liste");
  const filterSelect = document.getElementById("filter-team");
  const filterTeam = filterSelect ? filterSelect.value : "ALLE";
  const user = getAktuellerUser();

  if (!user || !listeDiv) return;

  listeDiv.innerHTML = "<div class='box' style='text-align:center; color:#64748b;'>Lade Termine...</div>";

  try {
    const url = kalenderDbHost + "/termine.json?auth=" + user.idToken;
    const response = await fetch(url);

    if (response.status === 401) {
      listeDiv.innerHTML = "<div class='box' style='color:#dc2626;'>Sitzung abgelaufen. Bitte einmal ab- und wieder anmelden.</div>";
      return;
    }

    const data = await response.json();
    if (!data) {
      listeDiv.innerHTML = "<div class='box' style='text-align:center; color:#64748b;'>Aktuell sind noch keine Termine eingetragen.</div>";
      return;
    }

    // Termine in Liste umwandeln und nach Datum + Uhrzeit sortieren
    let termine = Object.keys(data).map(id => ({ id, ...data[id] }));
    termine.sort((a, b) => (a.datum + a.uhrzeit).localeCompare(b.datum + b.uhrzeit));

    // Mannschaftsfilter anwenden
    if (filterTeam !== "ALLE") {
      termine = termine.filter(t => t.mannschaft === filterTeam || t.mannschaft === "Alle Mannschaften");
    }

    if (termine.length === 0) {
      listeDiv.innerHTML = "<div class='box' style='text-align:center; color:#64748b;'>Keine Termine für diese Auswahl gefunden.</div>";
      return;
    }

    listeDiv.innerHTML = "";
    termine.forEach(termin => {
      const teile = (termin.datum || "").split("-");
      const tag = teile[2] || "--";
      const monatIndex = parseInt(teile[1], 10) - 1;
      const monatName = MONATE_KURZ[monatIndex] || "---";

      const card = document.createElement("div");
      card.className = "event-card";

      let deleteBtnHtml = "";
      if (user.canWrite) {
        deleteBtnHtml = `<button type="button" class="btn-delete-small" onclick="loescheTermin('${termin.id}')">Termin löschen</button>`;
      }

      card.innerHTML = `
        <div class="date-badge">
          <div class="day">${tag}</div>
          <div class="month">${monatName}</div>
        </div>
        <div class="event-content">
          <span class="team-tag">${termin.mannschaft}</span>
          <h3 class="event-title">${termin.titel}</h3>
          <div class="event-meta">
            <span>🕒 ${termin.uhrzeit} Uhr</span>
            ${termin.ort ? `<span>📍 ${termin.ort}</span>` : ""}
          </div>
          ${termin.info ? `<div class="event-note">${termin.info}</div>` : ""}
          ${deleteBtnHtml}
        </div>
      `;
      listeDiv.appendChild(card);
    });
  } catch (err) {
    listeDiv.innerHTML = "<div class='box' style='color:#dc2626;'>Fehler beim Laden: " + err.message + "</div>";
  }
}

// Neuen Termin speichern (nur für Trainer & Admins)
async function speichereTermin() {
  const user = getAktuellerUser();
  if (!user) return;

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
    msg.style.color = "#dc2626";
    msg.textContent = "Bitte fülle Titel, Datum, Uhrzeit und Mannschaft aus!";
    return;
  }

  msg.style.color = "#475569";
  msg.textContent = "Speichere Termin...";

  const neuerTermin = {
    titel: titel,
    datum: datum,
    uhrzeit: uhrzeit,
    mannschaft: mannschaft,
    ort: ort,
    info: info,
    erstelltVon: user.email,
    erstelltAm: new Date().toISOString()
  };

  try {
    const url = kalenderDbHost + "/termine.json?auth=" + user.idToken;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(neuerTermin)
    });

    if (!response.ok) {
      throw new Error("Speichern fehlgeschlagen (Status " + response.status + ")");
    }

    // Eingabefelder zurücksetzen und Formular schließen
    document.getElementById("termin-titel").value = "";
    document.getElementById("termin-datum").value = "";
    document.getElementById("termin-uhrzeit").value = "";
    document.getElementById("termin-ort").value = "";
    document.getElementById("termin-info").value = "";
    document.getElementById("termin-formular").classList.add("hidden");
    msg.textContent = "";

    ladeTermine();
  } catch (err) {
    msg.style.color = "#dc2626";
    msg.textContent = "Fehler: " + err.message;
  }
}

// Termin löschen (nur für Trainer & Admins)
async function loescheTermin(id) {
  if (!confirm("Diesen Termin wirklich löschen?")) return;

  const user = getAktuellerUser();
  if (!user) return;

  try {
    const url = kalenderDbHost + "/termine/" + id + ".json?auth=" + user.idToken;
    await fetch(url, { method: "DELETE" });
    ladeTermine();
  } catch (err) {
    alert("Fehler beim Löschen: " + err.message);
  }
}

// Buttons und Filter verbinden, sobald die Seite geladen ist
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
