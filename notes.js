import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { doc, getDoc, getDocFromCache, updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { auth, db, isFirestoreOfflineError, toFriendlyFirestoreError } from "./firebase-config.js";

const shareToggle = document.getElementById("share-toggle");
const signOutButton = document.getElementById("signout-button");
const statusBox = document.getElementById("notes-status");
const secretNoteButton = document.getElementById("secret-note");
let currentUser = null;
let secretClickCount = 0;
let secretClickTimerId = null;

function handleSecretTriggerClick() {
  secretClickCount += 1;

  if (secretClickTimerId) {
    clearTimeout(secretClickTimerId);
  }

  secretClickTimerId = setTimeout(() => {
    secretClickCount = 0;
    secretClickTimerId = null;
  }, 900);

  if (secretClickCount >= 3) {
    window.location.href = "register.html";
  }
}

function setStatus(message, kind) {
  statusBox.textContent = message;
  statusBox.className = "mt-4 rounded-lg px-4 py-3 text-sm";
  if (kind === "error") {
    statusBox.classList.add("border", "border-red-500/40", "bg-red-950/60", "text-red-200");
  } else {
    statusBox.classList.add("border", "border-slate-700", "bg-slate-950", "text-slate-300");
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;

  try {
    const userRef = doc(db, "users", user.uid);
    let userSnap;

    try {
      userSnap = await getDoc(userRef);
    } catch (error) {
      if (!isFirestoreOfflineError(error)) {
        throw error;
      }
      userSnap = await getDocFromCache(userRef);
    }

    if (!userSnap.exists()) {
      throw new Error("User profile not found.");
    }

    const profile = userSnap.data();
    if (profile.role !== "victim") {
      window.location.href = "lawyer_dashboard.html";
      return;
    }

    shareToggle.checked = Boolean(profile.isShared);
    setStatus(`Welcome ${profile.name || "Victim"}. Legal share is ${profile.isShared ? "ON" : "OFF"}.`, "ok");
  } catch (error) {
    setStatus(toFriendlyFirestoreError(error, "Could not load victim profile."), "error");
  }
});

shareToggle.addEventListener("change", async () => {
  if (!currentUser) {
    return;
  }

  try {
    await updateDoc(doc(db, "users", currentUser.uid), {
      isShared: shareToggle.checked
    });
    setStatus(`Grant Legal Access ${shareToggle.checked ? "enabled" : "disabled"}.`, "ok");
  } catch (error) {
    shareToggle.checked = !shareToggle.checked;
    setStatus(toFriendlyFirestoreError(error, "Unable to update legal access."), "error");
  }
});

signOutButton.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

if (secretNoteButton) {
  secretNoteButton.addEventListener("click", handleSecretTriggerClick);
}
