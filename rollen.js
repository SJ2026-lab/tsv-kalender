// rollen.js – Mehrfachrollen, Nachbeantragen im Profil & Freigabe-Workflow

const rollenDbHost = "https://kalendertsv-default-rtdb" + ".europe-west1.firebasedatabase.app";

// Berechnet aus allen freigegebenen Rollen die Gesamt-Rechte eines Nutzers
function berechneGesamtRechte(assignments) {
  const aktiv = (assignments || []).filter(a => a.status === "approved");
  const isVorstand = aktiv.some(a => a.role === "Vorstand");
  const isJugendleiter = aktiv.some(a => a.role === "Jugendleiter");
  const isSpartenleiter = aktiv.some(a => a.role === "Spartenleiter");
  const isAdmin = isVorstand || isJugendleiter || isSpartenleiter;

  const trainerTeams = aktiv.filter(a => a.role === "Trainer").map(a => a.team);
  const elternTeams = aktiv.filter(a => a.role === "Eltern").map(a => a.team);
  const canWrite = isAdmin || trainerTeams.length > 0;
  const canApprove = isAdmin || trainerTeams.length > 0;

  return {
    isVorstand,
    isJugendleiter,
    isSpartenleiter,
    isAdmin,
    trainerTeams,
    elternTeams,
    canWrite,
    canApprove
  };
}

// Prüft, ob ein Nutzer für eine bestimmte Mannschaft Termine schreiben/bearbeiten darf
function darfTeamBearbeiten(user, mannschaft) {
  if (!user) return false;
  const r = berechneGesamtRechte(user.assignments);
  if (r.isAdmin) return true;
  if (mannschaft === "Alle Mannschaften") return r.isAdmin;
  return r.trainerTeams.includes(mannschaft);
}

// Prüft, ob ein eingeloggter Nutzer eine bestimmte offene Anfrage freigeben darf
function darfAnfrageFreigeben(aktuellerUser, anfrage) {
  if (!aktuellerUser || !anfrage || anfrage.status !== "pending") return false;
  const r = berechneGesamtRechte(aktuellerUser.assignments);

  // Vorstand darf alles freigeben (inkl. Vorstand, Jugendleiter, Spartenleiter, Trainer, Eltern)
  if (r.isVorstand) return true;

  // Jugendleiter & Spartenleiter dürfen Trainer und Eltern freigeben
  if (r.isJugendleiter || r.isSpartenleiter) {
    return ["Trainer", "Eltern"].includes(anfrage.role);
  }

  // Trainer dürfen Eltern ihrer eigenen Mannschaft freigeben
  if (anfrage.role === "Eltern" && r.trainerTeams.includes(anfrage.team)) {
    return true;
  }

  return false;
}

// Lädt alle Nutzer aus Firebase, prüft auf offene Freigaben und zeichnet die Profil-Ansicht
async function ladeUndZeichneProfil(user, container) {
  if (!user || !container) return;

  container.innerHTML = "";
  const r = berechneGesamtRechte(user.assignments);

  // 1. Kopfbereich: Eigene Daten
  const h2 = document.createElement("h2");
  h2.style.cssText = "margin:0 0 12px;color:var(--navy);";
  h2.textContent = "Mein Vereinsprofil";

  const mailP = document.createElement("p");
  mailP.style.cssText = "font-size:14px;margin:0 0 14px;font-weight:600;";
  mailP.textContent = "E-Mail: " + user.email;

  container.append(h2, mailP);

  // 2. Liste der eigenen Rollen & Teams (mit Status-Badge)
  const subRollen = document.createElement("h3");
  subRollen.style.cssText = "margin:0 0 8px;font-size:13px;text-transform:uppercase;color:var(--muted);";
  subRollen.textContent = "Meine Funktionen & Teams";
  container.appendChild(subRollen);

  const assignments = user.assignments || [];
  assignments.forEach((a, idx) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f8fafc;border-radius:12px;margin-bottom:8px;border:1px solid var(--border);";

    const left = document.createElement("div");
    const titel = document.createElement("strong");
    titel.style.cssText = "font-size:14px;color:var(--navy);display:block;";
    titel.textContent = a.role + (a.team ? " (" + a.team + ")" : "");

    const statusBadge = document.createElement("span");
    statusBadge.style.cssText = "display:inline-block;margin-top:3px;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;";

    if (a.status === "approved") {
      statusBadge.style.background = "#dcfce7";
      statusBadge.style.color = "#15803d";
      statusBadge.textContent = "✓ Freigegeben";
    } else {
      statusBadge.style.background = "#fef3c7";
      statusBadge.style.color = "#b45309";
      const zustaendig = a.role === "Eltern" ? "Trainer (" + a.team + ")" : (a.role === "Trainer" ? "Jugendleiter" : "Vorstand");
      statusBadge.textContent = "⏳ Wartet auf Freigabe (" + zustaendig + ")";
    }

    left.append(titel, statusBadge);
    row.appendChild(left);

    // Zusätzliche Rollen wieder entfernen (wenn mehr als 1 vorhanden ist)
    if (assignments.length > 1) {
      const remBtn = document.createElement("button");
      remBtn.type = "button";
      remBtn.textContent = "×";
      remBtn.style.cssText = "width:28px;height:28px;border-radius:50%;background:#fee2e2;color:#dc2626;padding:0;margin:0;font-size:16px;";
      remBtn.onclick = async () => {
        if (!confirm("Diese Funktion wirklich aus deinem Profil entfernen?")) return;
        const neueListe = assignments.filter((_, i) => i !== idx);
        await aktualisiereEigenesProfil(user, neueListe, container);
      };
      row.appendChild(remBtn);
    }

    container.appendChild(row);
  });

  // 3. Button: Weitere Funktion / weiteres Team hinzufügen (z. B. als Vater bei U11)
  const addRoleBtn = document.createElement("button");
  addRoleBtn.type = "button";
  addRoleBtn.className = "btn-secondary";
  addRoleBtn.style.marginTop = "6px";
  addRoleBtn.textContent = "+ Weitere Funktion / Team hinzufügen";
  addRoleBtn.onclick = () => oeffneWeitereRolleModal(user, container);
  container.appendChild(addRoleBtn);

  // 4. Freigabe-Bereich (falls für diesen Nutzer offene Anfragen vorliegen)
  const freigabeBox = document.createElement("div");
  freigabeBox.id = "offene-freigaben-box";
  freigabeBox.style.marginTop = "20px";
  container.appendChild(freigabeBox);

  await ladeOffeneFreigaben(user, freigabeBox);

  // 5. Ausloggen-Button
  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.className = "btn-danger";
  logoutBtn.style.marginTop = "20px";
  logoutBtn.textContent = "Ausloggen";
  logoutBtn.onclick = () => {
    localStorage.removeItem("tsv_user_data");
    renderLogin();
  };
  container.appendChild(logoutBtn);
}

