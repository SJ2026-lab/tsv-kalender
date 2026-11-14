// HIER EUER VEREINSPASSWORT FESTLEGEN:
const VEREINS_PASSWORT = "TSV2026";

const firebaseConfig = {
  apiKey: "AIzaSyDATRJtGAkTVg-dB1AkI5jlEwNgBBIK-z8",
  authDomain: "://firebaseapp.com",
  databaseURL: "https://firebasedatabase.app",
  projectId: "kalendertsv",
  storageBucket: "kalendertsv.firebasestorage.app",
  messagingSenderId: "693122891208",
  appId: "1:693122891208:web:01cdd76b4ec0d3995894fd",
  measurementId: "G-S138SYNHFL"
};

// Bereiche
const loginBox = document.getElementById("login-box");
const registerBox = document.getElementById("register-box");
const userSection = document.getElementById("user-section");

// Fehlermeldungen & Anzeige
const loginError = document.getElementById("login-error");
const regError = document.getElementById("reg-error");
const userEmailSpan = document.getElementById("user-email");

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

// Ansicht umschalten
function updateUI(email) {
  loginError.textContent = "";
  regError.textContent = "";
  if (email) {
    localStorage.setItem("tsv_user_email", email);
    loginBox.classList.add("hidden");
    registerBox.classList.add("hidden");
    userSection.classList.remove("hidden");
    userEmailSpan.textContent = email;
  } else {
    localStorage.removeItem("tsv_user_email");
    loginBox.classList.remove("hidden");
    registerBox.classList.add("hidden");
    userSection.classList.add("hidden");
    userEmailSpan.textContent = "";
  }
}

// Wechsel zwischen Login-Maske und Registrierungs-Maske
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

// Einloggen (ohne Vereinspasswort)
document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  loginError.textContent = "Logge ein...";
  try {
    const data = await firebaseAuthRequest("signInWithPassword", email, password);
    document.getElementById("login-email").value = "";
    document.getElementById("login-password").value = "";
    updateUI(data.email);
  } catch (err) {
    loginError.textContent = translateError(err.message);
  }
});

// Registrieren (prüft zuerst das Vereinspasswort!)
document.getElementById("register-btn").addEventListener("click", async () => {
  const clubPw = document.getElementById("club-password").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;

  if (clubPw !== VEREINS_PASSWORT) {
    regError.textContent = "Das Vereinspasswort ist falsch!";
    return;
  }

  regError.textContent = "Konto wird erstellt...";
  try {
    const data = await firebaseAuthRequest("signUp", email, password);
    document.getElementById("club-password").value = "";
    document.getElementById("reg-email").value = "";
    document.getElementById("reg-password").value = "";
    updateUI(data.email);
  } catch (err) {
    regError.textContent = translateError(err.message);
  }
});

// Ausloggen
document.getElementById("logout-btn").addEventListener("click", () => {
  updateUI(null);
});

// Beim Laden prüfen, ob schon eingeloggt
updateUI(localStorage.getItem("tsv_user_email"));

