import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { doc, getDoc, getDocFromCache } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { auth, db, isFirestoreOfflineError, toFriendlyFirestoreError } from "./firebase-config.js";

const form = document.getElementById("login-form");
const statusBox = document.getElementById("login-status");
const submitButton = form?.querySelector("button[type='submit']");
let isSubmitting = false;

function setStatus(message, kind) {
  statusBox.textContent = message;
  statusBox.className = "mt-4 rounded-lg px-4 py-3 text-sm font-medium";
  if (kind === "error") {
    statusBox.classList.add("bg-red-950/60", "border", "border-red-500/40", "text-red-200");
  } else if (kind === "loading") {
    statusBox.classList.add("bg-blue-950/60", "border", "border-blue-500/40", "text-blue-200");
  } else {
    statusBox.classList.add("bg-emerald-950/60", "border", "border-emerald-500/40", "text-emerald-200");
  }
}

function setButtonState(enabled) {
  if (submitButton) {
    submitButton.disabled = !enabled;
    submitButton.style.opacity = enabled ? "1" : "0.6";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSubmitting) return;
  isSubmitting = true;
  setButtonState(false);
  statusBox.innerHTML = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    setStatus("Enter both email and password.", "error");
    isSubmitting = false;
    setButtonState(true);
    return;
  }

  try {
    setStatus("Authenticating...", "loading");
    const credential = await signInWithEmailAndPassword(auth, email, password);
    setStatus("Loading profile...", "loading");
    
    const userRef = doc(db, "users", credential.user.uid);
    let userDoc;

    try {
      userDoc = await getDoc(userRef);
    } catch (error) {
      if (!isFirestoreOfflineError(error)) {
        throw error;
      }
      setStatus("Offline: using cached profile...", "loading");
      try {
        userDoc = await getDocFromCache(userRef);
      } catch (cacheError) {
        throw new Error("Profile unavailable offline. Please reconnect to internet.");
      }
    }

    if (!userDoc.exists()) {
      throw new Error("User profile not found in Firestore.");
    }

    const profile = userDoc.data();

    if (profile.role === "victim") {
      window.location.href = "notes.html";
      return;
    }

    if (profile.role === "lawyer") {
      window.location.href = "lawyer_dashboard.html";
      return;
    }

    throw new Error("Role is invalid. Contact administrator.");
  } catch (error) {
    const friendlyError = toFriendlyFirestoreError(error, "Login failed.");
    setStatus(friendlyError, "error");
    
    // Suggest retry if offline
    if (!navigator.onLine) {
      const retryHint = document.createElement("div");
      retryHint.className = "mt-2 text-xs text-blue-300";
      retryHint.textContent = "WiFi off? Turn on to retry.";
      statusBox.appendChild(retryHint);
    }
  } finally {
    isSubmitting = false;
    setButtonState(true);
  }
});
