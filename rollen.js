const rollenDbHost = "https://kalendertsv-default-rtdb" + ".europe-west1.firebasedatabase.app";

function berechneGesamtRechte(assignments) {
  const aktiv = (assignments || []).filter(a => a.status === "approved");
  const isVorstand = aktiv.some(a => a.role === "Vorstand");
  const isJugendleiter = aktiv.some(a => a.role === "Jugendleiter");
  const isSpartenleiter = aktiv.some(a => a.role === "Spartenleiter");
  const isAdmin = isVorstand || isJugendleiter || isSpartenleiter;
  const isPlatzwart = aktiv.some(a => a.role === "Platzwart") || isAdmin;
  const trainerTeams = aktiv.filter(a => a.role === "Trainer").map(a => a.team);
  const elternTeams = aktiv.filter(a => a.role === "Eltern").map(a => a.team);
  const canWrite = isAdmin || trainerTeams.length > 0;
  const canApprove = isAdmin || trainerTeams.length > 0;
  return { isVorstand, isJugendleiter, isSpartenleiter, isAdmin, isPlatzwart, trainerTeams, elternTeams, canWrite, canApprove };
}

function darfTeamBearbeiten(user, mannschaft) {
  if (!user) return false;
  const r = berechneGesamtRechte(user.assignments);
  if (r.isAdmin) return true;
  if (mannschaft === "Alle Mannschaften") return r.isAdmin;
  return r.trainerTeams.includes(mannschaft);
}

function darfAnfrageFreigeben(aktuellerUser, anfrage) {
  if (!aktuellerUser || !anfrage || anfrage.status !== "pending") return false;
  const r = berechneGesamtRechte(aktuellerUser.assignments);
  if (r.isVorstand) return true;
  if (r.isJugendleiter || r.isSpartenleiter) return ["Trainer", "Eltern", "Platzwart"].includes(anfrage.role);
  if (anfrage.role === "Eltern" && r.trainerTeams.includes(anfrage.team)) return true;
  return false;
}

async function ladeUndZeichneProfil(user, container) {
  if (!user || !container) return;
  container.innerHTML = "";

  const h2 = el("h2", { textContent: "Mein Vereinsprofil", style: "margin:0 0 12px;color:var(--navy);" });
  const mailP = el("p", { textContent: "E-Mail: " + user.email, style: "font-size:14px;margin:0 0 14px;font-weight:600;" });
  const subRollen = el("h3", { textContent: "Meine Funktionen & Teams", style: "margin:0 0 8px;font-size:13px;text-transform:uppercase;color:var(--muted);" });
  container.append(h2, mailP, subRollen);

  const assignments = user.assignments || [];
  assignments.forEach((a, idx) => {
    const row = el("div", { style: "display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f8fafc;border-radius:12px;margin-bottom:8px;border:1px solid var(--border);" });
    const left = el("div");
    const titel = el("strong", { textContent: a.role + (a.team ? " (" + a.team + ")" : ""), style: "font-size:14px;color:var(--navy);display:block;" });
    const statusBadge = el("span", { style: "display:inline-block;margin-top:3px;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;" });

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

    if (assignments.length > 1) {
      const remBtn = el("button", { type: "button", textContent: "×", style: "width:28px;height:28px;border-radius:50%;background:#fee2e2;color:#dc2626;padding:0;margin:0;font-size:16px;" });
      remBtn.onclick = async () => {
        if (!confirm("Diese Funktion wirklich aus deinem Profil entfernen?")) return;
        const neueListe = assignments.filter((_, i) => i !== idx);
        await aktualisiereEigenesProfil(user, neueListe);
      };
      row.appendChild(remBtn);
    }
    container.appendChild(row);
  });

  const addRoleBtn = el("button", { type: "button", className: "btn-secondary", textContent: "+ Weitere Funktion / Team hinzufügen", style: "margin-top:6px;" });
  addRoleBtn.onclick = () => oeffneWeitereRolleModal(user);
  container.appendChild(addRoleBtn);

  const freigabeBox = el("div", { id: "offene-freigaben-box", style: "margin-top:20px;" });
  container.appendChild(freigabeBox);
  await ladeOffeneFreigaben(user, freigabeBox);

  const logoutBtn = el("button", { type: "button", className: "btn-danger", textContent: "Ausloggen", style: "margin-top:20px;" });
  logoutBtn.onclick = () => { localStorage.removeItem("tsv_user_data"); renderLogin(); };
  container.appendChild(logoutBtn);
}

function oeffneWeitereRolleModal(user) {
  const backdrop = el("div", { className: "modal-backdrop" });
  const sheet = el("div", { className: "bottom-sheet" });

  const head = el("div", { className: "sheet-header" });
  const h3 = el("h3", { textContent: "Weitere Funktion hinzufügen", style: "margin:0;font-size:18px;color:var(--navy);" });
  const closeBtn = el("button", { type: "button", className: "sheet-close", textContent: "×" });
  closeBtn.onclick = () => backdrop.remove();
  head.append(h3, closeBtn);

  const roleSel = el("select");
  ["Eltern", "Trainer", "Platzwart", "Jugendleiter", "Spartenleiter", "Vorstand", "Fan"].forEach(r => {
    roleSel.appendChild(el("option", { value: r, textContent: r }));
  });

  const teamWrap = el("div");
  const teamSel = el("select");
  MANNSCHAFTEN.forEach(m => teamSel.appendChild(el("option", { value: m, textContent: m })));
  teamWrap.append(erstelleLabel("Mannschaft auswählen"), teamSel);

  roleSel.onchange = () => {
    const keinTeam = ["Fan", "Platzwart", "Vorstand", "Jugendleiter", "Spartenleiter"].includes(roleSel.value);
    teamWrap.style.display = keinTeam ? "none" : "block";
  };

  const saveBtn = el("button", { type: "button", className: "btn-success", textContent: "Freigabe anfragen" });
  saveBtn.onclick = async () => {
    const keinTeam = ["Fan", "Platzwart", "Vorstand", "Jugendleiter", "Spartenleiter"].includes(roleSel.value);
    const gewaehltesTeam = keinTeam ? "" : teamSel.value;
    if ((user.assignments || []).some(a => a.role === roleSel.value && a.team === gewaehltesTeam)) {
      alert("Diese Funktion ist bereits in deinem Profil hinterlegt!");
      return;
    }
    const neuerStatus = roleSel.value === "Fan" ? "approved" : "pending";
    const neueListe = [...(user.assignments || []), { role: roleSel.value, team: gewaehltesTeam, status: neuerStatus }];
    saveBtn.textContent = "Sende Anfrage...";
    await aktualisiereEigenesProfil(user, neueListe);
    backdrop.remove();
  };

  backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
  sheet.append(head, erstelleLabel("Funktion"), roleSel, teamWrap, saveBtn);
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
}

