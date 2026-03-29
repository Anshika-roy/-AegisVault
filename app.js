/*
  Forensic backend (Firebase compat v9 + Web Crypto + jsPDF)
  -----------------------------------------------------------
  Required UI IDs:
    - #file-input
    - #upload-button
    - #status-message
  Optional UI ID:
    - #certificate-button (created automatically if missing)
*/

(function () {
  "use strict";

  const SELECTORS = {
    fileInput: "#file-input",
    uploadButton: "#upload-button",
    statusMessage: "#status-message",
    certificateButton: "#certificate-button"
  };

  // Keep placeholders if you want demo fallback until config is complete.
  const firebaseConfig = {
    apiKey: "AIzaSyDdZyMEn01tiYxf1Tl4VMB7qJBVu_is0Lw",
    authDomain: "aegisvault-5377f.firebaseapp.com",
    projectId: "aegisvault-5377f",
    storageBucket: "aegisvault-5377f.firebasestorage.app",
    messagingSenderId: "998097234377",
    appId: "1:998097234377:web:c6fa924303f5f19a5ee018",
    measurementId: "G-JV0D6MGHXH"
  };

  const state = {
    sessionId: `SID-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    firebaseReady: false,
    incidents: []
  };

  let firebaseApp = null;
  let firebaseAuth = null;
  let firestoreDb = null;
  let firebaseStorage = null;

  const ui = {
    fileInput: null,
    uploadButton: null,
    statusMessage: null,
    certificateButton: null
  };

  function setStatus(message) {
    if (ui.statusMessage) {
      ui.statusMessage.textContent = message;
    }
    console.log("[Forensic]", message);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src=\"${src}\"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
        if (existing.dataset.loaded === "true") {
          resolve();
        }
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function loadDependencies() {
    await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  }

  function hasValidFirebaseConfig(config) {
    const required = ["apiKey", "authDomain", "projectId", "storageBucket", "appId"];
    return required.every((key) => {
      const value = config[key];
      return typeof value === "string" && value.trim() !== "" && !value.includes("YOUR_");
    });
  }

  function initFirebaseCompat() {
    if (!window.firebase || !hasValidFirebaseConfig(firebaseConfig)) {
      state.firebaseReady = false;
      return;
    }

    try {
      firebaseApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
      firebaseAuth = firebase.auth();
      firestoreDb = firebase.firestore();
      firebaseStorage = firebase.storage();
      state.firebaseReady = true;

      firebaseAuth.signInAnonymously().catch((err) => {
        console.warn("Anonymous auth failed:", err.message);
      });
    } catch (err) {
      state.firebaseReady = false;
      console.warn("Firebase init failed, switching to demo mode:", err.message);
    }
  }

  function getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported in this browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          reject(new Error(error.message || "Unable to capture GPS coordinates."));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  async function sha256FromFile(file) {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function ensureCertificateButton() {
    let button = document.querySelector(SELECTORS.certificateButton);
    if (!button && ui.statusMessage && ui.statusMessage.parentElement) {
      button = document.createElement("button");
      button.id = "certificate-button";
      button.type = "button";
      button.className = "w-full mt-2 py-2 rounded text-xs font-mono tracking-wider";
      button.style.background = "#E2E8F0";
      button.style.border = "1px solid #CBD5E1";
      button.style.color = "#64748B";
      button.style.cursor = "not-allowed";
      button.textContent = "GENERATE CERTIFICATE";
      ui.statusMessage.parentElement.appendChild(button);
    }

    if (button) {
      button.disabled = true;
      button.addEventListener("click", generateEvidenceCertificate);
      ui.certificateButton = button;
    }
  }

  function updateCertificateButtonState() {
    if (!ui.certificateButton) {
      return;
    }

    const enabled = state.incidents.length > 0;
    ui.certificateButton.disabled = !enabled;
    ui.certificateButton.style.background = enabled ? "#334155" : "#E2E8F0";
    ui.certificateButton.style.border = enabled ? "1px solid #334155" : "1px solid #CBD5E1";
    ui.certificateButton.style.color = enabled ? "#FFFFFF" : "#64748B";
    ui.certificateButton.style.cursor = enabled ? "pointer" : "not-allowed";
  }

  async function processEvidence() {
    const file = ui.fileInput && ui.fileInput.files ? ui.fileInput.files[0] : null;
    if (!file) {
      setStatus("Select a file first.");
      return;
    }

    try {
      setStatus("Capturing GPS...");
      const { latitude, longitude } = await getCurrentLocation();

      setStatus("Hashing...");
      const fileHash = await sha256FromFile(file);

      const timestamp = new Date().toISOString();
      const safeName = file.name.replace(/\s+/g, "-");
      const storagePath = `evidence/${Date.now()}_${safeName}`;

      let fileURL;
      if (state.firebaseReady) {
        setStatus("Uploading...");
        const storageRef = firebaseStorage.ref(storagePath);
        await storageRef.put(file);
        fileURL = await storageRef.getDownloadURL();

        setStatus("Securing record...");
        await firestoreDb.collection("incidents").add({
          fileName: file.name,
          fileURL,
          fileHash,
          latitude,
          longitude,
          timestamp,
          sessionId: state.sessionId,
          serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        setStatus("Uploading (demo mode)...");
        await new Promise((resolve) => setTimeout(resolve, 700));
        fileURL = `demo://evidence/${encodeURIComponent(safeName)}`;
      }

      state.incidents.push({
        fileName: file.name,
        fileURL,
        fileHash,
        latitude,
        longitude,
        timestamp,
        sessionId: state.sessionId
      });

      updateCertificateButtonState();
      setStatus(state.firebaseReady ? "Secured!" : "Secured! (demo mode)");
    } catch (error) {
      console.error(error);
      setStatus(`Error: ${error.message}`);
    }
  }

  function generateEvidenceCertificate() {
    if (!state.incidents.length) {
      setStatus("No incidents available for certificate.");
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      setStatus("Certificate engine not loaded.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    let y = 60;
    const margin = 50;
    const width = 495;

    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text("DIGITAL EVIDENCE CERTIFICATE", margin, y);
    y += 24;

    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.text(`Session ID: ${state.sessionId}`, margin, y);
    y += 14;
    doc.text(`Generated At: ${new Date().toISOString()}`, margin, y);
    y += 20;

    state.incidents.forEach((incident, index) => {
      if (y > 700) {
        doc.addPage();
        y = 60;
      }

      doc.setDrawColor(180, 180, 180);
      doc.rect(margin, y, width, 130);
      y += 16;

      doc.setFont("times", "bold");
      doc.setFontSize(12);
      doc.text(`Incident ${index + 1}`, margin + 10, y);
      y += 16;

      doc.setFont("courier", "normal");
      doc.setFontSize(9);
      doc.text(`Filename: ${incident.fileName}`, margin + 10, y);
      y += 12;
      doc.text(`Timestamp: ${incident.timestamp}`, margin + 10, y);
      y += 12;
      doc.text(`Latitude: ${incident.latitude}`, margin + 10, y);
      y += 12;
      doc.text(`Longitude: ${incident.longitude}`, margin + 10, y);
      y += 12;

      const urlLines = doc.splitTextToSize(`File URL: ${incident.fileURL}`, width - 20);
      doc.text(urlLines, margin + 10, y);
      y += urlLines.length * 10;

      const hashLines = doc.splitTextToSize(`SHA-256: ${incident.fileHash}`, width - 20);
      doc.text(hashLines, margin + 10, y);
      y += hashLines.length * 10;

      doc.setFont("times", "italic");
      doc.text("Tamper-Evidence Note: Any modification to the original file will generate a different SHA-256 hash.", margin + 10, y);
      y += 20;
    });

    doc.save(`evidence_certificate_${Date.now()}.pdf`);
    setStatus("Certificate generated.");
  }

  function bindUI() {
    ui.fileInput = document.querySelector(SELECTORS.fileInput);
    ui.uploadButton = document.querySelector(SELECTORS.uploadButton);
    ui.statusMessage = document.querySelector(SELECTORS.statusMessage);

    if (!ui.fileInput || !ui.uploadButton || !ui.statusMessage) {
      console.warn("Required UI controls not found. Verify IDs in index.html.");
      return;
    }

    ensureCertificateButton();
    updateCertificateButtonState();

    ui.uploadButton.addEventListener("click", async (event) => {
      event.preventDefault();
      await processEvidence();
    });
  }

  async function init() {
    try {
      await loadDependencies();
      initFirebaseCompat();
      bindUI();
      setStatus(state.firebaseReady ? "Ready" : "Ready (demo mode: Firebase not configured)");
    } catch (error) {
      console.error(error);
      setStatus(`Init error: ${error.message}`);
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  window.processEvidence = processEvidence;
})();
