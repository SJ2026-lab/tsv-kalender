const kalenderDbHost = "https://kalendertsv-default-rtdb" + ".europe-west1.firebasedatabase.app";
let alleTermineCache = [];
let aktuellerDatenStand = "";
let liveStream = null;

function getAktuellerUser() {
  const userJson = localStorage.getItem("tsv_user_data");
  if (!userJson) return null;
  try { return JSON.parse(userJson); } catch (e) { return null; }
}

async function ladeTermine(stillesUpdate = false) {
  const listeDiv = document.getElementById("termine-liste");
  const user = getAktuellerUser();
  if (!user || !listeDiv) return;

  if (!stillesUpdate && typeof renderKalenderAnsicht === "function") {
    renderKalenderAnsicht();
  }

  try {
    const url = kalenderDbHost + "/termine.json?auth=" + user.idToken;
    const response = await fetch(url);
    if (response.status === 401) return;

    const data = await response.json();
    const neuerStand = JSON.stringify(data || {});

    if (neuerStand !== aktuellerDatenStand || !stillesUpdate) {
      aktuellerDatenStand = neuerStand;
      alleTermineCache = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];
      alleTermineCache.sort((a, b) => (a.datum + a.uhrzeit).localeCompare(b.datum + b.uhrzeit));
      if (typeof renderKalenderAnsicht === "function") renderKalenderAnsicht();
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

async function speichereTermin() {
  const user = getAktuellerUser();
  if (!user || !user.canWrite) return;

  const titel = document.getElementById("termin-titel").value.trim();
  const datum = document.getElementById("termin-datum").value;
  const uhrzeit = document.getElementById("termin-uhrzeit").value;
  const mannschaft = document.getElementById("termin-team").value;
  const ort = document.getElementById("termin-ort").value.trim();
  const info = document.getElementById("termin-info").value.trim();
  const msg = document.getElementById("termin-msg");

  if (!titel || !datum || !uhrzeit || !mannschaft) {
    msg.style.color = "#dc2626";
    msg.textContent = "Bitte Titel, Datum, Uhrzeit und Mannschaft ausfüllen!";
    return;
  }

  msg.style.color = "#475569";
  msg.textContent = "Speichere Termin...";

  try {
    const response = await fetch(kalenderDbHost + "/termine.json?auth=" + user.idToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titel, datum, uhrzeit, mannschaft, ort, info, erstelltVon: user.email })
    });
    if (!response.ok) throw new Error("Status " + response.status);

    document.getElementById("termin-titel").value = "";
    document.getElementById("termin-ort").value = "";
    document.getElementById("termin-info").value = "";
    document.getElementById("termin-formular").classList.add("hidden");
    msg.textContent = "";

    if (typeof setzeAusgewaehltesDatum === "function") setzeAusgewaehltesDatum(datum);
    ladeTermine(true);
  } catch (err) {
    msg.style.color = "#dc2626";
    msg.textContent = "Fehler: " + err.message;
  }
}

async function loescheTermin(id) {
  if (!confirm("Diesen Termin wirklich löschen?")) return;
  const user = getAktuellerUser();
  if (!user) return;
  await fetch(kalenderDbHost + "/termine/" + id + ".json?auth=" + user.idToken, { method: "DELETE" });
  ladeTermine(true);
}
