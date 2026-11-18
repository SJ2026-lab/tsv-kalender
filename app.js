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
  head.innerHTML = '<div class="brand"><div class="club-crest">TSV</div><div><h1>TSV Termine</h1><p>Vereins- & Mannschafts-App</p></div></div>';

  const box = el("div", { className: "box" });
  box.innerHTML = '<h2 style="margin:0 0 14px;color:var(--navy);">Willkommen zurück</h2>';

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
  head.innerHTML = '<div class="brand"><div class="club-crest">TSV</div><div><h1>Mitglied werden</h1><p>Einmalige Registrierung</p></div></div>';

  const box = el("div", { className: "box" });
  box.innerHTML = '<h2 style="margin:0 0 10px;color:var(--navy);">Konto erstellen</h2><p style="font-size:13px;color:var(--muted);margin:0 0 14px;">Gib das <strong>Vereinspasswort</strong> ein und wähle deine Funktion.</p>';

  const clubIn = feld("password", "", "Vereinspasswort");
  const roleSel = el("select");
  roleSel.innerHTML = '<option value="">-- Funktion wählen --</option>' + ROLLEN.map(r => '<option value="' + r + '">' + r + '</option>').join("");
  const teamSel = el("select");
  teamSel.innerHTML = '<option value="">-- Mannschaft wählen --</option>' + MANNSCHAFTEN.map(m => '<option value="' + m + '">' + m + '</option>').join("");

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

  // 1. Header wie auf deinem Bild
  const head = el("div", { className: "app-header" });
  head.innerHTML = '<div class="brand"><div class="club-crest">TSV</div><div><h1>TSV Termine</h1><p>' + (user.team ? user.team : "Gesamtverein") + '</p></div></div><span class="role-pill-mini">' + user.role + '</span>';
  app.appendChild(head);

  // 2. Hauptansicht "Ligen / Kalender"
  const homeView = el("div", { id: "view-home" });

  // Steuerleiste: Alle Mannschaften ▾ | Monat / Woche
  const controlsBar = el("div", { className: "top-controls" });
  const filterBtn = el("button", { type: "button", className: "filter-dropdown-btn" });
  filterBtn.innerHTML = '<span id="filter-btn-label">' + getFilterButtonText() + '</span><span>▾</span>';

  const viewGroup = el("div", { className: "view-toggle-group" });
  const topBtnMonat = el("button", { type: "button", className: "view-toggle-btn active", textContent: "Monat" });
  const topBtnWoche = el("button", { type: "button", className: "view-toggle-btn", textContent: "Woche" });
  viewGroup.append(topBtnMonat, topBtnWoche);
  controlsBar.append(filterBtn, viewGroup);
  homeView.appendChild(controlsBar);

  // Aufklappbare Mehrfachauswahl
  const filterPopover = el("div", { className: "filter-popover hidden" });
  filterPopover.innerHTML = '<div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:8px;">MANNSCHAFTEN AUSWÄHLEN (MEHRFACH MÖGLICH):</div>';
  const chipGrid = el("div", { className: "multi-chip-grid" });

  function aktualisiereFilterChips() {
    chipGrid.innerHTML = "";
    const btnAlle = el("button", {
      type: "button",
      className: "multi-chip" + (ausgewaehlteMannschaften.length === 0 ? " selected" : ""),
      textContent: "✓ Alle anzeigen"
        anzeigen"
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
// 3. News-Karte wie auf deinem Bild
const newsCard = el("div", { className: "news-card" });
newsCard.innerHTML = <div class="news-header"><h3>News</h3><span style="color:var(--navy);font-weight:800;">›</span></div> <div class="news-body"> <div class="news-thumb">⚽</div> <div class="news-text"> <h4>Spielbericht: Sieg gegen Eintracht Frankfurt</h4> <p>Unsere Mannschaft dominierte das Spiel mit 3:1. Hier geht es zum ausführlichen Bericht...</p> </div> </div>;
homeView.appendChild(newsCard);
// 4. 2-Spalten Kalender + Kommende Events Bereich
const kalenderBereich = el("div", { id: "termine-liste" });
homeView.appendChild(kalenderBereich);
// 5. Sponsoren-Banner wie auf deinem Bild
const sponsor = el("div", { className: "sponsor-banner" });
sponsor.innerHTML = <div class="sponsor-logo">TSV Partner<small>Bau & Immobilien</small></div> <div class="sponsor-slogan">Stark im Team –<br>auf und neben dem Platz.</div>;
homeView.appendChild(sponsor);
// Weitere Tab-Ansichten (Platzwart, Chat, Profil)
const platzwartView = el("div", { className: "box hidden" });
platzwartView.innerHTML = '🛠️ Platzwart & KabinenHier richten wir als Nächstes die Platzfreigabe (Rasen / Kunstrasen gesperrt oder frei) sowie die Kabinenbelegung ein.';
const chatView = el("div", { className: "box hidden" });
chatView.innerHTML = '💬 Mannschafts-ChatHier entsteht euer direkter Vereins- & Trainer-Chat für schnelle Absprachen.';
const profilView = el("div", { className: "box hidden" });
const badges = (perms.isAdmin ? 'Admin' : '') +
(perms.canWrite ? 'Lesen & Schreiben' : 'Nur Lesen');
profilView.innerHTML = 'Mein VereinsprofilE-Mail: ' + user.email + 'Funktion: ' + user.role + '' + (user.team ? 'Mannschaft: ' + user.team + '' : '') + '' + badges + '';
const logoutBtn = el("button", { type: "button", className: "btn-danger", textContent: "Ausloggen" });
logoutBtn.onclick = () => { localStorage.removeItem("tsv_user_data"); renderLogin(); };
profilView.appendChild(logoutBtn);
app.append(homeView, platzwartView, chatView, profilView);
if (perms.canWrite && typeof baueTerminEditor === "function") {
baueTerminEditor(app, MANNSCHAFTEN);
}
// Untere Navigationsleiste mit den 4 Tabs: Ligen, Platzwart, Chat, Profil
const nav = el("div", { className: "bottom-nav" });
const tabLigen = el("button", { type: "button", className: "nav-item active", innerHTML: '📅Ligen' });
const tabPlatz = el("button", { type: "button", className: "nav-item", innerHTML: '🛠️Platzwart' });
const tabChat = el("button", { type: "button", className: "nav-item", innerHTML: '💬Chat' });
const tabProfil = el("button", { type: "button", className: "nav-item", innerHTML: '👤Profil' });
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
