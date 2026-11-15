const VEREINS_PASSWORT = "TSV2026";
const dbHost = "https://kalendertsv-default-rtdb" + "." + "europe-west1" + "." + "firebasedatabase.app";
const apiKey = "AIzaSyDATRJtGAkTVg-dB1AkI5jlEwNgBBIK-z8";

const MANNSCHAFTEN = ["U7", "U9", "U11", "U13", "U15", "Altherren", "Damen", "Erste Mannschaft", "2. Mannschaft"];
const ROLLEN = ["Eltern", "Trainer", "Jugendleiter", "Vorstand", "Spartenleiter", "Fan"];

function el(tag, props) {
  const node = document.createElement(tag);
  if (props) Object.assign(node, props);
  return node;
}

function feld(art, idName, hinweis) {
  const f = document.createElement("input");
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
    "INVALID_EMAIL": "Bitte gib eine gültige E-Mail-Adresse ein.",
    "EMAIL_NOT_FOUND": "Kein Konto mit dieser E-Mail gefunden.",
    "INVALID_PASSWORD": "Das Passwort ist falsch.",
    "INVALID_LOGIN_CREDENTIALS": "E-Mail oder Passwort ist falsch.",
    "EMAIL_EXISTS": "Diese E-Mail wird bereits verwendet.",
    "WEAK_PASSWORD : Password should be at least 6 characters": "Passwort muss mindestens 6 Zeichen haben."
  };
  return map[msg] || "Fehler: " + msg;
}

async function firebaseAuthRequest(endpoint, email, password) {
  const base = "https://identitytoolkit" + "." + "googleapis" + "." + "com";
  const url = base + "/v1/accounts:" + endpoint + "?key=" + apiKey;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Unbekannter Fehler");
  return data;
}

async function refreshSessionToken(user) {
  if (!user || !user.refreshToken) return user;
  try {
    const base = "https://securetoken" + "." + "googleapis" + "." + "com";
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
  } catch (e) {
    return user;
  }
}

async function saveUserProfile(uid, idToken, profile) {
  const url = dbHost + "/users/" + uid + ".json?auth=" + idToken;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile)
  });
  if (!res.ok) throw new Error("Profil konnte nicht gespeichert werden (" + res.status + ").");
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

  const banner = el("div", { className: "top-banner" });
  banner.innerHTML = '<div class="brand"><div class="club-crest">TSV</div><div><h1>TSV Kalender</h1><p>Vereins- & Mannschaftstermine</p></div></div>';

  const box = el("div", { className: "box" });
  box.innerHTML = "<h2>Willkommen zurück</h2>";

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
  app.append(banner, box);
}

