const firebaseConfig = {
  apiKey: "AIzaSyDATRJtGAkTVg-dB1AkI5jlEwNgBBIK-z8",
  authDomain: "kalendertsv.firebaseapp.com",
  databaseURL: "https://kalendertsv-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "kalendertsv",
  storageBucket: "kalendertsv.firebasestorage.app",
  messagingSenderId: "693122891208",
  appId: "1:693122891208:web:01cdd76b4ec0d3995894fd",
  measurementId: "G-S138SYNHFL"
};

const errorMsg = document.getElementById("error-msg");
const authSection = document.getElementById("auth-section");
const userSection = document.getElementById("user-section");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const userEmailSpan = document.getElementById("user-email");

function showError(msg) {
  const messages = {
    "INVALID_EMAIL": "Bitte gib eine gültige E-Mail-Adresse ein.",
    "EMAIL_NOT_FOUND": "Kein Konto mit dieser E-Mail gefunden.",
    "INVALID_PASSWORD": "Das Passwort ist falsch.",
    "INVALID_LOGIN_CREDENTIALS": "E-Mail oder Passwort ist falsch.",
    "EMAIL_EXISTS": "Diese E-Mail wird bereits verwendet.",
    "WEAK_PASSWORD : Password should be at least 6 characters": "Das Passwort muss mindestens 6 Zeichen lang sein.",
    "OPERATION_NOT_ALLOWED": "E-Mail/Passwort-Login ist in Firebase noch nicht aktiviert."
  };
  errorMsg.textContent = messages[msg] || "Fehler: " + msg;
}

function updateUI(email) {
  if (email) {
    localStorage.setItem("tsv_user_email", email);
    authSection.classList.add("hidden");
    userSection.classList.remove("hidden");
    userEmailSpan.textContent = email;
    emailInput.value = "";
    passwordInput.value = "";
    errorMsg.textContent = "";
  } else {
    localStorage.removeItem("tsv_user_email");
    authSection.classList.remove("hidden");
    userSection.classList.add("hidden");
    userEmailSpan.textContent = "";
  }
}

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

document.getElementById("register-btn").addEventListener("click", async () => {
  errorMsg.textContent = "Registriere...";
  try {
    const data = await firebaseAuthRequest("signUp", emailInput.value.trim(), passwordInput.value);
    updateUI(data.email);
  } catch (err) {
    showError(err.message);
  }
});

document.getElementById("login-btn").addEventListener("click", async () => {
  errorMsg.textContent = "Logge ein...";
  try {
    const data = await firebaseAuthRequest("signInWithPassword", emailInput.value.trim(), passwordInput.value);
    updateUI(data.email);
  } catch (err) {
    showError(err.message);
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  updateUI(null);
});

updateUI(localStorage.getItem("tsv_user_email"));
