// HIER EUER VEREINSPASSWORT FESTLEGEN:
const VEREINS_PASSWORT = "TSV2026";

const dbHost = "https://kalendertsv-default-rtdb" + ".europe-west1.firebasedatabase.app";

const firebaseConfig = {
  apiKey: "AIzaSyDATRJtGAkTVg-dB1AkI5jlEwNgBBIK-z8",
  authDomain: "kalendertsv." + "firebaseapp.com",
  databaseURL: dbHost,
  projectId: "kalendertsv",
  storageBucket: "kalendertsv.firebasestorage.app",
  messagingSenderId: "693122891208",
  appId: "1:693122891208:web:01cdd76b4ec0d3995894fd",
  measurementId: "G-S138SYNHFL"
};

// Bereiche & Formulare
const loginBox = document.getElementById("login-box");
const registerBox = document.getElementById("register-box");
const userSection = document.getElementById("user-section");
const roleSelect = document.getElementById("reg-role");
const teamWrapper = document.getElementById("team-wrapper");
const teamSelect = document.getElementById("reg-team");

// Fehler & User-Anzeige
const loginError = document.getElementById("login-error");
const regError = document.getElementById("reg-error");

// Berechtigungen anhand der Rolle berechnen
function getPermissions(role) {
  const isAdmin = ["Jugendleiter", "Vorstand", "Spartenleiter"].includes(role);
  const canWrite = !["Eltern", "Fan"].includes(role);
  const canRead = true;
  return { canRead, canWrite, isAdmin };
}

// Mannschafts-Dropdown ausblenden, wenn "Fan" gewählt wird
roleSelect.addEventListener("change", () => {
  if (roleSelect.value === "Fan") {
    teamWrapper.classList.add("hidden");
    teamSelect.value = "";
  } else {
    teamWrapper.classList.remove("hidden");
  }
});

function translateError(msg) {
  const messages = {
    "INVALID_EMAIL": "Bitte gib eine gültige E-Mail-Adresse ein.",
    "EMAIL_NOT_FOUND": "Kein Konto mit dieser E-Mail gefunden.",
    "INVALID_PASSWORD": "Das Passwort ist falsch.",
    "INVALID_LOGIN_CREDENTIALS": "E-Mail oder Passwort ist falsch.",
    "EMAIL_EXISTS": "Diese E-Mail wird bereits verwendet.",
    "WEAK_PASSWORD : Password should be at least 6 characters": "Das Passwort muss mindestens 6 Zeichen lang sein.",
    "OPERATION_NOT_ALLOWED": "E-Mail/Passwort-Login ist in Firebase noch nicht aktiviert."
  };
  return messages[msg] || "Fehler: " + msg;
}

// UI nach Login/Logout aktualisieren
function updateUI(userData) {
  loginError.textContent = "";
  regError.textContent = "";

  if (userData && userData.email) {
    localStorage.setItem("tsv_user_data", JSON.stringify(userData));
    loginBox.classList.add("hidden");
    registerBox.classList.add("hidden");
    userSection.classList.remove("hidden");

    document.getElementById("user-email").textContent = userData.email;
    document.getElementById("user-role").textContent = userData.role || "Mitglied";

    const teamRow = document.getElementById("user-team-row");
    if (userData.role === "Fan" || !userData.team) {
      teamRow.classList.add("hidden");
    } else {
      teamRow.classList.remove("hidden");
      document.getElementById("user-team").textContent = userData.team;
    }

    const perms = getPermissions(userData.role);
    const badgesDiv = document.getElementById("user-badges");
    badgesDiv.innerHTML = "";

    if (perms.isAdmin) {
      badgesDiv.innerHTML += '<span class="badge badge-admin">Admin</span>';
    }
    if (perms.canWrite) {
      badgesDiv.innerHTML += '<span class="badge badge-write">Lesen & Schreiben</span>';
      document.getElementById("write-area").classList.remove("hidden");
    } else {
      badgesDiv.innerHTML += '<span class="badge badge-read">Nur Lesen</span>';
      document.getElementById("write-area").classList.add("hidden");
    }

    if (perms.isAdmin) {
      document.getElementById("admin-area").classList.remove("hidden");
    } else {
      document.getElementById("admin-area").classList.add("hidden");
    }
  } else {
    localStorage.removeItem("tsv_user_data");
    loginBox.classList.remove("hidden");
    registerBox.classList.add("hidden");
    userSection.classList.add("hidden");
  }
}

