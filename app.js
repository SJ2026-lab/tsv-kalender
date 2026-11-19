const VEREINS_PASSWORT = "TSV2026";
const dbHost = "https://kalendertsv-default-rtdb" + ".europe-west1.firebasedatabase.app";
const apiKey = "AIzaSyDATRJtGAkTVg-dB1AkI5jlEwNgBBIK-z8";

const MANNSCHAFTEN = ["U7", "U9", "U11", "U13", "U15", "Altherren", "Damen", "Erste Mannschaft", "2. Mannschaft"];
const ROLLEN = ["Eltern", "Trainer", "Jugendleiter", "Vorstand", "Spartenleiter", "Fan"];

let ausgewaehlteMannschaften = JSON.parse(localStorage.getItem("tsv_team_filter") || "[]");

function el(tag, props) {
  const node = document.createElement(tag);
  if (props) Object.assign(node, props);
  return node;
}

function feld(art, idName, hinweis) {
  const f = document.createElement("in" + "put");
  f.setAttribute("type", art);
  if (idName) f.id = idName;
  if (hinweis) f.placeholder = hinweis;
  return f;
}

function getPermissions(roleOrUser) {
  if (roleOrUser && typeof roleOrUser === "object" && roleOrUser.assignments && typeof berechneGesamtRechte === "function") {
    return berechneGesamtRechte(roleOrUser.assignments);
  }
  const role = typeof roleOrUser === "string" ? roleOrUser : (roleOrUser?.role || "Fan");
  const isVorstand = role === "Vorstand";
  const isAdmin = ["Jugendleiter", "Vorstand", "Spartenleiter"].includes(role);
  const canWrite = !["Eltern", "Fan"].includes(role);
  return { canRead: true, canWrite, isAdmin, isVorstand, canApprove: canWrite, trainerTeams: [] };
}

function translateError(msg) {
  const map = {
    "INVALID_EMAIL": "Bitte gültige E-Mail eingeben.",
    "EMAIL_NOT_FOUND": "Kein Konto gefunden.",
    "INVALID_PASSWORD": "Passwort ist falsch.",
    "INVALID_LOGIN_CREDENTIALS": "E-Mail oder Passwort falsch.",
    "EMAIL_EXISTS": "E-Mail wird bereits verwendet.",
    "WEAK_PASSWORD : Password should be at least 6 characters": "Passwort min. 6 Zeichen."
  };
  return map[msg] || "Fehler: " + msg;
}

async function firebaseAuthRequest(endpoint, email, password) {
  const base = "https://identitytoolkit." + "googleapis.com";
  const res = await fetch(base + "/v1/accounts:" + endpoint + "?key=" + apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Fehler");
  return data;
}

async function refreshSessionToken(user) {
  if (!user || !user.refreshToken) return user;
  try {
    const base = "https://securetoken." + "googleapis.com";
    const res = await fetch(base + "/v1/token?key=" + apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "refresh_token", refresh_token: user.refreshToken })
    });
    if (!res.ok) return null;
    const data = await res.json();
    user.idToken = data.id_token;
    user.refreshToken = data.refresh_token;
    const freshProf = await loadUserProfile(user.uid, user.idToken);
    if (freshProf) {
      user = { ...freshProf, uid: user.uid, idToken: user.idToken, refreshToken: user.refreshToken };
    }
    localStorage.setItem("tsv_user_data", JSON.stringify(user));
    return user;
  } catch (e) { return user; }
}

async function saveUserProfile(uid, idToken, profile) {
  const res = await fetch(dbHost + "/users/" + uid + ".json?auth=" + idToken, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile)
  });
  if (!res.ok) throw new Error("Speicherfehler (" + res.status + ")");
}

async function loadUserProfile(uid, idToken) {
  try {
    const res = await fetch(dbHost + "/users/" + uid + ".json?auth=" + idToken);
    return res.ok ? await res.json() : null;
  } catch (e) { return null; }
}

