// Firebase SDKs über CDN importieren (funktioniert direkt auf GitHub Pages)
import { initializeApp } from "https://gstatic.com";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://gstatic.com";

// Deine Firebase-Konfiguration für kalendertsv
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

// Firebase initialisieren
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// HTML-Elemente referenzieren
const authSection = document.getElementById("auth-section");
const userSection = document.getElementById("user-section");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const userEmailSpan = document.getElementById("user-email");
const errorMsg = document.getElementById("error-msg");

// Deutsche Fehlermeldungen
function showError(code) {
  const messages = {
    "auth/invalid-email": "Bitte gib eine gültige E-Mail-Adresse ein.",
    "auth/user-not-found": "Kein Konto mit dieser E-Mail gefunden.",
    "auth/wrong-password": "Das Passwort ist falsch.",
    "auth/invalid-credential": "E-Mail oder Passwort ist falsch.",
    "auth/email-already-in-use": "Diese E-Mail wird bereits verwendet.",
    "auth/weak-password": "Das Passwort muss mindestens 6 Zeichen lang sein."
  };
  errorMsg.textContent = messages[code] || "Fehler: " + code;
}

// Registrierung
document.getElementById("register-btn").addEventListener("click", async () => {
  errorMsg.textContent = "";
  try {
    await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
  } catch (error) {
    showError(error.code);
  }
});

// Login
document.getElementById("login-btn").addEventListener("click", async () => {
  errorMsg.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
  } catch (error) {
    showError(error.code);
  }
});

// Logout
document.getElementById("logout-btn").addEventListener("click", async () => {
  await signOut(auth);
});

// Login-Status überwachen
onAuthStateChanged(auth, (user) => {
  if (user) {
    authSection.classList.add("hidden");
    userSection.classList.remove("hidden");
    userEmailSpan.textContent = user.email;
    emailInput.value = "";
    passwordInput.value = "";
  } else {
    authSection.classList.remove("hidden");
    userSection.classList.add("hidden");
    userEmailSpan.textContent = "";
  }
});

