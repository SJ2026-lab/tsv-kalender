const kalenderDbHost = "https://kalendertsv-default-rtdb" + ".europe-west1.firebasedatabase.app";
const MONATE_KURZ = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];

let aktuellerDatenStand = "";
let liveStream = null;

function getAktuellerUser() {
  const userJson = localStorage.getItem("tsv_user_data");
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch (e) {
    return null;
  }
}

// Termine im modernen Karten-Design zeichnen
function zeichneTermine(data) {
  const listeDiv = document.getElementById("termine-liste");
  const filterSelect = document.getElementById("filter-team");
  const filterTeam = filterSelect ? filterSelect.value : "ALLE";
  const user = getAktuellerUser();

  if (!user || !listeDiv) return;

  if (!data) {
    listeDiv.innerHTML = "<div class='box' style='text-align:center; color:#64748b;'>Aktuell sind noch keine Termine eingetragen.</div>";
    return;
  }

  let termine = Object.keys(data).map(id => ({ id, ...data[id] }));
  termine.sort((a, b) => (a.datum + a.uhrzeit).localeCompare(b.datum + b.uhrzeit));

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
    const tag = teile || "--";
    const monatIndex = parseInt(teile, 10) - 1;
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
}

// Termine laden & Echtzeit-Überwachung starten
async function ladeTermine(stillesUpdate = false) {
  const listeDiv = document.getElementById("termine-liste");
  const user = getAktuellerUser();
  if (!user || !listeDiv) return;

  if (!stillesUpdate && !aktuellerDatenStand) {
    listeDiv.innerHTML = "<div class='box' style='text-align:center; color:#64748b;'>Lade Termine...</div>";
  }

  try {
    const url = kalenderDbHost + "/termine.json?auth=" + user.idToken;
    const response = await fetch(url);

    if (response.status === 401) {
      listeDiv.innerHTML = "<div class='box' style='color:#dc2626;'>Sitzung abgelaufen. Bitte einmal ab- und wieder anmelden.</div>";
      return;
    }

    const data = await response.json();
    const neuerStand = JSON.stringify(data || {});

    // Nur neu zeichnen, wenn sich wirklich etwas geändert hat (verhindert Flackern)
    if (neuerStand !== aktuellerDatenStand || !stillesUpdate) {
      aktuellerDatenStand = neuerStand;
      zeichneTermine(data);
    }

    starteLiveSync(user);
  } catch (err) {
    if (!stillesUpdate) {
      listeDiv.innerHTML = "<div class='box' style='color:#dc2626;'>Fehler beim Laden: " + err.message + "</div>";
    }
  }
}

// Echtzeit-Stream (EventSource) + Hintergrund-Check
function starteLiveSync(user) {
  if (liveStream) return;

  try {
    const streamUrl = kalenderDbHost + "/termine.json?auth=" + user.idToken;
    liveStream = new EventSource(streamUrl);

    // Sobald in Firebase ein Termin hinzugefügt, geändert oder gelöscht wird:
    liveStream.addEventListener("put", () => ladeTermine(true));
    liveStream.addEventListener("patch", () => ladeTermine(true));

    liveStream.onerror = () => {
      if (liveStream) {
        liveStream.close();
        liveStream = null;
      }
    };
  } catch (e) {
    // Fallback falls Browser EventSource blockiert
  }
}

// Zusätzlicher Sicherheits-Check alle 10 Sekunden & beim Entsperren des Handys
setInterval(() => {
  if (getAktuellerUser() && document.getElementById("termine-liste")) {
    ladeTermine(true);
  }
}, 10000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && getAktuellerUser()) {
    ladeTermine(true);
  }
});

// Neuen Termin speichern
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
    const url = kalenderDbHost + "/termine.json?auth=" + user.idToken;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(neuerTermin)
    });

    if (!response.ok) {
      throw new Error("Speichern fehlgeschlagen (Status " + response.status + ")");
    }

    document.getElementById("termin-titel").value = "";
    document.getElementById("termin-datum").value = "";
    document.getElementById("termin-uhrzeit").value = "";
    document.getElementById("termin-ort").value = "";
    document.getElementById("termin-info").value = "";
    document.getElementById("termin-formular").classList.add("hidden");
    msg.textContent = "";

    ladeTermine(true);
  } catch (err) {
    msg.style.color = "#dc2626";
    msg.textContent = "Fehler: " + err.message;
  }
}

// Termin löschen
async function loescheTermin(id) {
  if (!confirm("Diesen Termin wirklich löschen?")) return;

  const user = getAktuellerUser();
  if (!user) return;

  try {
    const url = kalenderDbHost + "/termine/" + id + ".json?auth=" + user.idToken;
    await fetch(url, { method: "DELETE" });
    ladeTermine(true);
  } catch (err) {
    alert("Fehler beim Löschen: " + err.message);
  }
}
