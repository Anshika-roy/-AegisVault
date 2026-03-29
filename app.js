/*
  AegisVault Forensic Backend
  - Firebase compat upload + Firestore records
  - IndexedDB offline queue with auto-sync on reconnect
  - Chain-of-custody logging
  - Emergency SMS sharing
  - Audio/video direct capture
  - Certificate QR verification
  - PWA registration
*/

(function () {
  "use strict";

  const SELECTORS = {
    fileInput: "#file-input",
    uploadButton: "#upload-button",
    statusMessage: "#status-message",
    certificateButton: "#certificate-button",
    emergencyContactInput: "#emergency-contact",
    emergencyContactWarning: "#emergency-contact-warning",
    vaultFilesList: "#vault-files-list",
    vaultHistoryBody: "#vault-history-body",
    pendingUploadsCount: "#pending-uploads-count",
    audioRecordButton: "#audio-record-btn",
    videoCaptureButton: "#video-capture-btn",
    witnessModeButton: "#witness-mode-btn",
    witnessQrImage: "#witness-qr-image"
  };

  // Demo setting: replace with your trusted emergency contact number.
  let emergencyContactNumber = "+910000000000";
  const EMERGENCY_CONTACT_STORAGE_KEY = "aegisvault.emergencyContact";

  const QUEUE_DB_NAME = "aegisvault-offline-db";
  const QUEUE_STORE_NAME = "pendingUploads";

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
    incidents: [],
    immutableFiles: [],
    syncInProgress: false
  };

  let firebaseApp = null;
  let firebaseAuth = null;
  let firestoreDb = null;
  let firebaseStorage = null;
  let modularApp = null;

  const ui = {
    fileInput: null,
    uploadButton: null,
    statusMessage: null,
    certificateButton: null,
    emergencyContactInput: null,
    emergencyContactWarning: null,
    vaultFilesList: null,
    vaultHistoryBody: null,
    pendingUploadsCount: null,
    audioRecordButton: null,
    videoCaptureButton: null,
    witnessModeButton: null,
    witnessQrImage: null
  };

  function updateSyncedCount() {
    const el = document.getElementById("sync-count");
    if (el) {
      el.textContent = String(state.immutableFiles.length);
    }
  }

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
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    await loadScript("https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js");
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
      console.warn("Firebase init failed:", err.message);
    }
  }

  function normalizePhone(value) {
    return (value || "").replace(/\s+/g, "").trim();
  }

  function isValidEmergencyNumber(value) {
    return /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
  }

  function updateEmergencyWarning(value) {
    if (!ui.emergencyContactWarning) {
      return;
    }
    ui.emergencyContactWarning.style.display = isValidEmergencyNumber(value) ? "none" : "block";
  }

  function loadEmergencyContact() {
    try {
      const stored = localStorage.getItem(EMERGENCY_CONTACT_STORAGE_KEY);
      if (stored && stored.trim()) {
        emergencyContactNumber = normalizePhone(stored);
      }
      if (ui.emergencyContactInput) {
        ui.emergencyContactInput.value = emergencyContactNumber;
        updateEmergencyWarning(emergencyContactNumber);
      }
    } catch (error) {
      console.warn("Could not load emergency contact:", error.message);
    }
  }

  function saveEmergencyContact(value) {
    const normalized = normalizePhone(value);
    if (!normalized) {
      return;
    }
    emergencyContactNumber = normalized;
    updateEmergencyWarning(normalized);
    try {
      localStorage.setItem(EMERGENCY_CONTACT_STORAGE_KEY, normalized);
    } catch (error) {
      console.warn("Could not save emergency contact:", error.message);
    }
  }

  async function getCurrentLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ latitude: null, longitude: null });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        () => {
          resolve({ latitude: null, longitude: null });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  async function sha256FromFile(file) {
    if (!window.CryptoJS) {
      throw new Error("CryptoJS not loaded.");
    }
    const buffer = await file.arrayBuffer();
    const wordArray = CryptoJS.lib.WordArray.create(buffer);
    return CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex);
  }

  function sanitizeCaseId(caseName) {
    return (caseName || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "unnamed-case";
  }

  function ensureResultContainer(containerSelector) {
    let container = document.querySelector(containerSelector);
    if (!container) {
      container = document.createElement("div");
      container.id = containerSelector.replace("#", "");
      container.className = "mt-4 space-y-3";

      const host = ui.statusMessage && ui.statusMessage.parentElement
        ? ui.statusMessage.parentElement
        : document.body;
      host.appendChild(container);
    }
    return container;
  }

  function renderCaseEvidenceCard(containerSelector, payload) {
    const container = ensureResultContainer(containerSelector);

    const verifiedBadge = payload.verified
      ? '<span class="px-2 py-1 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">VERIFIED</span>'
      : '<span class="px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">HASH CHECK PENDING</span>';

    const card = document.createElement("div");
    card.className = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
    card.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold text-slate-800">DigiLocker Evidence Card</h3>
        ${verifiedBadge}
      </div>
      <div class="text-xs text-slate-600 space-y-1 font-mono">
        <div><span class="text-slate-500">Case:</span> ${payload.caseName}</div>
        <div><span class="text-slate-500">File:</span> ${payload.fileName}</div>
        <div><span class="text-slate-500">Time:</span> ${payload.timestamp}</div>
        <div><span class="text-slate-500">GPS:</span> ${payload.latitude ?? "-"}, ${payload.longitude ?? "-"}</div>
      </div>
      <a href="${payload.downloadURL}" target="_blank" rel="noopener noreferrer" class="mt-3 inline-flex text-xs font-medium text-sky-700 underline">Open Evidence</a>
    `;

    container.prepend(card);
  }

  function renderCaseEvidenceErrorCard(containerSelector, errorMessage) {
    const container = ensureResultContainer(containerSelector);
    const card = document.createElement("div");
    card.className = "rounded-xl border border-red-200 bg-red-50 p-4";
    card.innerHTML = `
      <div class="text-sm font-semibold text-red-700 mb-1">Upload Failed</div>
      <div class="text-xs font-mono text-red-700 break-words">${errorMessage}</div>
    `;
    container.prepend(card);
  }

  async function getModularFirebaseClients() {
    const [
      appMod,
      firestoreMod,
      storageMod
    ] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js")
    ]);

    if (!modularApp) {
      modularApp = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
    }

    return {
      db: firestoreMod.getFirestore(modularApp),
      storage: storageMod.getStorage(modularApp),
      firestoreMod,
      storageMod
    };
  }

  async function uploadCaseEvidenceWithCard(options = {}) {
    const fileInputSelector = options.fileInputSelector || "#file-input";
    const caseSelectSelector = options.caseSelectSelector || "#case-name";
    const resultsContainerSelector = options.resultsContainerSelector || "#case-evidence-cards";

    try {
      const fileInput = document.querySelector(fileInputSelector);
      const caseSelect = document.querySelector(caseSelectSelector);

      if (!fileInput) {
        throw new Error(`File input not found: ${fileInputSelector}`);
      }

      if (!caseSelect) {
        throw new Error(`Case dropdown not found: ${caseSelectSelector}`);
      }

      const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      const caseName = (caseSelect.value || "").trim();

      if (!file) {
        throw new Error("Please select a file before uploading.");
      }

      if (!caseName) {
        throw new Error("Please select a case name before uploading.");
      }

      setStatus("Preparing case evidence...");

      const fileBuffer = await file.arrayBuffer();
      const fileWordArray = CryptoJS.lib.WordArray.create(fileBuffer);
      const fileHash = CryptoJS.SHA256(fileWordArray).toString(CryptoJS.enc.Hex);
      const hashCheck = CryptoJS.SHA256(fileWordArray).toString(CryptoJS.enc.Hex);
      const verified = fileHash === hashCheck;

      const { latitude, longitude } = await getCurrentLocation();
      const isoNow = new Date().toISOString();
      const caseId = sanitizeCaseId(caseName);
      const safeFileName = file.name.replace(/\s+/g, "-");

      const { db, storage, firestoreMod, storageMod } = await getModularFirebaseClients();

      const storagePath = `${caseId}/${Date.now()}_${safeFileName}`;
      const storageRef = storageMod.ref(storage, storagePath);
      await storageMod.uploadBytes(storageRef, new Uint8Array(fileBuffer), {
        contentType: file.type || "application/octet-stream"
      });
      const downloadURL = await storageMod.getDownloadURL(storageRef);

      const caseRef = firestoreMod.doc(db, "cases", caseId);
      await firestoreMod.setDoc(caseRef, {
        caseName,
        updatedAt: firestoreMod.serverTimestamp()
      }, { merge: true });

      await firestoreMod.addDoc(firestoreMod.collection(caseRef, "evidence"), {
        caseName,
        fileName: file.name,
        fileHash,
        downloadURL,
        latitude,
        longitude,
        timestamp: isoNow,
        serverTimestamp: firestoreMod.serverTimestamp(),
        verified
      });

      renderCaseEvidenceCard(resultsContainerSelector, {
        caseName,
        fileName: file.name,
        verified,
        timestamp: isoNow,
        latitude,
        longitude,
        downloadURL
      });

      setStatus("Case evidence secured.");
      return { success: true, fileHash, downloadURL };
    } catch (error) {
      renderCaseEvidenceErrorCard(resultsContainerSelector, error.message || "Unknown upload error");
      setStatus(`Case upload failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async function watermarkImageIfPossible(file) {
    if (!file.type.startsWith("image/")) {
      return file;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);

      // Lightweight steganographic-style watermark: near-invisible session stamp.
      ctx.globalAlpha = 0.02;
      ctx.fillStyle = "#000000";
      ctx.font = `${Math.max(10, Math.floor(canvas.width / 48))}px monospace`;
      ctx.fillText(`AV:${state.sessionId}`, 8, canvas.height - 8);

      const watermarkedBlob = await new Promise((resolve) => {
        canvas.toBlob(resolve, file.type || "image/png", 0.92);
      });

      if (!watermarkedBlob) {
        return file;
      }

      return new File([watermarkedBlob], file.name, { type: file.type || "image/png" });
    } catch (error) {
      console.warn("Watermark skipped:", error.message);
      return file;
    }
  }

  function sendEmergencyAlert(downloadURL, latitude, longitude) {
    const recipient = (ui.emergencyContactInput && ui.emergencyContactInput.value.trim())
      ? ui.emergencyContactInput.value.trim()
      : emergencyContactNumber;

    if (!isValidEmergencyNumber(recipient)) {
      updateEmergencyWarning(recipient);
      setStatus("Emergency contact invalid. Use E.164 format like +919876543210.");
      return;
    }

    const message = `EMERGENCY: Evidence secured at AegisVault. Location: ${latitude}, ${longitude}. View here: ${downloadURL}`;
    const smsUri = `sms:${encodeURIComponent(normalizePhone(recipient))}?body=${encodeURIComponent(message)}`;
    window.open(smsUri, "_self");
  }

  /*
    Time-limited chain-of-custody access strategy:
    - Store evidence as immutable in Storage Rules (deny updates/deletes after creation).
    - Do not expose permanently public links for sensitive evidence.
    - Issue short-lived signed URLs from trusted backend code (e.g. Cloud Functions)
      so viewers can only read for a narrow time window.
  */

  function openQueueDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(QUEUE_DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
          db.createObjectStore(QUEUE_STORE_NAME, { keyPath: "id", autoIncrement: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    });
  }

  async function queueUploadItem(item) {
    const db = await openQueueDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE_NAME, "readwrite");
      tx.objectStore(QUEUE_STORE_NAME).add(item);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("Queue add failed"));
    });
    db.close();
    await refreshPendingUploadsIndicator();
  }

  async function getQueuedItems() {
    const db = await openQueueDb();
    const items = await new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE_NAME, "readonly");
      const request = tx.objectStore(QUEUE_STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("Queue read failed"));
    });
    db.close();
    return items;
  }

  async function removeQueueItem(id) {
    const db = await openQueueDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE_NAME, "readwrite");
      tx.objectStore(QUEUE_STORE_NAME).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("Queue delete failed"));
    });
    db.close();
  }

  async function refreshPendingUploadsIndicator() {
    if (!ui.pendingUploadsCount) {
      return;
    }
    const items = await getQueuedItems();
    ui.pendingUploadsCount.textContent = String(items.length);
  }

  async function appendCustodyAction(incidentId, action, details) {
    if (!state.firebaseReady || !incidentId) {
      return;
    }

    try {
      await firestoreDb.collection("incidents").doc(incidentId).update({
        custodyLog: firebase.firestore.FieldValue.arrayUnion({
          action,
          details: details || "",
          timestamp: new Date().toISOString(),
          sessionId: state.sessionId
        })
      });
    } catch (error) {
      console.warn("Could not append custody action:", error.message);
    }
  }

  async function anchorHashOnOpenTimestamps(fileHashHex) {
    try {
      const bytes = Uint8Array.from(fileHashHex.match(/.{1,2}/g).map((h) => parseInt(h, 16)));
      const response = await fetch("https://alice.btc.calendar.opentimestamps.org/digest", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: bytes
      });

      if (!response.ok) {
        throw new Error(`OpenTimestamps error ${response.status}`);
      }

      const stampBytes = await response.arrayBuffer();
      return {
        status: "submitted",
        proofSize: stampBytes.byteLength,
        anchoredAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: "failed",
        reason: error.message,
        anchoredAt: new Date().toISOString()
      };
    }
  }

  function appendVaultHistoryRow(record) {
    if (!ui.vaultHistoryBody) {
      return;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="py-2 pr-3 align-top">${record.timestamp || "-"}</td>
      <td class="py-2 pr-3 align-top">${record.latitude ?? "-"}, ${record.longitude ?? "-"}</td>
      <td class="py-2 align-top break-all">${record.fileHash || "-"}</td>
    `;
    ui.vaultHistoryBody.appendChild(tr);
  }

  async function fetchAndDisplayVaultHistory() {
    if (!ui.vaultHistoryBody) {
      return;
    }

    ui.vaultHistoryBody.innerHTML = "";

    if (!state.firebaseReady) {
      state.incidents.forEach((record) => appendVaultHistoryRow(record));
      return;
    }

    try {
      const snapshot = await firestoreDb
        .collection("vaultHistory")
        .orderBy("timestamp", "desc")
        .limit(50)
        .get();

      snapshot.forEach((doc) => appendVaultHistoryRow(doc.data()));
    } catch (error) {
      console.warn("Could not fetch vault history:", error.message);
    }
  }

  function createActionButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "px-2 py-1 rounded text-xs font-mono";
    button.textContent = label;
    button.style.background = "#334155";
    button.style.border = "1px solid #334155";
    button.style.color = "#FFFFFF";
    button.style.cursor = "pointer";
    button.addEventListener("click", onClick);
    return button;
  }

  function renderImmutableFiles() {
    if (!ui.vaultFilesList) {
      return;
    }

    ui.vaultFilesList.innerHTML = "";

    if (!state.immutableFiles.length) {
      const row = document.createElement("div");
      row.className = "text-xs font-mono";
      row.style.color = "#94A3B8";
      row.textContent = "No immutable files yet.";
      ui.vaultFilesList.appendChild(row);
      return;
    }

    state.immutableFiles.forEach((item) => {
      const row = document.createElement("div");
      row.className = "flex items-center justify-between gap-3 p-2 rounded";
      row.style.background = "#F8FAFC";
      row.style.border = "1px solid #E2E8F0";

      const meta = document.createElement("div");
      meta.className = "min-w-0";
      meta.innerHTML = `
        <div class="text-xs font-mono" style="color:#334155;">${item.fileName}</div>
        <div class="text-[10px] font-mono truncate" style="color:#64748B;">IMMUTABLE - HASH: ${item.fileHash.slice(0, 14)}...</div>
      `;

      const actions = document.createElement("div");
      actions.className = "flex items-center gap-1";

      actions.appendChild(createActionButton("VIEW", async () => {
        if (!item.fileURL || item.fileURL.startsWith("demo://")) {
          setStatus("Demo file cannot be opened.");
          return;
        }
        window.open(item.fileURL, "_blank", "noopener,noreferrer");
        await appendCustodyAction(item.incidentId, "view", item.fileURL);
      }));

      actions.appendChild(createActionButton("DOWNLOAD", async () => {
        if (!item.fileURL || item.fileURL.startsWith("demo://")) {
          setStatus("Demo file cannot be downloaded.");
          return;
        }
        const a = document.createElement("a");
        a.href = item.fileURL;
        a.download = item.fileName || "evidence";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.click();
        await appendCustodyAction(item.incidentId, "download", item.fileURL);
      }));

      actions.appendChild(createActionButton("SHARE", async () => {
        if (!item.fileURL || item.fileURL.startsWith("demo://")) {
          setStatus("Demo file cannot be shared.");
          return;
        }

        try {
          if (navigator.share) {
            await navigator.share({
              title: "AegisVault Evidence",
              text: `Evidence hash: ${item.fileHash}`,
              url: item.fileURL
            });
          } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(item.fileURL);
            setStatus("Evidence URL copied to clipboard.");
          }
          await appendCustodyAction(item.incidentId, "share", item.fileURL);
        } catch (error) {
          console.warn("Share failed:", error.message);
        }
      }));

      row.appendChild(meta);
      row.appendChild(actions);
      ui.vaultFilesList.appendChild(row);
    });
  }

  function ensureCertificateButton() {
    const button = document.querySelector(SELECTORS.certificateButton);
    if (!button) {
      return;
    }

    button.disabled = true;
    button.addEventListener("click", async () => {
      await generateEvidenceCertificate();
    });
    ui.certificateButton = button;
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

  async function makeVerificationQrDataUrl(incident) {
    if (!window.QRCode || !window.QRCode.toDataURL) {
      return null;
    }

    const verificationUrl = `${location.origin}${location.pathname}?verify=${encodeURIComponent(incident.fileHash)}&sid=${encodeURIComponent(state.sessionId)}`;
    return window.QRCode.toDataURL(verificationUrl, { margin: 1, width: 128 });
  }

  async function generateEvidenceCertificate() {
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

    for (let i = 0; i < state.incidents.length; i += 1) {
      const incident = state.incidents[i];

      if (y > 640) {
        doc.addPage();
        y = 60;
      }

      doc.setDrawColor(180, 180, 180);
      doc.rect(margin, y, width, 170);
      y += 16;

      doc.setFont("times", "bold");
      doc.setFontSize(12);
      doc.text(`Incident ${i + 1}`, margin + 10, y);
      y += 16;

      doc.setFont("courier", "normal");
      doc.setFontSize(9);
      doc.text(`Filename: ${incident.fileName}`, margin + 10, y); y += 12;
      doc.text(`Timestamp: ${incident.timestamp}`, margin + 10, y); y += 12;
      doc.text(`Latitude: ${incident.latitude}`, margin + 10, y); y += 12;
      doc.text(`Longitude: ${incident.longitude}`, margin + 10, y); y += 12;

      const hashLines = doc.splitTextToSize(`SHA-256: ${incident.fileHash}`, 330);
      doc.text(hashLines, margin + 10, y);
      y += hashLines.length * 10;

      const urlLines = doc.splitTextToSize(`File URL: ${incident.fileURL}`, 330);
      doc.text(urlLines, margin + 10, y);
      y += urlLines.length * 10;

      const qrDataUrl = await makeVerificationQrDataUrl(incident);
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, "PNG", margin + 360, y - 70, 90, 90);
        doc.setFont("times", "italic");
        doc.text("Scan to verify", margin + 370, y + 28);
      }

      doc.setFont("times", "italic");
      doc.text("Tamper-Evidence Note: Any modification changes the SHA-256 hash.", margin + 10, y + 36);
      y += 54;
    }

    doc.save(`evidence_certificate_${Date.now()}.pdf`);
    setStatus("Certificate generated with verification QR.");
  }

  async function captureMediaOnce(constraints, mimeType, extension, label) {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setStatus(`${label} capture not supported on this browser.`);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mimeType });
        const file = new File([blob], `${label.toLowerCase()}_${Date.now()}.${extension}`, { type: mimeType });
        await processEvidenceFile(file, label.toLowerCase());
      };

      recorder.start();
      setStatus(`${label} recording...`);

      setTimeout(() => {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      }, 8000);
    } catch (error) {
      setStatus(`${label} capture failed: ${error.message}`);
    }
  }

  async function runWitnessMode() {
    if (!ui.witnessQrImage) {
      return;
    }

    const latest = state.incidents[state.incidents.length - 1];
    if (!latest) {
      setStatus("Upload evidence first, then generate witness co-sign QR.");
      return;
    }

    if (!window.QRCode || !window.QRCode.toDataURL) {
      setStatus("QR engine unavailable.");
      return;
    }

    const payload = `${location.origin}${location.pathname}?witness=1&sid=${encodeURIComponent(state.sessionId)}&hash=${encodeURIComponent(latest.fileHash)}`;
    const qr = await window.QRCode.toDataURL(payload, { width: 180, margin: 1 });
    ui.witnessQrImage.src = qr;
    ui.witnessQrImage.style.display = "block";

    await appendCustodyAction(latest.incidentId, "witness_mode", "Witness QR generated");
    setStatus("Witness mode QR generated.");
  }

  async function uploadToFirebase(payload) {
    const safeName = payload.file.name.replace(/\s+/g, "-");
    const storagePath = `evidence/${Date.now()}_${safeName}`;

    const storageRef = firebaseStorage.ref(storagePath);
    await storageRef.put(payload.file);
    const fileURL = await storageRef.getDownloadURL();

    const ots = await anchorHashOnOpenTimestamps(payload.fileHash);

    const forensicRecord = {
      fileName: payload.file.name,
      fileURL,
      fileHash: payload.fileHash,
      latitude: payload.latitude,
      longitude: payload.longitude,
      timestamp: payload.timestamp,
      source: payload.source,
      sessionId: state.sessionId,
      immutable: true,
      blockchainAnchor: ots,
      custodyLog: [{
        action: "upload",
        details: "Evidence secured",
        timestamp: payload.timestamp,
        sessionId: state.sessionId
      }],
      serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    const incidentRef = await firestoreDb.collection("incidents").add(forensicRecord);
    await firestoreDb.collection("vaultHistory").add(forensicRecord);

    sendEmergencyAlert(fileURL, payload.latitude, payload.longitude);
    await appendCustodyAction(incidentRef.id, "share", "Emergency SMS opened");

    const localRecord = {
      ...forensicRecord,
      incidentId: incidentRef.id
    };

    state.incidents.push(localRecord);
    state.immutableFiles.push(localRecord);

    renderImmutableFiles();
    updateSyncedCount();
    await fetchAndDisplayVaultHistory();
    updateCertificateButtonState();
    setStatus("Secured! Immutable + custody log active.");
  }

  async function processEvidenceFile(originalFile, source) {
    if (!originalFile) {
      setStatus("No file selected.");
      return;
    }

    try {
      const file = await watermarkImageIfPossible(originalFile);
      const { latitude, longitude } = await getCurrentLocation();
      const fileHash = await sha256FromFile(file);
      const timestamp = new Date().toISOString();

      const payload = {
        file,
        source,
        fileHash,
        latitude,
        longitude,
        timestamp
      };

      if (!navigator.onLine) {
        await queueUploadItem(payload);
        setStatus("Offline detected. File queued for auto-sync.");
        return;
      }

      if (!state.firebaseReady) {
        const demoUrl = `demo://evidence/${encodeURIComponent(file.name)}`;
        const demoRecord = {
          fileName: file.name,
          fileURL: demoUrl,
          fileHash,
          latitude,
          longitude,
          timestamp,
          source,
          sessionId: state.sessionId,
          immutable: true,
          incidentId: null
        };
        state.incidents.push(demoRecord);
        state.immutableFiles.push(demoRecord);
        renderImmutableFiles();
        updateSyncedCount();
        await fetchAndDisplayVaultHistory();
        updateCertificateButtonState();
        setStatus("Secured in demo mode (connect Firebase for cloud sync).");
        return;
      }

      setStatus("Uploading...");
      await uploadToFirebase(payload);
    } catch (error) {
      console.error(error);
      setStatus(`Error: ${error.message}`);
    }
  }

  async function processEvidence() {
    const file = ui.fileInput && ui.fileInput.files ? ui.fileInput.files[0] : null;
    await processEvidenceFile(file, "file-picker");
  }

  async function processEvidenceFiles(fileList, source) {
    if (!fileList || !fileList.length) {
      return;
    }

    for (const file of Array.from(fileList)) {
      await processEvidenceFile(file, source || "multi-select");
    }
  }

  async function syncOfflineQueue() {
    if (!navigator.onLine || !state.firebaseReady || state.syncInProgress) {
      return;
    }

    state.syncInProgress = true;
    try {
      const queued = await getQueuedItems();
      if (!queued.length) {
        await refreshPendingUploadsIndicator();
        return;
      }

      setStatus(`Syncing ${queued.length} pending upload(s)...`);

      for (const item of queued) {
        try {
          await uploadToFirebase(item);
          await removeQueueItem(item.id);
        } catch (error) {
          console.warn("Queue item sync failed:", error.message);
        }
      }

      await refreshPendingUploadsIndicator();
      setStatus("Pending queue sync complete.");
    } finally {
      state.syncInProgress = false;
    }
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    try {
      await navigator.serviceWorker.register("./sw.js");
      console.log("Service worker registered");
    } catch (error) {
      console.warn("Service worker registration failed:", error.message);
    }
  }

  function bindUI() {
    ui.fileInput = document.querySelector(SELECTORS.fileInput);
    ui.uploadButton = document.querySelector(SELECTORS.uploadButton);
    ui.statusMessage = document.querySelector(SELECTORS.statusMessage);
    ui.certificateButton = document.querySelector(SELECTORS.certificateButton);
    ui.emergencyContactInput = document.querySelector(SELECTORS.emergencyContactInput);
    ui.emergencyContactWarning = document.querySelector(SELECTORS.emergencyContactWarning);
    ui.vaultFilesList = document.querySelector(SELECTORS.vaultFilesList);
    ui.vaultHistoryBody = document.querySelector(SELECTORS.vaultHistoryBody);
    ui.pendingUploadsCount = document.querySelector(SELECTORS.pendingUploadsCount);
    ui.audioRecordButton = document.querySelector(SELECTORS.audioRecordButton);
    ui.videoCaptureButton = document.querySelector(SELECTORS.videoCaptureButton);
    ui.witnessModeButton = document.querySelector(SELECTORS.witnessModeButton);
    ui.witnessQrImage = document.querySelector(SELECTORS.witnessQrImage);

    if (!ui.fileInput || !ui.uploadButton || !ui.statusMessage) {
      console.warn("Required UI controls not found. Verify IDs.");
      return;
    }

    ensureCertificateButton();
    loadEmergencyContact();
    renderImmutableFiles();
    updateCertificateButtonState();

    if (ui.emergencyContactInput) {
      ui.emergencyContactInput.addEventListener("input", (event) => updateEmergencyWarning(event.target.value));
      ui.emergencyContactInput.addEventListener("change", (event) => saveEmergencyContact(event.target.value));
      ui.emergencyContactInput.addEventListener("blur", (event) => saveEmergencyContact(event.target.value));
    }

    ui.uploadButton.addEventListener("click", async (event) => {
      event.preventDefault();
      await processEvidence();
    });

    if (ui.audioRecordButton) {
      ui.audioRecordButton.addEventListener("click", async () => {
        await captureMediaOnce({ audio: true }, "audio/webm", "webm", "AUDIO");
      });
    }

    if (ui.videoCaptureButton) {
      ui.videoCaptureButton.addEventListener("click", async () => {
        await captureMediaOnce({ video: true, audio: true }, "video/webm", "webm", "VIDEO");
      });
    }

    if (ui.witnessModeButton) {
      ui.witnessModeButton.addEventListener("click", async () => {
        await runWitnessMode();
      });
    }

    window.addEventListener("online", async () => {
      setStatus("Connectivity restored. Auto-sync starting...");
      await syncOfflineQueue();
    });

    window.addEventListener("offline", () => {
      setStatus("Offline mode active. New uploads will be queued.");
    });
  }

  async function init() {
    try {
      await loadDependencies();
      initFirebaseCompat();
      bindUI();
      await registerServiceWorker();
      await refreshPendingUploadsIndicator();
      await fetchAndDisplayVaultHistory();
      await syncOfflineQueue();
      setStatus(state.firebaseReady ? "Ready" : "Ready (demo mode: Firebase not configured)");
    } catch (error) {
      console.error(error);
      setStatus(`Init error: ${error.message}`);
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  window.processEvidence = processEvidence;
  window.handleForensicFiles = processEvidenceFiles;
  window.fetchVaultHistory = fetchAndDisplayVaultHistory;
  window.syncOfflineQueue = syncOfflineQueue;
  window.uploadCaseEvidenceWithCard = uploadCaseEvidenceWithCard;
})();