// Masken umschalten
document.getElementById("show-register-btn").addEventListener("click", () => {
  loginError.textContent = "";
  loginBox.classList.add("hidden");
  registerBox.classList.remove("hidden");
});

document.getElementById("back-to-login-btn").addEventListener("click", () => {
  regError.textContent = "";
  registerBox.classList.add("hidden");
  loginBox.classList.remove("hidden");
});

// Firebase Auth Anfrage
async function firebaseAuthRequest(endpoint, email, password) {
  const host = "https://identitytoolkit." + "googleapis.com";
  const path = "/v1/accounts:" + endpoint;
  const url = host + path + "?key=" + firebaseConfig.apiKey;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Unbekannter Fehler");
  }
  return data;
}

// Profil in Firebase Realtime Database speichern
async function saveUserProfile(uid, idToken, profile) {
  const url = dbHost + "/users/" + uid + ".json?auth=" + idToken;
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile)
  });
  if (!response.ok) {
    throw new Error("Datenbank-Fehler beim Speichern (" + response.status + ")");
  }
}

// Profil aus Firebase Realtime Database laden (sicher gegen Netzwerkfehler)
async function loadUserProfile(uid, idToken) {
  try {
    const url = dbHost + "/users/" + uid + ".json?auth=" + idToken;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    return null;
  }
}

// Einloggen
document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  loginError.textContent = "Logge ein...";
  try {
    const authData = await firebaseAuthRequest("signInWithPassword", email, password);
    const profile = await loadUserProfile(authData.localId, authData.idToken);

    const userData = profile || {
      email: authData.email,
      role: "Vorstand",
      team: "Erste Mannschaft",
      ...getPermissions("Vorstand")
    };
    userData.idToken = authData.idToken;
    userData.uid = authData.localId;

    document.getElementById("login-email").value = "";
    document.getElementById("login-password").value = "";
    updateUI(userData);
  } catch (err) {
    loginError.textContent = translateError(err.message);
  }
});

// Registrieren
document.getElementById("register-btn").addEventListener("click", async () => {
  const clubPw = document.getElementById("club-password").value.trim();
  const role = roleSelect.value;
  const team = role === "Fan" ? "" : teamSelect.value;
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;

  if (clubPw !== VEREINS_PASSWORT) {
    regError.textContent = "Das Vereinspasswort ist falsch!";
    return;
  }
  if (!role) {
    regError.textContent = "Bitte wähle deine Funktion im Verein aus!";
    return;
  }
  if (role !== "Fan" && !team) {
    regError.textContent = "Bitte wähle deine Mannschaft aus!";
    return;
  }

  regError.textContent = "Konto & Profil werden erstellt...";
  try {
    const authData = await firebaseAuthRequest("signUp", email, password);
    const permissions = getPermissions(role);

    const profile = {
      email: authData.email,
      role: role,
      team: team,
      canRead: permissions.canRead,
      canWrite: permissions.canWrite,
      isAdmin: permissions.isAdmin,
      createdAt: new Date().toISOString()
    };

    await saveUserProfile(authData.localId, authData.idToken, profile);

    document.getElementById("club-password").value = "";
    document.getElementById("reg-email").value = "";
    document.getElementById("reg-password").value = "";
    roleSelect.value = "";
    teamSelect.value = "";

    updateUI({ ...profile, uid: authData.localId, idToken: authData.idToken });
  } catch (err) {
    regError.textContent = translateError(err.message);
  }
});

// Ausloggen
document.getElementById("logout-btn").addEventListener("click", () => {
  updateUI(null);
});

// Gespeicherten Login beim Laden wiederherstellen
const savedUser = localStorage.getItem("tsv_user_data");
if (savedUser) {
  try {
    updateUI(JSON.parse(savedUser));
  } catch (e) {
    updateUI(null);
  }
} else {
  updateUI(null);
}

