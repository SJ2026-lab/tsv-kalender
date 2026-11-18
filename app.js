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

function getPermissions(role) {
  const isAdmin = ["Jugendleiter", "Vorstand", "Spartenleiter"].includes(role);
  const canWrite = !["Eltern", "Fan"].includes(role);
  return { canRead: true, canWrite, isAdmin };
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
        prof = { email: auth.email, role: "Vorstand", team: "Erste Mannschaft", ...getPermissions("Vorstand") };
        await saveUserProfile(auth.localId, auth.idToken, prof);
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
    el("p", { textContent: "Gib das Vereinspasswort ein und wähle deine Funktion.", style: "font-size:13px;color:var(--muted);margin:0 0 14px;" })
  );

  const clubIn = feld("password", "", "Vereinspasswort");
  const roleSel = el("select");
  roleSel.appendChild(el("option", { value: "", textContent: "-- Funktion wählen --" }));
  ROLLEN.forEach(r => roleSel.appendChild(el("option", { value: r, textContent: r })));

  const teamSel = el("select");
  teamSel.appendChild(el("option", { value: "", textContent: "-- Mannschaft wählen --" }));
  MANNSCHAFTEN.forEach(m => teamSel.appendChild(el("option", { value: m, textContent: m })));

  roleSel.onchange = () => { teamSel.style.display = roleSel.value === "Fan" ? "none" : "block"; };

  const emailIn = feld("email", "", "Deine E-Mail-Adresse");
  const passIn = feld("password", "", "Eigenes Passwort (min. 6 Zeichen)");
  const regBtn = el("button", { type: "button", className: "btn-success", textContent: "Registrierung abschließen" });
  const backBtn = el("button", { type: "button", className: "btn-secondary", textContent: "Zurück zum Login" });
  const errP = el("p", { style: "color:var(--danger);font-size:14px;font-weight:600;margin:0;" });

  regBtn.onclick = async () => {
    if (clubIn.value.trim() !== VEREINS_PASSWORT) { errP.textContent = "Vereinspasswort falsch!"; return; }
    if (!roleSel.value) { errP.textContent = "Bitte Funktion wählen!"; return; }
    if (roleSel.value !== "Fan" && !teamSel.value) { errP.textContent = "Bitte Mannschaft wählen!"; return; }
    errP.textContent = "Konto wird erstellt...";
    try {
      const auth = await firebaseAuthRequest("signUp", emailIn.value.trim(), passIn.value);
      const perms = getPermissions(roleSel.value);
      const profile = { email: auth.email, role: roleSel.value, team: roleSel.value === "Fan" ? "" : teamSel.value, ...perms };
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
  const perms = getPermissions(user.role);

  const head = el("div", { className: "app-header" });
  const brand = el("div", { className: "brand" });
  const crest = el("div", { className: "club-crest", textContent: "TSV" });
  const titles = el("div");
  titles.append(
    el("h1", { textContent: "TSV Termine" }),
    el("p", { textContent: user.team ? user.team : "Gesamtverein" })
  );
  brand.append(crest, titles);
  const roleBadge = el("span", { className: "role-pill-mini", textContent: user.role });
  head.append(brand, roleBadge);
  app.appendChild(head);

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
// Dynamischer News-Slot (aus vereinsinfos.js)
const newsSlot = el("div", { id: "news-slot" });
homeView.appendChild(newsSlot);
// 2-Spalten Kalender + Kommende Events Bereich
const kalenderBereich = el("div", { id: "termine-liste" });
homeView.appendChild(kalenderBereich);
// Dynamischer Sponsoren-Slot (aus vereinsinfos.js)
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
const profilView = el("div", { className: "box hidden" });
profilView.append(
el("h2", { textContent: "Mein Vereinsprofil", style: "margin:0 0 12px;color:var(--navy);" }),
el("p", { textContent: "E-Mail: " + user.email, style: "font-size:14px;margin:0 0 8px;font-weight:600;" }),
el("p", { textContent: "Funktion: " + user.role, style: "font-size:14px;margin:0 0 8px;font-weight:600;" })
);
if (user.team) {
profilView.appendChild(el("p", { textContent: "Mannschaft: " + user.team, style: "font-size:14px;margin:0 0 12px;font-weight:600;" }));
}
const badgeRow = el("div", { style: "margin-bottom:20px;" });
if (perms.isAdmin) badgeRow.appendChild(el("span", { className: "badge badge-admin", textContent: "Admin" }));
badgeRow.appendChild(el("span", {
className: perms.canWrite ? "badge badge-write" : "badge badge-read",
textContent: perms.canWrite ? "Lesen & Schreiben" : "Nur Lesen"
}));
profilView.appendChild(badgeRow);
const logoutBtn = el("button", { type: "button", className: "btn-danger", textContent: "Ausloggen" });
logoutBtn.onclick = () => { localStorage.removeItem("tsv_user_data"); renderLogin(); };
profilView.appendChild(logoutBtn);
app.append(homeView, platzwartView, chatView, profilView);
if (perms.canWrite && typeof baueTerminEditor === "function") {
baueTerminEditor(app, MANNSCHAFTEN);
}
const nav = el("div", { className: "bottom-nav" });
function baueNavTab(icon, label, aktiv) {
const b = el("button", { type: "button", className: "nav-item" + (aktiv ? " active" : "") });
b.append(el("span", { className: "nav-icon", textContent: icon }), el("span", { textContent: label }));
return b;
}
const tabLigen = baueNavTab("📅", "Ligen", true);
const tabPlatz = baueNavTab("🛠️", "Platzwart", false);
const tabChat = baueNavTab("💬", "Chat", false);
const tabProfil = baueNavTab("👤", "Profil", false);
function zeigeTab(aktivBtn, zielView) {
nav.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
aktivBtn.classList.add("active");
[homeView, platzwartView, chatView, profilView].forEach(v => v.classList.add("hidden"));
zielView.classList.remove("hidden");
}
tabLigen.onclick = () => zeigeTab(tabLigen, homeView);
tabPlatz.onclick = () => zeigeTab(tabPlatz, platzwartView);
tabChat.onclick = () => zeigeTab(tabChat, chatView);
tabProfil.onclick = () => zeigeTab(tabProfil, profilView);
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