function renderLogin() {
  const app = document.getElementById("app");
  app.innerHTML = "";

  const head = el("div", { className: "app-header" });
  const brand = el("div", { className: "brand" });
  const crest = el("div", { className: "club-crest", textContent: "TSV" });
  const titles = el("div");
  titles.append(el("h1", { textContent: "TSV Termine" }), el("p", { textContent: "Vereins- & Mannschafts-App" }));
  brand.append(crest, titles);
  head.appendChild(brand);

  const box = el("div", { className: "box" });
  box.appendChild(el("h2", { textContent: "Willkommen zurück", style: "margin:0 0 14px;color:var(--navy);" }));

  const emailIn = feld("email", "", "E-Mail-Adresse");
  const passIn = feld("password", "", "Passwort");
  const loginBtn = el("button", { type: "button", textContent: "Anmelden" });
  const toRegBtn = el("button", { type: "button", className: "btn-secondary", textContent: "Neu im Verein? Konto erstellen" });
  const errP = el("p", { style: "color:var(--danger);font-size:14px;font-weight:600;margin:0;" });

  loginBtn.onclick = async () => {
    errP.textContent = "Logge ein...";
    try {
      const auth = await firebaseAuthRequest("signInWithPassword", emailIn.value.trim(), passIn.value);
      let prof = await loadUserProfile(auth.localId, auth.idToken);
      if (!prof) {
        const initAssign = [{ role: "Vorstand", team: "", status: "approved" }];
        prof = { email: auth.email, role: "Vorstand", team: "", assignments: initAssign, ...getPermissions({ assignments: initAssign }) };
        await saveUserProfile(auth.localId, auth.idToken, prof);
      } else if (!prof.assignments) {
        prof.assignments = [{ role: prof.role || "Vorstand", team: prof.team || "", status: "approved" }];
      }
      prof.idToken = auth.idToken;
      prof.refreshToken = auth.refreshToken;
      prof.uid = auth.localId;
      localStorage.setItem("tsv_user_data", JSON.stringify(prof));
      renderDashboard(prof);
    } catch (e) { errP.textContent = translateError(e.message); }
  };

  toRegBtn.onclick = () => renderRegister();
  box.append(emailIn, passIn, loginBtn, toRegBtn, errP);
  app.append(head, box);
}

