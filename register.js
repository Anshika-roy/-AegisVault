import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const form = document.getElementById("register-form");
const roleButtons = document.querySelectorAll("[data-role]");
const roleInput = document.getElementById("role");
const statusBox = document.getElementById("register-status");

function setStatus(message, kind) {
  statusBox.textContent = message;
  statusBox.className = "mt-4 rounded-lg px-4 py-3 text-sm font-medium";
  if (kind === "error") {
    statusBox.classList.add("bg-red-950/60", "border", "border-red-500/40", "text-red-200");
  } else {
    statusBox.classList.add("bg-emerald-950/60", "border", "border-emerald-500/40", "text-emerald-200");
  }
}

roleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    roleButtons.forEach((el) => {
      el.classList.remove("bg-sky-500", "text-white", "border-sky-300");
      el.classList.add("bg-slate-800/80", "text-slate-200", "border-slate-600");
    });

    button.classList.remove("bg-slate-800/80", "text-slate-200", "border-slate-600");
    button.classList.add("bg-sky-500", "text-white", "border-sky-300");
    roleInput.value = button.dataset.role;
  });
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

  try {
    setStatus("Creating secure account...", "ok");
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
      window.location.href = "login.html";
    }, 900);
  } catch (error) {
    setStatus(error.message || "Registration failed.", "error");
  }
});
