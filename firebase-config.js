import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDdZyMEn01tiYxf1Tl4VMB7qJBVu_is0Lw",
  authDomain: "aegisvault-5377f.firebaseapp.com",
  projectId: "aegisvault-5377f",
  storageBucket: "aegisvault-5377f.firebasestorage.app",
  messagingSenderId: "998097234377",
  appId: "1:998097234377:web:c6fa924303f5f19a5ee018",
  measurementId: "G-JV0D6MGHXH"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence for seamless offline access
enableIndexedDbPersistence(db).catch((error) => {
  if (error.code === "failed-precondition") {
    console.warn("Multiple tabs open; persistence disabled.");
  } else if (error.code === "unimplemented") {
    console.warn("Browser does not support persistence.");
  }
});

export function isFirestoreOfflineError(error) {
  if (!error) {
    return !navigator.onLine;
  }

  const code = String(error.code || "").toLowerCase();
  const message = String(error.message || "").toLowerCase();

  return (
    !navigator.onLine ||
    code === "unavailable" ||
    message.includes("client is offline")
  );
}

export function toFriendlyFirestoreError(error, fallbackMessage) {
  if (isFirestoreOfflineError(error)) {
    return "You are offline. Reconnect to sync with Firestore.";
  }

  return error?.message || fallbackMessage;
}