function renderRegister() {
  const app = document.getElementById("app");
  app.innerHTML = "";

  const head = el("div", { className: "app-header" });
  const brand = el("div", { className: "brand" });
  const crest = el("div", { className: "club-crest", textContent: "TSV" });
  const titles = el("div");
  titles.append(el("h1", { textContent: "Mitglied werden" }), el("p", { textContent: "Einmalige Registrierung" }));
  brand.append(crest, titles);
  head.appendChild(brand);

  const box = el("div", { className: "box" });
  box.append(
    el("h2", { textContent: "Konto erstellen", style: "margin:0 0 10px;color:var(--navy);" }),
    el("p", { textContent: "Wähle deine Hauptfunktion. Weitere Teams kannst du danach im Profil hinzufügen.", style: "font-size:13px;color:var(--muted);margin:0 0 14px;" })
  );

  const clubIn = feld("password", "", "Vereinspasswort");
  const roleSel = el("select");
  roleSel.appendChild(el("option", { value: "", textContent: "-- Hauptfunktion wählen --" }));
  ROLLEN.forEach(r => roleSel.appendChild(el("option", { value: r, textContent: r })));

  const teamSel = el("select");
  teamSel.appendChild(el("option", { value: "", textContent: "-- Mannschaft wählen --" }));
  MANNSCHAFTEN.forEach(m => teamSel.appendChild(el("option", { value: m, textContent: m })));

  roleSel.onchange = () => {
    const brauchtKeinTeam = ["Fan", "Vorstand", "Jugendleiter", "Spartenleiter"].includes(roleSel.value);
    teamSel.style.display = brauchtKeinTeam ? "none" : "block";
  };

  const emailIn = feld("email", "", "Deine E-Mail-Adresse");
  const passIn = feld("password", "", "Eigenes Passwort (min. 6 Zeichen)");
  const regBtn = el("button", { type: "button", className: "btn-success", textContent: "Registrierung abschließen" });
  const backBtn = el("button", { type: "button", className: "btn-secondary", textContent: "Zurück zum Login" });
  const errP = el("p", { style: "color:var(--danger);font-size:14px;font-weight:600;margin:0;" });

  regBtn.onclick = async () => {
    if (clubIn.value.trim() !== VEREINS_PASSWORT) { errP.textContent = "Vereinspasswort falsch!"; return; }
    if (!roleSel.value) { errP.textContent = "Bitte Funktion wählen!"; return; }
    const brauchtKeinTeam = ["Fan", "Vorstand", "Jugendleiter", "Spartenleiter"].includes(roleSel.value);
    if (!brauchtKeinTeam && !teamSel.value) { errP.textContent = "Bitte Mannschaft wählen!"; return; }

    errP.textContent = "Konto wird erstellt...";
    try {
      const auth = await firebaseAuthRequest("signUp", emailIn.value.trim(), passIn.value);
      const status = roleSel.value === "Fan" ? "approved" : "pending";
      const gewaehltesTeam = brauchtKeinTeam ? "" : teamSel.value;
      const assignments = [{ role: roleSel.value, team: gewaehltesTeam, status }];
      const rechte = getPermissions({ assignments });

      const profile = { email: auth.email, role: roleSel.value, team: gewaehltesTeam, assignments, ...rechte };
      await saveUserProfile(auth.localId, auth.idToken, profile);
      const fullUser = { ...profile, uid: auth.localId, idToken: auth.idToken, refreshToken: auth.refreshToken };
      localStorage.setItem("tsv_user_data", JSON.stringify(fullUser));
      renderDashboard(fullUser);
    } catch (e) { errP.textContent = translateError(e.message); }
  };

  backBtn.onclick = () => renderLogin();
  box.append(clubIn, roleSel, teamSel, emailIn, passIn, regBtn, backBtn, errP);
  app.append(head, box);
}

function getFilterButtonText() {
  if (!ausgewaehlteMannschaften || ausgewaehlteMannschaften.length === 0) return "Alle Mannschaften";
  if (ausgewaehlteMannschaften.length <= 2) return ausgewaehlteMannschaften.join(", ");
  return ausgewaehlteMannschaften.length + " Mannschaften";
}

