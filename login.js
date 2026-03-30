import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { doc, getDoc, getDocFromCache, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { auth, db, isFirestoreOfflineError, toFriendlyFirestoreError } from "./firebase-config.js";

const form = document.getElementById("login-form");
const statusBox = document.getElementById("login-status");
const submitButton = document.getElementById("login-submit");

function setStatus(message, kind = "ok") {
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

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
}

function routeForRole(role) {
  if (role === "client" || role === "victim") {
    window.location.href = "./index.html";
    return;
  }

  if (role === "lawyer") {
    window.location.href = "./index.html";
    return;
  }

  throw new Error(`Unknown role: ${role}`);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    setStatus("Enter both email and password.", "error");
    return;
  }

  try {
    setSubmitting(true);
    setStatus("Authenticating...", "loading");

    const credential = await signInWithEmailAndPassword(auth, email, password);
    const userRef = doc(db, "users", credential.user.uid);
    let userDoc;

    try {
      userDoc = await getDoc(userRef);
    } catch (error) {
      if (!isFirestoreOfflineError(error)) {
        throw error;
      }
      userDoc = await getDocFromCache(userRef);
    }

    let profile;

    if (!userDoc.exists()) {
      profile = {
        uid: credential.user.uid,
        email: credential.user.email,
        name: credential.user.displayName || "",
        role: "client",
        isShared: false,
        createdAt: serverTimestamp()
      };
      await setDoc(userRef, profile, { merge: true });
    } else {
      profile = userDoc.data();
    }

    setStatus("Login successful. Redirecting...", "ok");
    routeForRole(profile.role);
  } catch (error) {
    setStatus(toFriendlyFirestoreError(error, "Login failed."), "error");
  } finally {
    setSubmitting(false);
  }
});