async function aktualisiereEigenesProfil(user, neueAssignments) {
  const rechte = berechneGesamtRechte(neueAssignments);
  const haupt = neueAssignments.find(a => a.status === "approved") || neueAssignments.slice(0, 1).pop();
  const updatedProfile = { email: user.email, role: haupt ? haupt.role : "Fan", team: haupt ? haupt.team : "", assignments: neueAssignments, ...rechte };
  await saveUserProfile(user.uid, user.idToken, updatedProfile);
  const fullUser = { ...updatedProfile, uid: user.uid, idToken: user.idToken, refreshToken: user.refreshToken };
  localStorage.setItem("tsv_user_data", JSON.stringify(fullUser));
  renderDashboard(fullUser);
}

async function ladeOffeneFreigaben(user, targetBox) {
  try {
    const res = await fetch(rollenDbHost + "/users.json?auth=" + user.idToken);
    if (!res.ok) return;
    const allUsers = await res.json();
    if (!allUsers) return;

    const offene = [];
    Object.keys(allUsers).forEach(uid => {
      const u = allUsers[uid];
      const list = u.assignments || (u.role ? [{ role: u.role, team: u.team || "", status: "approved" }] : []);
      list.forEach((a, index) => {
        if (darfAnfrageFreigeben(user, a)) offene.push({ uid, email: u.email, assignmentIndex: index, assignment: a, fullAssignments: list });
      });
    });

    aktualisiereProfilBadge(offene.length);
    if (!targetBox) return;
    targetBox.innerHTML = "";
    if (offene.length === 0) return;

    targetBox.appendChild(el("h3", { textContent: "🔔 Offene Freigaben (" + offene.length + ")", style: "margin:0 0 10px;font-size:13px;text-transform:uppercase;color:var(--danger);" }));

    offene.forEach(item => {
      const card = el("div", { style: "padding:12px;background:#fff1f2;border:1px solid #fecdd3;border-radius:14px;margin-bottom:10px;" });
      const info = el("div", { style: "font-size:13px;color:var(--navy);margin-bottom:8px;font-weight:600;" });
      info.textContent = item.email + " → " + item.assignment.role + (item.assignment.team ? " (" + item.assignment.team + ")" : "");

      const btnRow = el("div", { style: "display:flex;gap:8px;" });
      const okBtn = el("button", { type: "button", className: "btn-success", textContent: "✓ Freigeben", style: "padding:8px;margin:0;font-size:12px;flex:1;" });
      okBtn.onclick = async () => { okBtn.textContent = "..."; await bearbeiteFremdeAnfrage(user, item, true, targetBox); };

      const noBtn = el("button", { type: "button", className: "btn-danger", textContent: "✕ Ablehnen", style: "padding:8px;margin:0;font-size:12px;flex:1;" });
      noBtn.onclick = async () => { if (confirm("Anfrage wirklich ablehnen?")) await bearbeiteFremdeAnfrage(user, item, false, targetBox); };

      btnRow.append(okBtn, noBtn);
      card.append(info, btnRow);
      targetBox.appendChild(card);
    });
  } catch (e) {}
}

async function bearbeiteFremdeAnfrage(adminUser, item, freigeben, targetBox) {
  let neueListe = [...item.fullAssignments];
  if (freigeben) neueListe[item.assignmentIndex].status = "approved";
else neueListe = neueListe.filter((_, idx) => idx !== item.assignmentIndex);
const rechte = berechneGesamtRechte(neueListe);
const haupt = neueListe.find(a => a.status === "approved") || neueListe.slice(0, 1).pop() || { role: "Fan", team: "" };
await fetch(rollenDbHost + "/users/" + item.uid + ".json?auth=" + adminUser.idToken, {
method: "PATCH",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ role: haupt.role, team: haupt.team || "", assignments: neueListe, ...rechte })
});
await ladeOffeneFreigaben(adminUser, targetBox);
}
function aktualisiereProfilBadge(anzahl) {
const profilTab = document.getElementById("nav-tab-profil");
if (!profilTab) return;
let badge = document.getElementById("profil-notif-badge");
if (anzahl > 0) {
if (!badge) {
badge = el("span", { id: "profil-notif-badge", style: "position:absolute;top:2px;right:8px;background:var(--danger);color:white;font-size:10px;font-weight:800;padding:1px 5px;border-radius:10px;" });
profilTab.style.position = "relative";
profilTab.appendChild(badge);
}
badge.textContent = String(anzahl);
} else if (badge) badge.remove();
}