function renderDashboard(user) {
  const app = document.getElementById("app");
  app.innerHTML = "";

  if (!user.assignments) {
    user.assignments = [{ role: user.role || "Vorstand", team: user.team || "", status: "approved" }];
  }

  const perms = getPermissions(user);
  user.canWrite = perms.canWrite;
  user.isAdmin = perms.isAdmin;
user.isVorstand = perms.isVorstand;
const aktiveRollenText = user.assignments
.filter(a => a.status === "approved")
.map(a => a.role + (a.team ? " " + a.team : ""))
.join(" • ") || "Wartet auf Freigabe";
const head = el("div", { className: "app-header" });
const brand = el("div", { className: "brand" });
const crest = el("div", { className: "club-crest", textContent: "TSV" });
const titles = el("div");
titles.append(el("h1", { textContent: "TSV Termine" }), el("p", { textContent: aktiveRollenText }));
brand.append(crest, titles);
const hauptRolle = (user.assignments.find(a => a.status === "approved") || user.assignments.slice(0, 1).pop())?.role || "Mitglied";
const roleBadge = el("span", { className: "role-pill-mini", textContent: hauptRolle });
head.append(brand, roleBadge);
app.appendChild(head);
const offeneEigene = user.assignments.filter(a => a.status === "pending");
if (offeneEigene.length > 0) {
const infoBanner = el("div", {
style: "background:#fef3c7;color:#92400e;padding:10px 14px;border-radius:14px;font-size:12px;font-weight:700;margin-bottom:12px;border:1px solid #fde68a;"
});
infoBanner.textContent = "⏳ Offene Freigabe für: " + offeneEigene.map(a => a.role + (a.team ? " (" + a.team + ")" : "")).join(", ");
app.appendChild(infoBanner);
}
const homeView = el("div", { id: "view-home" });
const controlsBar = el("div", { className: "top-controls" });
const filterBtn = el("button", { type: "button", className: "filter-dropdown-btn" });
const filterLabel = el("span", { id: "filter-btn-label", textContent: getFilterButtonText() });
const filterArrow = el("span", { textContent: "▾" });
filterBtn.append(filterLabel, filterArrow);
const viewGroup = el("div", { className: "view-toggle-group" });
const topBtnMonat = el("button", { type: "button", className: "view-toggle-btn active", textContent: "Monat" });
const topBtnWoche = el("button", { type: "button", className: "view-toggle-btn", textContent: "Woche" });
viewGroup.append(topBtnMonat, topBtnWoche);
controlsBar.append(filterBtn, viewGroup);
homeView.appendChild(controlsBar);
const filterPopover = el("div", { className: "filter-popover hidden" });
filterPopover.appendChild(el("div", {
textContent: "MANNSCHAFTEN AUSWÄHLEN (MEHRFACH MÖGLICH):",
style: "font-size:11px;font-weight:700;color:var(--muted);margin-bottom:8px;"
}));
const chipGrid = el("div", { className: "multi-chip-grid" });
function aktualisiereFilterChips() {
chipGrid.innerHTML = "";
const btnAlle = el("button", {
type: "button",
className: "multi-chip" + (ausgewaehlteMannschaften.length === 0 ? " selected" : ""),
textContent: "✓ Alle anzeigen"
});
btnAlle.onclick = () => {
ausgewaehlteMannschaften = [];
localStorage.setItem("tsv_team_filter", "[]");
document.getElementById("filter-btn-label").textContent = getFilterButtonText();
aktualisiereFilterChips();
if (typeof renderKalenderAnsicht === "function") renderKalenderAnsicht();
};
chipGrid.appendChild(btnAlle);
MANNSCHAFTEN.forEach(team => {
const istAktiv = ausgewaehlteMannschaften.includes(team);
const cBtn = el("button", {
type: "button",
className: "multi-chip" + (istAktiv ? " selected" : ""),
textContent: (istAktiv ? "✓ " : "") + team
});
cBtn.onclick = () => {
if (ausgewaehlteMannschaften.includes(team)) {
ausgewaehlteMannschaften = ausgewaehlteMannschaften.filter(t => t !== team);
} else {
ausgewaehlteMannschaften.push(team);
}
localStorage.setItem("tsv_team_filter", JSON.stringify(ausgewaehlteMannschaften));
document.getElementById("filter-btn-label").textContent = getFilterButtonText();
aktualisiereFilterChips();
if (typeof renderKalenderAnsicht === "function") renderKalenderAnsicht();
};
chipGrid.appendChild(cBtn);
});
}
aktualisiereFilterChips();
const closeFilterBtn = el("button", { type: "button", className: "btn-success", style: "padding:10px;margin:0;font-size:13px;", textContent: "Auswahl übernehmen" });
closeFilterBtn.onclick = () => filterPopover.classList.add("hidden");
filterPopover.append(chipGrid, closeFilterBtn);
homeView.appendChild(filterPopover);
filterBtn.onclick = () => filterPopover.classList.toggle("hidden");
const newsSlot = el("div", { id: "news-slot" });
homeView.appendChild(newsSlot);
const kalenderBereich = el("div", { id: "termine-liste" });
homeView.appendChild(kalenderBereich);
const sponsorSlot = el("div", { id: "sponsor-slot" });
homeView.appendChild(sponsorSlot);
const platzwartView = el("div", { className: "box hidden" });
platzwartView.append(
el("h2", { textContent: "🛠️ Platzwart & Kabinen", style: "margin:0 0 8px;color:var(--navy);" }),
el("p", { textContent: "Hier richten wir als Nächstes die Platzfreigabe (Rasen / Kunstrasen gesperrt oder frei) sowie die Kabinenbelegung ein.", style: "font-size:14px;color:var(--muted);margin:0;" })
);
const chatView = el("div", { className: "box hidden" });
chatView.append(
el("h2", { textContent: "💬 Mannschafts-Chat", style: "margin:0 0 8px;color:var(--navy);" }),
el("p", { textContent: "Hier entsteht euer direkter Vereins- & Trainer-Chat für schnelle Absprachen.", style: "font-size:14px;color:var(--muted);margin:0;" })
);
const profilView = el("div", { id: "profil-view-box", className: "box hidden" });
app.append(homeView, platzwartView, chatView, profilView);
if (perms.canWrite && typeof baueTerminEditor === "function") {
const erlaubteTeams = perms.isAdmin ? MANNSCHAFTEN : perms.trainerTeams;
baueTerminEditor(app, erlaubteTeams, perms.isAdmin);
}
const nav = el("div", { className: "bottom-nav" });
function baueNavTab(icon, label, aktiv, idName) {
const b = el("button", { type: "button", className: "nav-item" + (aktiv ? " active" : "") });
if (idName) b.id = idName;
b.append(el("span", { className: "nav-icon", textContent: icon }), el("span", { textContent: label }));
return b;
}
const tabLigen = baueNavTab("📅", "Ligen", true, "nav-tab-ligen");
const tabPlatz = baueNavTab("🛠️", "Platzwart", false, "nav-tab-platz");
const tabChat = baueNavTab("💬", "Chat", false, "nav-tab-chat");
const tabProfil = baueNavTab("👤", "Profil", false, "nav-tab-profil");
function zeigeTab(aktivBtn, zielView) {
nav.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
aktivBtn.classList.add("active");
[homeView, platzwartView, chatView, profilView].forEach(v => v.classList.add("hidden"));
zielView.classList.remove("hidden");
}
tabLigen.onclick = () => zeigeTab(tabLigen, homeView);
tabPlatz.onclick = () => zeigeTab(tabPlatz, platzwartView);
tabChat.onclick = () => zeigeTab(tabChat, chatView);
tabProfil.onclick = () => {
zeigeTab(tabProfil, profilView);
if (typeof ladeUndZeichneProfil === "function") ladeUndZeichneProfil(user, profilView);
};
topBtnMonat.onclick = () => {
topBtnMonat.classList.add("active");
topBtnWoche.classList.remove("active");
if (typeof wechseleAnsicht === "function") wechseleAnsicht("MONAT");
};
topBtnWoche.onclick = () => {
topBtnWoche.classList.add("active");
topBtnMonat.classList.remove("active");
filterPopover.classList.add("hidden");
if (typeof wechseleAnsicht === "function") wechseleAnsicht("WOCHE");
};
nav.append(tabLigen, tabPlatz, tabChat, tabProfil);
app.appendChild(nav);
if (typeof ladeVereinsInfos === "function") ladeVereinsInfos();
if (typeof ladeTermine === "function") ladeTermine();
if (typeof ladeUndZeichneProfil === "function") ladeUndZeichneProfil(user, profilView);
}
async function starteApp() {
const saved = localStorage.getItem("tsv_user_data");
if (saved) {
try {
let user = JSON.parse(saved);
user = await refreshSessionToken(user);
if (user) { renderDashboard(user); return; }
} catch (e) {}
}
renderLogin();
}
starteApp();