function renderRegister() {
  const app = document.getElementById("app");
  app.innerHTML = "";

  const banner = el("div", { className: "top-banner" });
  banner.innerHTML = '<div class="brand"><div class="club-crest">TSV</div><div><h1>Mitglied werden</h1><p>Einmalige Registrierung</p></div></div>';

  const box = el("div", { className: "box" });
  box.innerHTML = '<h2>Konto erstellen</h2><p class="info-text">Gib das <strong>Vereinspasswort</strong> ein und wähle deine Funktion.</p>';

  const clubIn = feld("password", "", "Vereinspasswort");
  const roleSel = el("select");
  roleSel.innerHTML = '<option value="">-- Funktion wählen --</option>' + ROLLEN.map(r => '<option value="' + r + '">' + r + '</option>').join("");

  const teamSel = el("select");
  teamSel.innerHTML = '<option value="">-- Mannschaft wählen --</option>' + MANNSCHAFTEN.map(m => '<option value="' + m + '">' + m + '</option>').join("");

  roleSel.onchange = () => {
    teamSel.style.display = roleSel.value === "Fan" ? "none" : "block";
  };

  const emailIn = feld("email", "", "Deine E-Mail-Adresse");
  const passIn = feld("password", "", "Eigenes Passwort (min. 6 Zeichen)");
  const regBtn = el("button", { type: "button", className: "btn-success", textContent: "Registrierung abschließen" });
  const backBtn = el("button", { type: "button", className: "btn-secondary", textContent: "Zurück zum Login" });
  const errP = el("p", { style: "color:var(--danger);font-size:14px;font-weight:600;margin:0;" });

  regBtn.onclick = async () => {
    if (clubIn.value.trim() !== VEREINS_PASSWORT) { errP.textContent = "Das Vereinspasswort ist falsch!"; return; }
    if (!roleSel.value) { errP.textContent = "Bitte Funktion auswählen!"; return; }
    if (roleSel.value !== "Fan" && !teamSel.value) { errP.textContent = "Bitte Mannschaft auswählen!"; return; }

    errP.textContent = "Konto wird erstellt...";
    try {
      const auth = await firebaseAuthRequest("signUp", emailIn.value.trim(), passIn.value);
      const perms = getPermissions(roleSel.value);
      const profile = {
        email: auth.email,
        role: roleSel.value,
        team: roleSel.value === "Fan" ? "" : teamSel.value,
        ...perms
      };
      await saveUserProfile(auth.localId, auth.idToken, profile);
      const fullUser = { ...profile, uid: auth.localId, idToken: auth.idToken, refreshToken: auth.refreshToken };
      localStorage.setItem("tsv_user_data", JSON.stringify(fullUser));
      renderDashboard(fullUser);
    } catch (e) { errP.textContent = translateError(e.message); }
  };

  backBtn.onclick = () => renderLogin();

  box.append(clubIn, roleSel, teamSel, emailIn, passIn, regBtn, backBtn, errP);
  app.append(banner, box);
}

function renderDashboard(user) {
  const app = document.getElementById("app");
  app.innerHTML = "";

  const banner = el("div", { className: "top-banner" });
  banner.innerHTML = '<div class="brand"><div class="club-crest">TSV</div><div><h1>TSV Termine</h1><p style="color:#cbd5e1;">' + user.email + '</p></div></div>';
  const logoutBtn = el("button", { type: "button", className: "btn-logout", textContent: "Abmelden" });
  logoutBtn.onclick = () => { localStorage.removeItem("tsv_user_data"); renderLogin(); };
  banner.appendChild(logoutBtn);

  const perms = getPermissions(user.role);
  const pill = el("div", { className: "profile-pill-bar" });
  const badges = (perms.isAdmin ? '<span class="badge badge-admin">Admin</span> ' : '') +
                 (perms.canWrite ? '<span class="badge badge-write">Lesen & Schreiben</span>' : '<span class="badge badge-read">Nur Lesen</span>');
  pill.innerHTML = '<div style="font-size:13px;"><strong>' + user.role + '</strong>' + (user.team ? ' • ' + user.team : '') + '</div><div>' + badges + '</div>';

  app.append(banner, pill);

  if (perms.canWrite) {
    const toggleBtn = el("button", { type: "button", className: "btn-success", textContent: "+ Neuen Termin eintragen" });
    const formPanel = el("div", { className: "form-panel hidden" });

    const titelIn = feld("text", "termin-titel", "Titel (z. B. Heimspiel oder Training)");
    const teamSel = el("select", { id: "termin-team" });
    teamSel.innerHTML = '<option value="Alle Mannschaften">Alle Mannschaften</option>' + MANNSCHAFTEN.map(m => '<option value="' + m + '">' + m + '</option>').join("");
    const datumIn = feld("date", "termin-datum", "");
    const zeitIn = feld("time", "termin-uhrzeit", "");
    const ortIn = feld("text", "termin-ort", "Ort / Sportplatz (optional)");
    const infoIn = el("textarea", { id: "termin-info", rows: 2, placeholder: "Zusatzinfos (optional)" });
    const saveBtn = el("button", { type: "button", className: "btn-success", textContent: "Termin veröffentlichen" });
    const msgP = el("p", { id: "termin-msg", style: "font-size:13px;font-weight:600;margin:0;" });

    saveBtn.onclick = () => { if (typeof speichereTermin === "function") speichereTermin(); };
    toggleBtn.onclick = () => formPanel.classList.toggle("hidden");

