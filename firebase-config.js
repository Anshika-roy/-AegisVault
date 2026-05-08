import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

const runtimeFirebaseConfig = globalThis.__FIREBASE_CONFIG__ || {};

const firebaseConfig = {
  apiKey: runtimeFirebaseConfig.apiKey || "",
  authDomain: runtimeFirebaseConfig.authDomain || "",
  projectId: runtimeFirebaseConfig.projectId || "",
  storageBucket: runtimeFirebaseConfig.storageBucket || "",
  messagingSenderId: runtimeFirebaseConfig.messagingSenderId || "",
  appId: runtimeFirebaseConfig.appId || "",
  measurementId: runtimeFirebaseConfig.measurementId || ""
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

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