// Modal zum Nachbeantragen einer weiteren Rolle (z. B. Vater bei U11)
function oeffneWeitereRolleModal(user, profilContainer) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";

  const sheet = document.createElement("div");
  sheet.className = "bottom-sheet";

  const head = document.createElement("div");
  head.className = "sheet-header";
  const h3 = document.createElement("h3");
  h3.style.cssText = "margin:0;font-size:18px;color:var(--navy);";
  h3.textContent = "Weitere Funktion hinzufügen";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "sheet-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => backdrop.remove();
  head.append(h3, closeBtn);

  const roleSel = document.createElement("select");
  ["Eltern", "Trainer", "Jugendleiter", "Spartenleiter", "Vorstand", "Fan"].forEach(r => {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    roleSel.appendChild(opt);
  });

  const teamWrap = document.createElement("div");
  const teamSel = document.createElement("select");
  MANNSCHAFTEN.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    teamSel.appendChild(opt);
  });
  teamWrap.append(erstelleLabel("Mannschaft auswählen"), teamSel);

  roleSel.onchange = () => {
    const brauchtKeinTeam = ["Fan", "Vorstand", "Jugendleiter", "Spartenleiter"].includes(roleSel.value);
    teamWrap.style.display = brauchtKeinTeam ? "none" : "block";
  };

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn-success";
  saveBtn.textContent = "Freigabe anfragen";

  saveBtn.onclick = async () => {
    const brauchtKeinTeam = ["Fan", "Vorstand", "Jugendleiter", "Spartenleiter"].includes(roleSel.value);
    const gewaehltesTeam = brauchtKeinTeam ? "" : teamSel.value;

    // Prüfen, ob genau diese Kombination schon existiert
    const existiert = (user.assignments || []).some(a => a.role === roleSel.value && a.team === gewaehltesTeam);
    if (existiert) {
      alert("Diese Funktion ist bereits in deinem Profil hinterlegt!");
      return;
    }

    // Fan ist sofort aktiv, alles andere muss freigegeben werden
    const neuerStatus = roleSel.value === "Fan" ? "approved" : "pending";
    const neueListe = [...(user.assignments || []), { role: roleSel.value, team: gewaehltesTeam, status: neuerStatus }];

    saveBtn.textContent = "Sende Anfrage...";
    await aktualisiereEigenesProfil(user, neueListe, profilContainer);
    backdrop.remove();
  };

  backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
  sheet.append(
    head,
    erstelleLabel("Funktion"), roleSel,
    teamWrap,
    saveBtn
  );
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
}

