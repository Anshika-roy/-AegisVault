import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { auth, db, toFriendlyFirestoreError } from "./firebase-config.js";

const form = document.getElementById("register-form");
const roleButtons = document.querySelectorAll(".role-btn");
const roleInput = document.getElementById("role");
const statusBox = document.getElementById("register-status");
const submitButton = document.getElementById("register-submit");

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

function applyRole(role) {
  roleInput.value = role;
  roleButtons.forEach((button) => {
    const active = button.dataset.role === role;
    button.classList.toggle("bg-sky-500", active);
    button.classList.toggle("text-white", active);
    button.classList.toggle("border-sky-300", active);
    button.classList.toggle("bg-slate-800/80", !active);
    button.classList.toggle("text-slate-200", !active);
    button.classList.toggle("border-slate-600", !active);
  });
}

roleButtons.forEach((button) => {
  button.addEventListener("click", () => applyRole(button.dataset.role));
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const role = roleInput.value;

  if (!name || !email || !password || !role) {
    setStatus("All fields are required.", "error");
    return;
  }

  if (password.length < 6) {
    setStatus("Password must be at least 6 characters.", "error");
    return;
  }

  try {
    setSubmitting(true);
    setStatus("Creating secure account...", "loading");

    const credential = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", credential.user.uid), {
      uid: credential.user.uid,
      name,
      email,
      role,
      isShared: false,
      createdAt: serverTimestamp()
    });

    setStatus("Registration successful. Redirecting to login...", "ok");
    setTimeout(() => {
      window.location.href = "./login.html";
    }, 900);
  } catch (error) {
    setStatus(toFriendlyFirestoreError(error, "Registration failed."), "error");
  } finally {
    setSubmitting(false);
  }
});

applyRole("client");
