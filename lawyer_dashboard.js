import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  collection,
  getDoc,
  getDocFromCache,
  doc,
  onSnapshot,
  orderBy,
  query,
  where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { auth, db, isFirestoreOfflineError, toFriendlyFirestoreError } from "./firebase-config.js";

const tableBody = document.getElementById("live-feed-body");
const statusBox = document.getElementById("lawyer-status");
const signOutButton = document.getElementById("signout-button");

let sharedVictimIds = new Set();
let latestVaultLogs = [];

function setStatus(message, kind) {
  statusBox.textContent = message;
  statusBox.className = "mt-4 rounded-lg px-4 py-3 text-sm";
  if (kind === "error") {
    statusBox.classList.add("border", "border-red-500/40", "bg-red-950/60", "text-red-200");
  } else {
    statusBox.classList.add("border", "border-slate-700", "bg-slate-950", "text-slate-300");
  }
}

function formatTimestamp(value) {
  if (!value) {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value.seconds) {
    return new Date(value.seconds * 1000).toISOString();
  }
  return "-";
}

function renderPreviewCell(log) {
  const type = (log.fileType || "").toLowerCase();

  if (type.startsWith("image/") && log.downloadURL) {
    return `<img src="${log.downloadURL}" alt="Evidence image" class="h-14 w-20 rounded object-cover border border-slate-700" />`;
  }

  if (type.startsWith("audio/") && log.downloadURL) {
    return `<audio controls class="w-48"><source src="${log.downloadURL}" type="${log.fileType}" /></audio>`;
  }

  if (log.downloadURL) {
    return `<a href="${log.downloadURL}" target="_blank" rel="noopener noreferrer" class="text-sky-400 underline">Open File</a>`;
  }

  return `<span class="text-slate-500">No preview</span>`;
}

function renderFeed() {
  tableBody.innerHTML = "";

  const visibleLogs = latestVaultLogs.filter((log) => sharedVictimIds.has(log.victimUid || log.uploaderUid));

  if (!visibleLogs.length) {
    tableBody.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-slate-400">No shared evidence available right now.</td></tr>`;
    return;
  }

  for (const log of visibleLogs) {
    const mapLink = (log.latitude != null && log.longitude != null)
      ? `https://maps.google.com/?q=${encodeURIComponent(`${log.latitude},${log.longitude}`)}`
      : null;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="px-4 py-3">${renderPreviewCell(log)}</td>
      <td class="px-4 py-3 break-all font-mono text-xs">${log.fileHash || "-"}</td>
      <td class="px-4 py-3">${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener noreferrer" class="text-sky-400 underline">Open GPS</a>` : "-"}</td>
      <td class="px-4 py-3 text-xs font-mono">${formatTimestamp(log.serverTimestamp || log.timestamp)}</td>
    `;
    tableBody.appendChild(row);
  }
}

function subscribeSharedVictims() {
  const sharedQuery = query(
    collection(db, "users"),
    where("role", "==", "victim"),
    where("isShared", "==", true)
  );

  return onSnapshot(sharedQuery, (snapshot) => {
    sharedVictimIds = new Set(snapshot.docs.map((docSnap) => docSnap.id));
    renderFeed();
  });
}

function subscribeVaultLogs() {
  const logsQuery = query(collection(db, "vault_logs"), orderBy("serverTimestamp", "desc"));

  return onSnapshot(logsQuery, (snapshot) => {
    latestVaultLogs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    renderFeed();
    setStatus("Live feed updated.", "ok");
  }, (error) => {
    setStatus(error.message || "Failed to listen to vault logs.", "error");
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const profileRef = doc(db, "users", user.uid);
    let profileSnap;

    try {
      profileSnap = await getDoc(profileRef);
    } catch (error) {
      if (!isFirestoreOfflineError(error)) {
        throw error;
      }
      profileSnap = await getDocFromCache(profileRef);
    }

    if (!profileSnap.exists() || profileSnap.data().role !== "lawyer") {
      window.location.href = "notes.html";
      return;
    }

    setStatus("Connected. Listening for shared evidence...", "ok");
    subscribeSharedVictims();
    subscribeVaultLogs();
  } catch (error) {
    setStatus(toFriendlyFirestoreError(error, "Unable to load lawyer profile."), "error");
  }
});

signOutButton.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});