// Speichert aktualisierte Zuweisungen in Firebase und im lokalen Profil
async function aktualisiereEigenesProfil(user, neueAssignments, profilContainer) {
  const rechte = berechneGesamtRechte(neueAssignments);
  const haupt = neueAssignments.find(a => a.status === "approved") || neueAssignments.slice(0, 1).pop();

  const updatedProfile = {
    email: user.email,
    role: haupt ? haupt.role : "Fan",
    team: haupt ? haupt.team : "",
    assignments: neueAssignments,
    ...rechte
  };

  await saveUserProfile(user.uid, user.idToken, updatedProfile);

  const fullUser = { ...updatedProfile, uid: user.uid, idToken: user.idToken, refreshToken: user.refreshToken };
  localStorage.setItem("tsv_user_data", JSON.stringify(fullUser));

  // Oberfläche neu zeichnen
  renderDashboard(fullUser);
}
// Lädt alle offenen Anfragen aus Firebase, für die der eingeloggte Nutzer zuständig ist
async function ladeOffeneFreigaben(user, targetBox) {
try {
const res = await fetch(rollenDbHost + "/users.json?auth=" + user.idToken);
if (!res.ok) return;
const allUsers = await res.json();
if (!allUsers) return;
const offeneAnfragen = [];
Object.keys(allUsers).forEach(uid => {
const u = allUsers[uid];
const list = u.assignments || (u.role ? [{ role: u.role, team: u.team || "", status: u.status || "approved" }] : []);
list.forEach((a, index) => {
if (darfAnfrageFreigeben(user, a)) {
offeneAnfragen.push({
uid,
email: u.email,
assignmentIndex: index,
assignment: a,
fullAssignments: list
});
}
});
});
// Roten Badge am Profil-Tab aktualisieren
aktualisiereProfilBadge(offeneAnfragen.length);
if (!targetBox) return;
targetBox.innerHTML = "";
if (offeneAnfragen.length === 0) return;
const title = document.createElement("h3");
title.style.cssText = "margin:0 0 10px;font-size:13px;text-transform:uppercase;color:var(--danger);";
title.textContent = "🔔 Offene Freigaben (" + offeneAnfragen.length + ")";
targetBox.appendChild(title);
offeneAnfragen.forEach(item => {
const card = document.createElement("div");
card.style.cssText = "padding:12px;background:#fff1f2;border:1px solid #fecdd3;border-radius:14px;margin-bottom:10px;";
const info = document.createElement("div");
info.style.cssText = "font-size:13px;color:var(--navy);margin-bottom:8px;";
info.innerHTML = "" + item.email + "
Möchte: " + item.assignment.role + (item.assignment.team ? " (" + item.assignment.team + ")" : "") + "";
const btnRow = document.createElement("div");
btnRow.style.cssText = "display:flex;gap:8px;";
const okBtn = document.createElement("button");
okBtn.type = "button";
okBtn.className = "btn-success";
okBtn.style.cssText = "padding:8px;margin:0;font-size:12px;flex:1;";
okBtn.textContent = "✓ Freigeben";
okBtn.onclick = async () => {
okBtn.textContent = "...";
await bearbeiteFremdeAnfrage(user, item, true, targetBox);
};
const noBtn = document.createElement("button");
noBtn.type = "button";
noBtn.className = "btn-danger";
noBtn.style.cssText = "padding:8px;margin:0;font-size:12px;flex:1;";
noBtn.textContent = "✕ Ablehnen";
noBtn.onclick = async () => {
if (!confirm("Anfrage wirklich ablehnen?")) return;
await bearbeiteFremdeAnfrage(user, item, false, targetBox);
};
btnRow.append(okBtn, noBtn);
card.append(info, btnRow);
targetBox.appendChild(card);
});
} catch (e) {}
}
async function bearbeiteFremdeAnfrage(adminUser, item, freigeben, targetBox) {
let neueListe = [...item.fullAssignments];
if (freigeben) {
neueListe[item.assignmentIndex].status = "approved";
} else {
neueListe = neueListe.filter((_, idx) => idx !== item.assignmentIndex);
}
const rechte = berechneGesamtRechte(neueListe);
const haupt = neueListe.find(a => a.status === "approved") || neueListe.slice(0, 1).pop() || { role: "Fan", team: "" };
const patchData = {
role: haupt.role,
team: haupt.team || "",
assignments: neueListe,
...rechte
};
await fetch(rollenDbHost + "/users/" + item.uid + ".json?auth=" + adminUser.idToken, {
method: "PATCH",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(patchData)
});
await ladeOffeneFreigaben(adminUser, targetBox);
}
// Zeigt einen roten Hinweis-Punkt auf dem Tab "Profil", wenn Anfragen offen sind
function aktualisiereProfilBadge(anzahl) {
const profilTab = document.getElementById("nav-tab-profil");
if (!profilTab) return;
let badge = document.getElementById("profil-notif-badge");
if (anzahl > 0) {
if (!badge) {
badge = document.createElement("span");
badge.id = "profil-notif-badge";
badge.style.cssText = "position:absolute;top:2px;right:8px;background:var(--danger);color:white;font-size:10px;font-weight:800;padding:1px 5px;border-radius:10px;";
profilTab.style.position = "relative";
profilTab.appendChild(badge);
}
badge.textContent = String(anzahl);
} else if (badge) {
badge.remove();
}
}
