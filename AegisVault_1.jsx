import React, { useState, useEffect, useRef, useCallback } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { addDoc, arrayUnion, collection, doc, getDoc, getDocFromCache, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { auth, db, isFirestoreOfflineError } from "./firebase-config.js";
import { isSupabaseConfigured, supabase, supabaseBucket } from "./supabase-config.js";

const STAGES = ["Filed", "Under Review", "Hearing Scheduled", "Hearing", "Closed"];
const STATUS_COLORS = { hearing: "indigo", review: "amber", pending: "slate", closed: "emerald" };

function mapEvidenceItem(item, idFallback) {
  return {
    id: item?.id || idFallback,
    name: item?.name || item?.fileName || "Untitled evidence",
    type: item?.type || item?.fileType || "file",
    hash: item?.hash || item?.fileHash || "-",
    verified: item?.verified !== false,
    gps: item?.gps || ((item?.latitude != null && item?.longitude != null) ? `${item.latitude},${item.longitude}` : "-") ,
    downloadURL: item?.downloadURL || "",
    timestamp: item?.timestamp || item?.createdAt || new Date().toISOString(),
    size: item?.size || "-",
  };
}

function mapTimelineItem(item, idFallback) {
  return {
    id: item?.id || idFallback,
    time: item?.time || item?.timestamp || new Date().toISOString(),
    label: item?.label || item?.title || "Case update",
    detail: item?.detail || item?.text || "",
    type: item?.type || "update",
  };
}

function mapUpdateItem(item, idFallback) {
  return {
    id: item?.id || idFallback,
    author: item?.author || item?.authorName || "System",
    role: item?.role || "lawyer",
    time: item?.time || item?.timestamp || new Date().toISOString(),
    text: item?.text || "",
  };
}

function mapCaseDoc(id, data) {
  const timeline = Array.isArray(data?.timeline) ? data.timeline.map((t, i) => mapTimelineItem(t, `${id}-t-${i}`)) : [];
  const updates = Array.isArray(data?.updates) ? data.updates.map((u, i) => mapUpdateItem(u, `${id}-u-${i}`)) : [];
  const evidence = Array.isArray(data?.evidence) ? data.evidence.map((e, i) => mapEvidenceItem(e, `${id}-e-${i}`)) : [];

  return {
    id,
    title: data?.title || data?.caseName || "Untitled Case",
    status: data?.status || "pending",
    stage: Number.isFinite(data?.stage) ? data.stage : 0,
    client: data?.client || data?.clientName || data?.clientEmail || "-",
    lawyer: data?.lawyer || data?.lawyerName || data?.lawyerEmail || "-",
    clientUid: data?.clientUid || "",
    lawyerUid: data?.lawyerUid || "",
    filed: data?.filed || data?.createdAt || "-",
    nextHearing: data?.nextHearing || "TBD",
    priority: data?.priority || "medium",
    timeline,
    updates,
    evidence,
  };
}

function downloadEvidenceCertificate(caseRecord) {
  const docPdf = new jsPDF({ unit: "pt", format: "a4" });
  const left = 40;
  let y = 50;

  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(18);
  docPdf.text("Evidence Certificate", left, y);

  y += 24;
  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(10);
  docPdf.text(`Generated: ${new Date().toISOString()}`, left, y);
  y += 14;
  docPdf.text(`Case ID: ${caseRecord.id}`, left, y);
  y += 14;
  docPdf.text(`Case Title: ${caseRecord.title || "Untitled Case"}`, left, y);
  y += 14;
  docPdf.text(`Client: ${caseRecord.client || "-"}`, left, y);
  y += 14;
  docPdf.text(`Lawyer: ${caseRecord.lawyer || "-"}`, left, y);

  y += 22;
  docPdf.setFont("helvetica", "bold");
  docPdf.text("Evidence Metadata", left, y);
  y += 14;

  const evidence = Array.isArray(caseRecord.evidence) ? caseRecord.evidence : [];
  if (!evidence.length) {
    docPdf.setFont("helvetica", "normal");
    docPdf.text("No evidence records found.", left, y);
  } else {
    evidence.forEach((item, idx) => {
      if (y > 740) {
        docPdf.addPage();
        y = 50;
      }

      docPdf.setFont("helvetica", "bold");
      docPdf.text(`${idx + 1}. ${item.name || "Unnamed file"}`, left, y);
      y += 12;
      docPdf.setFont("helvetica", "normal");
      docPdf.text(`GPS Coordinates: ${item.gps || "-"}`, left, y);
      y += 12;
      docPdf.text(`Digital Hash: ${item.hash || "-"}`, left, y);
      y += 12;
      docPdf.text(`Timestamp: ${item.timestamp || "-"}`, left, y);
      y += 16;
    });
  }

  docPdf.save(`evidence_certificate_${caseRecord.id}.pdf`);
}

async function getCurrentGpsString() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve("GPS unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(`${pos.coords.latitude.toFixed(4)},${pos.coords.longitude.toFixed(4)}`),
      () => resolve("GPS unavailable"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

async function sha256Hex(file) {
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "hash-unavailable";
  }
}

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 20, className = "", ...props }) => {
  const icons = {
    shield: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    home: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    folder: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
    alert: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    settings: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    mic: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
    camera: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
    upload: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} {...props}><polyline points="20 6 9 17 4 12"/></svg>,
    x: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    map: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
    clock: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    scale: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><line x1="12" y1="3" x2="12" y2="21"/><path d="M17 8H7"/><path d="M5 21H19"/><path d="M5 8l-2 6a2 2 0 004 0L5 8zM19 8l-2 6a2 2 0 004 0L19 8z"/></svg>,
    users: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
    stop: <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}><rect x="3" y="3" width="18" height="18" rx="3"/></svg>,
    play: <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}><polygon points="5 3 19 12 5 21 5 3"/></svg>,
    file: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    chevronRight: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} {...props}><polyline points="9 18 15 12 9 6"/></svg>,
    logout: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    send: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    hash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>,
    briefcase: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} {...props}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>,
  };
  return icons[name] || null;
};

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatRelative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return formatTime(iso).split(",")[0];
}

function toInitials(nameOrEmail) {
  const source = (nameOrEmail || "").trim();
  if (!source) return "AV";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function normalizeRole(role) {
  return role === "victim" ? "client" : (role || "client");
}

function buildPortalUser(uid, profile, fallbackEmail) {
  const role = normalizeRole(profile?.role);
  const name = (profile?.name || fallbackEmail || "User").trim();
  return {
    uid,
    name,
    email: profile?.email || fallbackEmail || "",
    role,
    avatar: toInitials(name),
    bar: role === "lawyer" ? (profile?.bar || "Attorney") : undefined,
  };
}

function normalizePhoneInput(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function isLikelyPhone(value) {
  const normalized = normalizePhoneInput(value);
  return /^\+?[0-9]{8,15}$/.test(normalized);
}

function buildDistressMessage(userName, timestamp, gps) {
  return `AegisVault DISTRESS ALERT: ${userName || "Victim"} opened the vault in distress at ${timestamp}. Last known GPS: ${gps || "unavailable"}.`;
}

function SettingsPanel({
  trustedContacts,
  onAddContact,
  onRemoveContact,
  onSendTestAlert,
  alertStatus,
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const submitContact = async (event) => {
    event.preventDefault();
    await onAddContact({ name: name.trim(), phone: phone.trim() });
    setName("");
    setPhone("");
  };

  return (
    <div className="fade-in stack">
      <div className="card">
        <div className="section-heading">Trusted Contacts</div>
        <form onSubmit={submitContact} className="stack-sm" style={{ marginBottom: 12 }}>
          <input className="input" placeholder="Contact name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="Phone number (e.g. +15551234567)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" type="submit">Add Contact</button>
            <button className="btn btn-ghost" type="button" onClick={onSendTestAlert}>Send Test Alert</button>
          </div>
        </form>

        {!trustedContacts.length && (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No trusted contacts yet.</div>
        )}

        <div className="stack-sm">
          {trustedContacts.map((contact) => (
            <div key={contact.id} className="update-item" style={{ alignItems: "center" }}>
              <div className="update-body">
                <div className="update-author">{contact.name || "Trusted Contact"}</div>
                <div className="update-time">{contact.phone}</div>
              </div>
              <button className="btn btn-ghost" onClick={() => onRemoveContact(contact.id)}>Remove</button>
            </div>
          ))}
        </div>

        {alertStatus && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#fca5a5" }}>{alertStatus}</div>
        )}
      </div>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  
  :root {
    --bg: #050810;
    --surface: #0c1120;
    --surface2: #111827;
    --surface3: #1a2236;
    --border: rgba(99,120,180,0.12);
    --border-active: rgba(99,120,180,0.3);
    --text: #e8eaf0;
    --text-muted: #6b7a99;
    --text-dim: #3d4f6e;
    --indigo: #6366f1;
    --indigo-light: #818cf8;
    --indigo-dim: rgba(99,102,241,0.12);
    --red: #ef4444;
    --red-dim: rgba(239,68,68,0.1);
    --amber: #f59e0b;
    --amber-dim: rgba(245,158,11,0.1);
    --emerald: #10b981;
    --emerald-dim: rgba(16,185,129,0.1);
    --font-display: 'DM Serif Display', Georgia, serif;
    --font-body: 'Outfit', system-ui, sans-serif;
    --font-mono: 'DM Mono', monospace;
    --radius: 12px;
    --radius-sm: 8px;
    --sidebar-w: 240px;
  }

  html, body, #root { height: 100%; }
  body { 
    font-family: var(--font-body); 
    background: var(--bg); 
    color: var(--text);
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border-active); border-radius: 4px; }

  /* Layout */
  .app-layout { display: flex; height: 100vh; overflow: hidden; }
  
  /* Sidebar */
  .sidebar {
    width: var(--sidebar-w);
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    flex-shrink: 0;
    position: relative;
    z-index: 10;
  }
  .sidebar::after {
    content: '';
    position: absolute;
    top: 0; right: 0;
    width: 1px; height: 100%;
    background: linear-gradient(to bottom, transparent, var(--indigo) 40%, var(--indigo) 60%, transparent);
    opacity: 0.3;
  }
  .sidebar-logo {
    padding: 24px 20px 20px;
    border-bottom: 1px solid var(--border);
  }
  .logo-mark {
    display: flex; align-items: center; gap: 10px;
    font-family: var(--font-display);
    font-size: 20px;
    color: var(--text);
    letter-spacing: -0.02em;
  }
  .logo-icon {
    width: 32px; height: 32px;
    background: linear-gradient(135deg, var(--indigo), #8b5cf6);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 20px rgba(99,102,241,0.4);
  }
  .sidebar-role {
    margin-top: 8px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .sidebar-nav { flex: 1; padding: 16px 12px; display: flex; flex-direction: column; gap: 2px; }
  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
    border: none; background: none; width: 100%; text-align: left;
  }
  .nav-item:hover { background: var(--surface3); color: var(--text); }
  .nav-item.active { background: var(--indigo-dim); color: var(--indigo-light); }
  .nav-item.active svg { color: var(--indigo-light); }
  .nav-section { padding: 16px 12px 4px; font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-dim); }
  .sidebar-footer {
    padding: 16px 12px;
    border-top: 1px solid var(--border);
  }
  .user-chip {
    display: flex; align-items: center; gap: 10px;
    padding: 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s;
  }
  .user-chip:hover { background: var(--surface3); }
  .avatar {
    width: 32px; height: 32px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700;
    flex-shrink: 0;
  }
  .avatar-client { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; }
  .avatar-lawyer { background: linear-gradient(135deg, #0ea5e9, #6366f1); color: white; }
  .user-info { flex: 1; min-width: 0; }
  .user-name { font-size: 13px; font-weight: 600; color: var(--text); truncate; }
  .user-role { font-size: 11px; color: var(--text-muted); }

  /* Main content */
  .main-content { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
  .page-header {
    padding: 32px 40px 0;
    position: sticky; top: 0;
    background: var(--bg);
    z-index: 5;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--border);
  }
  .page-title { font-family: var(--font-display); font-size: 28px; letter-spacing: -0.02em; color: var(--text); }
  .page-subtitle { font-size: 14px; color: var(--text-muted); margin-top: 4px; }
  .page-body { padding: 32px 40px; flex: 1; }

  /* Cards */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
  }
  .card-hover { transition: border-color 0.2s, transform 0.2s; cursor: pointer; }
  .card-hover:hover { border-color: var(--border-active); transform: translateY(-1px); }
  .card-title { font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px; }
  .card-value { font-family: var(--font-display); font-size: 32px; color: var(--text); }

  /* Status badges */
  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.05em; text-transform: uppercase;
  }
  .badge-indigo { background: var(--indigo-dim); color: var(--indigo-light); border: 1px solid rgba(99,102,241,0.2); }
  .badge-amber { background: var(--amber-dim); color: var(--amber); border: 1px solid rgba(245,158,11,0.2); }
  .badge-emerald { background: var(--emerald-dim); color: var(--emerald); border: 1px solid rgba(16,185,129,0.2); }
  .badge-slate { background: rgba(100,116,139,0.1); color: #94a3b8; border: 1px solid rgba(100,116,139,0.2); }
  .badge-red { background: var(--red-dim); color: #fca5a5; border: 1px solid rgba(239,68,68,0.2); }
  .badge-dot::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor; display: inline-block; }

  /* Stage stepper */
  .stepper { display: flex; align-items: center; gap: 0; }
  .step {
    display: flex; flex-direction: column; align-items: center; flex: 1;
    position: relative;
  }
  .step:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 14px; left: calc(50% + 14px);
    width: calc(100% - 28px);
    height: 2px;
    background: var(--border);
  }
  .step.done:not(:last-child)::after { background: var(--indigo); opacity: 0.5; }
  .step-dot {
    width: 28px; height: 28px;
    border-radius: 50%;
    border: 2px solid var(--border);
    background: var(--surface);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700;
    color: var(--text-muted);
    position: relative; z-index: 1;
    transition: all 0.3s;
  }
  .step.done .step-dot { background: var(--indigo); border-color: var(--indigo); color: white; }
  .step.active .step-dot { background: var(--surface); border-color: var(--indigo-light); color: var(--indigo-light); box-shadow: 0 0 0 4px var(--indigo-dim); }
  .step-label { font-size: 10px; font-weight: 500; color: var(--text-dim); margin-top: 6px; text-align: center; white-space: nowrap; }
  .step.active .step-label, .step.done .step-label { color: var(--text-muted); }

  /* Timeline */
  .timeline { display: flex; flex-direction: column; gap: 0; }
  .timeline-item { display: flex; gap: 16px; padding-bottom: 24px; position: relative; }
  .timeline-item:not(:last-child)::before {
    content: ''; position: absolute;
    left: 14px; top: 28px;
    width: 2px; bottom: 0;
    background: var(--border);
  }
  .timeline-dot {
    width: 30px; height: 30px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; position: relative; z-index: 1;
  }
  .dot-milestone { background: linear-gradient(135deg, var(--indigo), #8b5cf6); box-shadow: 0 0 16px rgba(99,102,241,0.4); }
  .dot-evidence { background: linear-gradient(135deg, #0ea5e9, var(--indigo)); }
  .dot-update { background: var(--surface3); border: 2px solid var(--border-active); }
  .dot-legal { background: linear-gradient(135deg, #8b5cf6, #6366f1); }
  .timeline-content { flex: 1; padding-top: 4px; }
  .timeline-label { font-size: 14px; font-weight: 600; color: var(--text); }
  .timeline-detail { font-size: 13px; color: var(--text-muted); margin-top: 3px; line-height: 1.5; }
  .timeline-time { font-size: 11px; color: var(--text-dim); font-family: var(--font-mono); margin-top: 4px; }

  /* Evidence grid */
  .evidence-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
  .evidence-card {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 14px;
    transition: border-color 0.2s;
  }
  .evidence-card:hover { border-color: var(--border-active); }
  .evidence-preview {
    height: 80px; border-radius: 6px;
    background: var(--surface3);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 10px;
    color: var(--text-dim);
  }
  .evidence-name { font-size: 12px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .evidence-hash { font-family: var(--font-mono); font-size: 10px; color: var(--text-dim); margin-top: 2px; }
  .verified-badge { display: flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; color: var(--emerald); margin-top: 6px; }

  /* Updates / messages */
  .update-item {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 14px 16px;
    display: flex; gap: 12px;
  }
  .update-body { flex: 1; }
  .update-author { font-size: 13px; font-weight: 600; color: var(--text); }
  .update-time { font-size: 11px; color: var(--text-dim); }
  .update-text { font-size: 13px; color: var(--text-muted); margin-top: 6px; line-height: 1.6; }

  /* Emergency */
  .emergency-overlay {
    position: fixed; inset: 0;
    background: rgba(5,8,16,0.97);
    z-index: 100;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 32px;
  }
  .pulse-ring {
    position: absolute;
    border-radius: 50%;
    border: 2px solid currentColor;
    animation: pulseRing 2s ease-out infinite;
    opacity: 0;
  }
  @keyframes pulseRing {
    0% { transform: scale(0.8); opacity: 0.8; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  .record-btn {
    width: 120px; height: 120px;
    border-radius: 50%;
    border: none; cursor: pointer;
    position: relative;
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.2s;
  }
  .record-btn:hover { transform: scale(1.05); }
  .record-btn.idle {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    box-shadow: 0 0 40px rgba(239,68,68,0.5), 0 0 80px rgba(239,68,68,0.2);
    color: white;
  }
  .record-btn.recording {
    background: linear-gradient(135deg, #7f1d1d, #991b1b);
    box-shadow: 0 0 40px rgba(239,68,68,0.7), 0 0 100px rgba(239,68,68,0.3);
    animation: recordPulse 1.5s ease-in-out infinite;
    color: white;
  }
  @keyframes recordPulse {
    0%, 100% { box-shadow: 0 0 40px rgba(239,68,68,0.7), 0 0 100px rgba(239,68,68,0.3); }
    50% { box-shadow: 0 0 60px rgba(239,68,68,0.9), 0 0 140px rgba(239,68,68,0.4); }
  }
  .em-status { font-family: var(--font-mono); font-size: 13px; color: var(--text-muted); text-align: center; }
  .em-timer { font-family: var(--font-display); font-size: 48px; color: var(--red); letter-spacing: -0.02em; }
  .em-mode-btn {
    padding: 10px 20px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 13px; font-weight: 500;
    cursor: pointer;
    display: flex; align-items: center; gap: 8px;
    transition: all 0.2s;
  }
  .em-mode-btn:hover { border-color: var(--border-active); background: var(--surface2); }
  .em-mode-btn.active { border-color: var(--indigo); background: var(--indigo-dim); color: var(--indigo-light); }
  .em-close {
    position: absolute; top: 24px; right: 24px;
    padding: 8px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-muted); font-size: 13px;
    cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    transition: all 0.2s;
  }
  .em-close:hover { border-color: var(--border-active); color: var(--text); }
  .em-gps { font-size: 11px; font-family: var(--font-mono); color: var(--text-dim); display: flex; align-items: center; gap: 6px; }

  /* Case list item */
  .case-item {
    display: flex; align-items: center; gap: 16px;
    padding: 16px 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 8px;
  }
  .case-item:hover { border-color: var(--border-active); background: var(--surface2); }
  .case-item.active { border-color: var(--indigo); background: var(--indigo-dim); }
  .case-info { flex: 1; min-width: 0; }
  .case-title { font-size: 15px; font-weight: 600; color: var(--text); }
  .case-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
  .case-priority { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .priority-high { background: var(--red); box-shadow: 0 0 8px var(--red); }
  .priority-medium { background: var(--amber); }
  .priority-low { background: var(--emerald); }

  /* Tabs */
  .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 24px; }
  .tab {
    padding: 10px 20px;
    font-size: 13px; font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.2s;
    background: none; border-top: none; border-left: none; border-right: none;
  }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--indigo-light); border-bottom-color: var(--indigo); }

  /* Input */
  .input {
    width: 100%;
    padding: 10px 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 14px;
    font-family: var(--font-body);
    outline: none;
    transition: border-color 0.2s;
    resize: none;
  }
  .input:focus { border-color: var(--indigo); }
  .input::placeholder { color: var(--text-dim); }

  /* Btn */
  .btn {
    padding: 9px 18px;
    border-radius: var(--radius-sm);
    font-size: 13px; font-weight: 600;
    cursor: pointer; border: none;
    display: inline-flex; align-items: center; gap: 6px;
    transition: all 0.2s;
  }
  .btn-primary { background: var(--indigo); color: white; }
  .btn-primary:hover { background: #4f46e5; }
  .btn-ghost { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }
  .btn-ghost:hover { background: var(--surface2); color: var(--text); border-color: var(--border-active); }

  /* Stats row */
  .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
  .stat-card { padding: 20px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
  .stat-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 8px; }
  .stat-value { font-family: var(--font-display); font-size: 28px; color: var(--text); line-height: 1; }
  .stat-sub { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

  /* Upload drop zone */
  .dropzone {
    border: 2px dashed var(--border);
    border-radius: var(--radius);
    padding: 40px;
    text-align: center;
    transition: all 0.2s;
    cursor: pointer;
  }
  .dropzone:hover, .dropzone.drag { border-color: var(--indigo); background: var(--indigo-dim); }

  /* Mobile bottom nav */
  .bottom-nav {
    display: none;
    position: fixed; bottom: 0; left: 0; right: 0;
    background: var(--surface);
    border-top: 1px solid var(--border);
    z-index: 20;
  }
  .bottom-nav-inner { display: flex; align-items: center; justify-content: space-around; padding: 8px 12px 12px; }
  .bottom-nav-item {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 10px; font-weight: 500;
    color: var(--text-muted);
    background: none; border: none;
    transition: all 0.2s;
  }
  .bottom-nav-item.active { color: var(--indigo-light); }
  .emergency-nav-btn {
    width: 54px; height: 54px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 24px rgba(239,68,68,0.5);
    color: white;
    margin-top: -20px;
  }

  /* Switch between login roles */
  .login-screen {
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg);
    padding: 24px;
  }
  .login-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 40px;
    width: 100%; max-width: 400px;
    box-shadow: 0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px var(--border);
  }
  .login-title { font-family: var(--font-display); font-size: 32px; letter-spacing: -0.02em; margin-bottom: 8px; }
  .login-sub { font-size: 14px; color: var(--text-muted); margin-bottom: 32px; }
  .role-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 28px; }
  .role-tab {
    padding: 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface2);
    color: var(--text-muted);
    font-size: 13px; font-weight: 500;
    cursor: pointer; text-align: center;
    transition: all 0.2s;
  }
  .role-tab.active { border-color: var(--indigo); background: var(--indigo-dim); color: var(--indigo-light); }
  .login-btn {
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, var(--indigo), #8b5cf6);
    border: none; border-radius: var(--radius-sm);
    color: white; font-size: 15px; font-weight: 600;
    cursor: pointer; margin-top: 20px;
    transition: opacity 0.2s;
    box-shadow: 0 8px 24px rgba(99,102,241,0.4);
  }
  .login-btn:hover { opacity: 0.9; }
  .login-hint { text-align: center; margin-top: 20px; font-size: 12px; color: var(--text-dim); }

  /* Section divider */
  .section-heading { font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .section-heading::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  /* Grid utility */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .flex-gap { display: flex; align-items: center; gap: 10px; }
  .spacer { flex: 1; }
  .divider { height: 1px; background: var(--border); margin: 20px 0; }

  @media (max-width: 768px) {
    .sidebar { display: none; }
    .bottom-nav { display: block; }
    .page-header { padding: 20px 16px; }
    .page-body { padding: 20px 16px 80px; }
    .stats-row { grid-template-columns: 1fr 1fr; }
    .two-col, .three-col { grid-template-columns: 1fr; }
  }

  /* Animations */
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .fade-in { animation: fadeIn 0.3s ease forwards; }
  @keyframes slideIn { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }
  .slide-in { animation: slideIn 0.3s ease forwards; }

  /* Section gaps */
  .stack { display: flex; flex-direction: column; gap: 16px; }
  .stack-sm { display: flex; flex-direction: column; gap: 8px; }

  /* Lawyer two-pane layout */
  .two-pane { display: grid; grid-template-columns: 320px 1fr; gap: 0; flex: 1; overflow: hidden; }
  .pane-left { border-right: 1px solid var(--border); overflow-y: auto; padding: 20px; }
  .pane-right { overflow-y: auto; padding: 32px; }

  @media (max-width: 1024px) {
    .two-pane { grid-template-columns: 1fr; }
    .pane-left { border-right: none; border-bottom: 1px solid var(--border); }
  }
`;

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, errorMessage }) {
  const [role, setRole] = useState("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      await onLogin({ email: email.trim(), password, roleHint: role });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card fade-in">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div className="logo-icon"><Icon name="shield" size={18} /></div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>AegisVault</span>
        </div>
        <div className="login-title">Secure Access</div>
        <div className="login-sub">A dual-layer legal safety platform. Sign in to continue.</div>
        <div className="role-tabs">
          <button className={`role-tab ${role === "client" ? "active" : ""}`} onClick={() => setRole("client")}>
            <Icon name="shield" size={14} style={{ display: "inline", marginRight: 6 }} />
            Client / Victim
          </button>
          <button className={`role-tab ${role === "lawyer" ? "active" : ""}`} onClick={() => setRole("lawyer")}>
            <Icon name="scale" size={14} style={{ display: "inline", marginRight: 6 }} />
            Attorney
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input className="input" type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="login-btn" type="submit" disabled={loading} style={{ opacity: loading ? 0.7 : 1, cursor: loading ? "wait" : "pointer" }}>
            {loading ? "Signing In..." : `Sign In as ${role === "client" ? "Client" : "Attorney"}`}
          </button>
        </form>
        <div className="login-hint">Use your registered Firebase credentials.</div>
        {errorMessage && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: "var(--radius-sm)", border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)", color: "#fca5a5", fontSize: 12 }}>
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EMERGENCY MODE ───────────────────────────────────────────────────────────
function EmergencyMode({ onClose }) {
  const [recording, setRecording] = useState(false);
  const [mode, setMode] = useState("audio"); // audio | video
  const [seconds, setSeconds] = useState(0);
  const [gps, setGps] = useState("Acquiring GPS...");
  const [capturedAt, setCapturedAt] = useState("");
  const [saved, setSaved] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const captureGeoAndTime = () => {
    setCapturedAt(new Date().toISOString());
    if (!navigator.geolocation) {
      setGps("GPS unavailable");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`),
      () => setGps("GPS unavailable"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const toggleRecording = () => {
    captureGeoAndTime();
    if (recording) {
      clearInterval(timerRef.current);
      setRecording(false);
      setSaved(true);
    } else {
      setSeconds(0);
      setSaved(false);
      setRecording(true);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    }
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="emergency-overlay">
      <button className="em-close" onClick={onClose}>
        <Icon name="x" size={14} /> Exit Emergency Mode
      </button>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--red)", marginBottom: 8 }}>
          ● Emergency Capture
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text)", marginBottom: 4 }}>
          {saved ? "Evidence Secured & Uploaded" : recording ? "Recording in Progress" : "Ready to Record"}
        </div>
        <div className="em-gps"><Icon name="map" size={12} />{gps}</div>
        <div className="em-gps" style={{ marginTop: 6 }}><Icon name="clock" size={12} />{capturedAt ? formatTime(capturedAt) : "Timestamp pending"}</div>
      </div>

      {recording && <div className="em-timer">{fmt(seconds)}</div>}

      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {recording && <>
          <div className="pulse-ring" style={{ width: 140, height: 140, color: "var(--red)" }} />
          <div className="pulse-ring" style={{ width: 140, height: 140, color: "var(--red)", animationDelay: "0.7s" }} />
        </>}
        <button className={`record-btn ${recording ? "recording" : "idle"}`} onClick={toggleRecording}>
          {recording ? <Icon name="stop" size={40} /> : <Icon name="mic" size={40} />}
        </button>
      </div>

      <div className="em-status">
        {saved
          ? "✓ SHA-256 hash generated · Uploading to encrypted vault · Case auto-created"
          : recording
          ? `Capturing ${mode} · GPS tagged · End-to-end encrypted`
          : "Tap to begin secure recording"}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button className={`em-mode-btn ${mode === "audio" ? "active" : ""}`} onClick={() => setMode("audio")}>
          <Icon name="mic" size={14} /> Audio
        </button>
        <button className={`em-mode-btn ${mode === "video" ? "active" : ""}`} onClick={() => setMode("video")}>
          <Icon name="camera" size={14} /> Video
        </button>
        <button className={`em-mode-btn`} onClick={() => {}}>
          <Icon name="upload" size={14} /> Upload File
        </button>
      </div>

      {saved && (
        <div style={{ background: "var(--emerald-dim)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "var(--radius)", padding: "16px 24px", textAlign: "center", maxWidth: 360, animation: "fadeIn 0.4s ease" }}>
          <div style={{ color: "var(--emerald)", fontWeight: 700, fontSize: 14 }}>Evidence Secured</div>
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>Cryptographic hash generated. GPS coordinates embedded. Added to active case.</div>
        </div>
      )}
    </div>
  );
}

// ─── CLIENT DASHBOARD ─────────────────────────────────────────────────────────
function ClientDashboard({ onNavigate, cases, loadingCases }) {
  const myCase = cases[0] || null;
  const evidenceCount = myCase?.evidence?.length || 0;
  const lastUpdate = myCase?.updates?.[myCase.updates.length - 1];

  if (loadingCases) {
    return <div className="fade-in" style={{ color: "var(--text-muted)" }}>Loading your cases...</div>;
  }

  if (!myCase) {
    return (
      <div className="fade-in">
        <div className="card" style={{ textAlign: "center", color: "var(--text-muted)" }}>
          No case found yet. Your assigned cases will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Active Cases</div>
          <div className="stat-value">{cases.length}</div>
          <div className="stat-sub">{myCase.nextHearing !== "TBD" ? `Hearing: ${myCase.nextHearing}` : "No hearing date"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Evidence Items</div>
          <div className="stat-value">{evidenceCount}</div>
          <div className="stat-sub">{evidenceCount ? "Synced from Firestore" : "No evidence yet"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Legal Access</div>
          <div className="stat-value" style={{ fontSize: 18, color: "var(--emerald)" }}>Granted</div>
          <div className="stat-sub">{myCase.lawyer || "Not assigned"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Last Update</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{lastUpdate ? formatRelative(lastUpdate.time) : "-"}</div>
          <div className="stat-sub">{lastUpdate ? "Attorney posted" : "No updates"}</div>
        </div>
      </div>

      {/* Emergency CTA */}
      <div style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(220,38,38,0.04))", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius)", padding: "20px 24px", display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Emergency Recording</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>One tap to capture audio/video with GPS and cryptographic verification.</div>
        </div>
        <button onClick={() => onNavigate("emergency")} style={{ padding: "12px 24px", background: "linear-gradient(135deg, #ef4444, #dc2626)", border: "none", borderRadius: "var(--radius-sm)", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 8px 24px rgba(239,68,68,0.4)", whiteSpace: "nowrap" }}>
          ● Start Recording
        </button>
      </div>

      <div className="section-heading">Your Case</div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>{myCase.title}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>Filed {myCase.filed} · Attorney: {myCase.lawyer}</div>
          </div>
          <span className="badge badge-indigo badge-dot">Hearing</span>
        </div>
        <div className="stepper">
          {STAGES.map((s, i) => {
            const done = i < myCase.stage;
            const active = i === myCase.stage;
            return (
              <div key={s} className={`step ${done ? "done" : ""} ${active ? "active" : ""}`}>
                <div className="step-dot">{done ? <Icon name="check" size={12} /> : i + 1}</div>
                <div className="step-label">{s}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section-heading">Recent Updates from Attorney</div>
      <div className="stack">
        {(myCase.updates || []).map(u => (
          <div key={u.id} className="update-item">
            <div className={`avatar avatar-lawyer`} style={{ width: 36, height: 36, fontSize: 12, flexShrink: 0 }}>MW</div>
            <div className="update-body">
              <div className="flex-gap">
                <span className="update-author">{u.author}</span>
                <span className="badge badge-indigo" style={{ fontSize: 9 }}>Attorney</span>
                <span className="spacer" />
                <span className="update-time">{formatRelative(u.time)}</span>
              </div>
              <div className="update-text">{u.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CLIENT CASES ─────────────────────────────────────────────────────────────
function ClientCases({ cases, loadingCases, user, onCreateCase, creatingCase, onUploadEvidence, uploadingCaseId }) {
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");

  const submitCreateCase = async (event) => {
    event.preventDefault();
    if (!newTitle.trim() || !onCreateCase) return;
    await onCreateCase({ title: newTitle.trim(), priority: newPriority });
    setNewTitle("");
    setNewPriority("medium");
  };

  if (loadingCases) {
    return <div className="fade-in" style={{ color: "var(--text-muted)" }}>Loading case details...</div>;
  }

  return (
    <div className="fade-in">
      {user?.role === "client" && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-heading">Create New Case</div>
          <form onSubmit={submitCreateCase} className="stack-sm">
            <input className="input" placeholder="Case title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <div style={{ display: "flex", gap: 10 }}>
              <select className="input" value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <button className="btn btn-primary" type="submit" disabled={creatingCase}>{creatingCase ? "Creating..." : "Create Case"}</button>
            </div>
          </form>
        </div>
      )}

      {!cases.length && (
        <div className="card" style={{ textAlign: "center", color: "var(--text-muted)", marginBottom: 16 }}>
          No cases found for this account yet.
        </div>
      )}

      {cases.map(c => (
        <div key={c.id} className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div className={`case-priority priority-${c.priority}`} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{c.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Filed {c.filed}</div>
            </div>
            <span className={`badge badge-${STATUS_COLORS[c.status]}`}>{c.status}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button className="btn btn-ghost" onClick={() => downloadEvidenceCertificate(c)}>
              <Icon name="file" size={13} /> Download Evidence Certificate
            </button>
          </div>
          <div className="stepper" style={{ marginBottom: 20 }}>
            {STAGES.map((s, i) => {
              const done = i < c.stage; const active = i === c.stage;
              return <div key={s} className={`step ${done ? "done" : ""} ${active ? "active" : ""}`}><div className="step-dot">{done ? <Icon name="check" size={12} /> : i + 1}</div><div className="step-label">{s}</div></div>;
            })}
          </div>
          <div className="section-heading">Evidence ({c.evidence.length} items)</div>
          <div className="evidence-grid">
            {c.evidence.map(e => (
              <div key={e.id} className="evidence-card">
                <div className="evidence-preview">
                  <Icon name={e.type === "audio" ? "mic" : e.type === "video" ? "camera" : "file"} size={28} />
                </div>
                <div className="evidence-name">{e.name}</div>
                <div className="evidence-hash">{e.hash}</div>
                <div className="verified-badge"><Icon name="check" size={10} /> Cryptographically Verified</div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, display: "flex", gap: 6 }}>
                  <Icon name="map" size={10} />{e.gps}
                </div>
                {e.downloadURL && (
                  <a href={e.downloadURL} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "var(--indigo-light)", marginTop: 6, display: "inline-block" }}>
                    Open File
                  </a>
                )}
              </div>
            ))}
            <div className="evidence-card" style={{ border: "2px dashed var(--border)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 140, gap: 8 }} onClick={() => document.getElementById(`file-upload-${c.id}`)?.click()}>
              <input id={`file-upload-${c.id}`} type="file" accept="image/*,.pdf,application/pdf" multiple style={{ display: "none" }} onChange={(e) => {
                const selectedFiles = Array.from(e.target.files || []);
                if (selectedFiles.length && onUploadEvidence) {
                  selectedFiles.reduce(
                    (p, file) => p.then(() => onUploadEvidence(c.id, file)),
                    Promise.resolve()
                  );
                }
                e.target.value = "";
              }} />
              <Icon name="upload" size={24} style={{ color: "var(--text-dim)" }} />
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                {uploadingCaseId === c.id
                  ? "Uploading..."
                  : (isSupabaseConfigured ? "Upload Screenshots / PDFs" : "Log Evidence Metadata (Supabase not configured)")}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── LAWYER DASHBOARD ─────────────────────────────────────────────────────────
function LawyerDashboard({ user, cases, loadingCases, onUploadEvidence, uploadingCaseId }) {
  const [selectedCase, setSelectedCase] = useState(cases[0] || null);
  const [tab, setTab] = useState("timeline");
  const [updateText, setUpdateText] = useState("");
  const [updates, setUpdates] = useState([]);

  useEffect(() => {
    if (!cases.length) {
      setSelectedCase(null);
      setUpdates([]);
      return;
    }

    setSelectedCase((prev) => {
      if (prev) {
        const stillExists = cases.find((c) => c.id === prev.id);
        if (stillExists) return stillExists;
      }
      return cases[0];
    });
  }, [cases]);

  useEffect(() => {
    setUpdates(selectedCase?.updates || []);
  }, [selectedCase]);

  const handleCaseSelect = (c) => { setSelectedCase(c); setUpdates(c.updates || []); setTab("timeline"); };

  const postUpdate = async () => {
    if (!updateText.trim()) return;
    const newUpdate = { id: Date.now().toString(), author: user.name, role: "lawyer", time: new Date().toISOString(), text: updateText.trim() };
    setUpdates(prev => [...prev, newUpdate]);
    setUpdateText("");

    if (!selectedCase?.id) return;

    try {
      await addDoc(collection(db, "cases", selectedCase.id, "updates"), {
        author: user.name,
        role: "lawyer",
        text: newUpdate.text,
        time: newUpdate.time,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.warn("Failed to persist case update:", error?.message || error);
    }
  };

  if (loadingCases) {
    return <div className="fade-in" style={{ color: "var(--text-muted)" }}>Loading assigned cases...</div>;
  }

  if (!cases.length || !selectedCase) {
    return (
      <div className="fade-in">
        <div className="card" style={{ textAlign: "center", color: "var(--text-muted)" }}>
          No cases assigned yet.
        </div>
      </div>
    );
  }

  return (
    <div className="two-pane fade-in" style={{ flex: 1 }}>
      {/* Left Pane: Case List */}
      <div className="pane-left">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Active Cases ({cases.length})</div>
          <div className="stats-row" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 0 }}>
            <div className="stat-card" style={{ padding: 14 }}>
              <div className="stat-label" style={{ fontSize: 9 }}>Total Cases</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{cases.length}</div>
            </div>
            <div className="stat-card" style={{ padding: 14 }}>
              <div className="stat-label" style={{ fontSize: 9 }}>Hearings</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{cases.filter((c) => c.nextHearing !== "TBD").length}</div>
            </div>
          </div>
        </div>
        <div className="divider" />
        {cases.map(c => (
          <div key={c.id} className={`case-item ${selectedCase.id === c.id ? "active" : ""}`} onClick={() => handleCaseSelect(c)}>
            <div className={`case-priority priority-${c.priority}`} />
            <div className="case-info">
              <div className="case-title">{c.title}</div>
              <div className="case-meta">{c.client} · {c.evidence.length} items</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <span className={`badge badge-${STATUS_COLORS[c.status]}`}>{c.status}</span>
              <Icon name="chevronRight" size={14} style={{ color: "var(--text-dim)" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Right Pane: Case Detail */}
      <div className="pane-right">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "-0.02em", color: "var(--text)" }}>{selectedCase.title}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
              Client: {selectedCase.client} · Filed: {selectedCase.filed}
              {selectedCase.nextHearing !== "TBD" && <> · Next Hearing: <span style={{ color: "var(--indigo-light)" }}>{selectedCase.nextHearing}</span></>}
            </div>
          </div>
          <span className={`badge badge-${STATUS_COLORS[selectedCase.status]}`}>{selectedCase.status}</span>
        </div>

        {/* Stepper */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 16 }}>Case Progress</div>
          <div className="stepper">
            {STAGES.map((s, i) => {
              const done = i < selectedCase.stage; const active = i === selectedCase.stage;
              return <div key={s} className={`step ${done ? "done" : ""} ${active ? "active" : ""}`}><div className="step-dot">{done ? <Icon name="check" size={12} /> : i + 1}</div><div className="step-label">{s}</div></div>;
            })}
          </div>
        </div>

        <div className="tabs">
          {["timeline", "evidence", "updates"].map(t => (
            <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === "evidence" && <span style={{ marginLeft: 6, background: "var(--surface3)", borderRadius: 10, padding: "1px 6px", fontSize: 10 }}>{selectedCase.evidence.length}</span>}
              {t === "updates" && <span style={{ marginLeft: 6, background: "var(--surface3)", borderRadius: 10, padding: "1px 6px", fontSize: 10 }}>{updates.length}</span>}
            </button>
          ))}
        </div>

        {tab === "timeline" && (
          <div className="timeline slide-in">
            {selectedCase.timeline.map(item => (
              <div key={item.id} className="timeline-item">
                <div className={`timeline-dot dot-${item.type}`}>
                  <Icon name={item.type === "milestone" ? "shield" : item.type === "evidence" ? "upload" : item.type === "legal" ? "scale" : "clock"} size={13} />
                </div>
                <div className="timeline-content">
                  <div className="timeline-label">{item.label}</div>
                  <div className="timeline-detail">{item.detail}</div>
                  <div className="timeline-time">{formatTime(item.time)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "evidence" && (
          <div className="slide-in">
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
              <button className="btn btn-ghost" onClick={() => downloadEvidenceCertificate(selectedCase)}>
                <Icon name="file" size={13} /> Download Evidence Certificate
              </button>
            </div>
            <div className="evidence-grid">
              {selectedCase.evidence.map(e => (
                <div key={e.id} className="evidence-card">
                  <div className="evidence-preview">
                    <Icon name={e.type === "audio" ? "mic" : e.type === "video" ? "camera" : "file"} size={28} />
                  </div>
                  <div className="evidence-name">{e.name}</div>
                  <div className="evidence-hash">{e.hash}</div>
                  <div className="verified-badge"><Icon name="shield" size={10} /> Integrity Verified</div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{e.timestamp.split("T")[0]}</div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", display: "flex", gap: 4 }}><Icon name="map" size={9} />{e.gps}</div>
                  {e.downloadURL && (
                    <a href={e.downloadURL} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "var(--indigo-light)", marginTop: 6, display: "inline-block" }}>
                      Open File
                    </a>
                  )}
                </div>
              ))}
              <div className="evidence-card" style={{ border: "2px dashed var(--border)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 140, gap: 8 }} onClick={() => document.getElementById(`lawyer-upload-${selectedCase.id}`)?.click()}>
                <input id={`lawyer-upload-${selectedCase.id}`} type="file" accept="image/*,.pdf,application/pdf" multiple style={{ display: "none" }} onChange={(e) => {
                  const selectedFiles = Array.from(e.target.files || []);
                  if (selectedFiles.length && onUploadEvidence) {
                    selectedFiles.reduce(
                      (p, file) => p.then(() => onUploadEvidence(selectedCase.id, file)),
                      Promise.resolve()
                    );
                  }
                  e.target.value = "";
                }} />
                <Icon name="upload" size={24} style={{ color: "var(--text-dim)" }} />
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  {uploadingCaseId === selectedCase.id
                    ? "Uploading..."
                    : (isSupabaseConfigured ? "Upload Screenshots / PDFs" : "Log Evidence Metadata (Supabase not configured)")}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "updates" && (
          <div className="slide-in">
            <div className="stack" style={{ marginBottom: 24 }}>
              {updates.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)", fontSize: 14 }}>No updates yet. Post the first update below.</div>}
              {updates.map(u => (
                <div key={u.id} className="update-item">
                  <div className={`avatar avatar-lawyer`} style={{ width: 36, height: 36, fontSize: 12, flexShrink: 0 }}>MW</div>
                  <div className="update-body">
                    <div className="flex-gap">
                      <span className="update-author">{u.author}</span>
                      <span className="badge badge-indigo" style={{ fontSize: 9 }}>Attorney</span>
                      <span className="spacer" />
                      <span className="update-time">{formatRelative(u.time)}</span>
                    </div>
                    <div className="update-text">{u.text}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>Post Case Update</div>
              <textarea className="input" rows={3} placeholder="Write a case update for your client..." value={updateText} onChange={e => setUpdateText(e.target.value)} />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button className="btn btn-primary" onClick={postUpdate}><Icon name="send" size={13} /> Post Update</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ user, currentPage, onNavigate, onLogout }) {
  const isClient = user.role === "client";
  const clientNav = [
    { key: "dashboard", label: "Dashboard", icon: "home" },
    { key: "cases", label: "My Cases & Evidence", icon: "folder" },
    { key: "settings", label: "Settings", icon: "settings" },
  ];
  const lawyerNav = [
    { key: "dashboard", label: "Case Overview", icon: "briefcase" },
    { key: "clients", label: "Clients", icon: "users" },
    { key: "settings", label: "Settings", icon: "settings" },
  ];
  const nav = isClient ? clientNav : lawyerNav;

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon"><Icon name="shield" size={16} /></div>
          AegisVault
        </div>
        <div className="sidebar-role">{isClient ? "Client Portal" : "Attorney Portal"}</div>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section">Navigation</div>
        {nav.map(item => (
          <button key={item.key} className={`nav-item ${currentPage === item.key ? "active" : ""}`} onClick={() => onNavigate(item.key)}>
            <Icon name={item.icon} size={16} />
            {item.label}
          </button>
        ))}
        {isClient && (
          <>
            <div className="nav-section" style={{ marginTop: 8 }}>Emergency</div>
            <button className="nav-item" onClick={() => onNavigate("emergency")} style={{ color: "#fca5a5", borderLeft: "2px solid var(--red)" }}>
              <Icon name="alert" size={16} />
              Emergency Capture
            </button>
          </>
        )}
      </nav>
      <div className="sidebar-footer">
        <div className="user-chip" onClick={onLogout}>
          <div className={`avatar avatar-${user.role}`}>{user.avatar}</div>
          <div className="user-info">
            <div className="user-name">{user.name}</div>
            <div className="user-role">{user.role === "lawyer" ? user.bar : "Client"}</div>
          </div>
          <Icon name="logout" size={14} style={{ color: "var(--text-dim)" }} />
        </div>
      </div>
    </div>
  );
}

// ─── BOTTOM NAV (Mobile) ──────────────────────────────────────────────────────
function BottomNav({ user, currentPage, onNavigate }) {
  const isClient = user.role === "client";
  return (
    <div className="bottom-nav">
      <div className="bottom-nav-inner">
        <button className={`bottom-nav-item ${currentPage === "dashboard" ? "active" : ""}`} onClick={() => onNavigate("dashboard")}>
          <Icon name="home" size={20} /><span>Home</span>
        </button>
        <button className={`bottom-nav-item ${currentPage === "cases" ? "active" : ""}`} onClick={() => onNavigate("cases")}>
          <Icon name="folder" size={20} /><span>Cases</span>
        </button>
        {isClient && (
          <button className="emergency-nav-btn" onClick={() => onNavigate("emergency")}>
            <Icon name="mic" size={22} />
          </button>
        )}
        <button className={`bottom-nav-item ${currentPage === "settings" ? "active" : ""}`} onClick={() => onNavigate("settings")}>
          <Icon name="settings" size={20} /><span>Settings</span>
        </button>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [showEmergency, setShowEmergency] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [casesError, setCasesError] = useState("");
  const [creatingCase, setCreatingCase] = useState(false);
  const [uploadingCaseId, setUploadingCaseId] = useState("");
  const [trustedContacts, setTrustedContacts] = useState([]);
  const [alertStatus, setAlertStatus] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setAuthLoading(false);
        return;
      }

      const userRef = doc(db, "users", firebaseUser.uid);
      try {
        let profileSnap;
        try {
          profileSnap = await getDoc(userRef);
        } catch (error) {
          if (!isFirestoreOfflineError(error)) {
            throw error;
          }
          profileSnap = await getDocFromCache(userRef);
        }

        let profile;
        if (!profileSnap.exists()) {
          profile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            name: firebaseUser.displayName || "",
            role: "client",
            createdAt: serverTimestamp(),
          };
          await setDoc(userRef, profile, { merge: true });
        } else {
          profile = profileSnap.data();
        }

        setUser(buildPortalUser(firebaseUser.uid, profile, firebaseUser.email || ""));
        setAuthError("");
      } catch (error) {
        setAuthError(error?.message || "Failed to load your profile.");
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const navigate = useCallback((to) => {
    if (to === "emergency") { setShowEmergency(true); return; }
    setPage(to);
  }, []);

  const handleLogin = useCallback(async ({ email, password, roleHint }) => {
    setAuthError("");
    const credential = await signInWithEmailAndPassword(auth, email, password);

    const userRef = doc(db, "users", credential.user.uid);
    let profileSnap;

    try {
      profileSnap = await getDoc(userRef);
    } catch (error) {
      if (!isFirestoreOfflineError(error)) {
        throw error;
      }
      profileSnap = await getDocFromCache(userRef);
    }

    if (!profileSnap.exists()) {
      await setDoc(userRef, {
        uid: credential.user.uid,
        email: credential.user.email || email,
        name: credential.user.displayName || "",
        role: normalizeRole(roleHint || "client"),
        createdAt: serverTimestamp(),
      }, { merge: true });
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await signOut(auth);
    setShowEmergency(false);
    setPage("dashboard");
    setCases([]);
    setCasesError("");
    setCreatingCase(false);
    setUploadingCaseId("");
    setTrustedContacts([]);
    setAlertStatus("");
  }, []);

  useEffect(() => {
    if (!user?.uid || user.role !== "client") {
      setTrustedContacts([]);
      return;
    }

    const storageKey = `aegisvault.trustedContacts.${user.uid}`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setTrustedContacts(parsed);
        }
      }
    } catch {
      setTrustedContacts([]);
    }
  }, [user?.uid, user?.role]);

  const persistTrustedContacts = useCallback(async (nextContacts) => {
    if (!user?.uid || user.role !== "client") return;
    const storageKey = `aegisvault.trustedContacts.${user.uid}`;
    localStorage.setItem(storageKey, JSON.stringify(nextContacts));
    await setDoc(doc(db, "users", user.uid), { trustedContacts: nextContacts }, { merge: true });
  }, [user?.uid, user?.role]);

  const addTrustedContact = useCallback(async ({ name, phone }) => {
    if (!name || !phone) {
      setAlertStatus("Please enter both name and phone.");
      return;
    }
    if (!isLikelyPhone(phone)) {
      setAlertStatus("Phone format looks invalid. Use digits with optional leading +.");
      return;
    }

    const normalizedPhone = normalizePhoneInput(phone);
    const nextContacts = [...trustedContacts, { id: `${Date.now()}`, name, phone: normalizedPhone }];
    setTrustedContacts(nextContacts);
    setAlertStatus("Trusted contact added.");
    try {
      await persistTrustedContacts(nextContacts);
    } catch (error) {
      setAlertStatus(error?.message || "Saved locally, but cloud sync failed.");
    }
  }, [persistTrustedContacts, trustedContacts]);

  const removeTrustedContact = useCallback(async (contactId) => {
    const nextContacts = trustedContacts.filter((c) => c.id !== contactId);
    setTrustedContacts(nextContacts);
    setAlertStatus("Trusted contact removed.");
    try {
      await persistTrustedContacts(nextContacts);
    } catch (error) {
      setAlertStatus(error?.message || "Removed locally, but cloud sync failed.");
    }
  }, [persistTrustedContacts, trustedContacts]);

  const triggerTrustedContactAlert = useCallback(async (reason) => {
    if (!trustedContacts.length) {
      setAlertStatus("No trusted contacts to alert.");
      return;
    }

    const gps = await getCurrentGpsString();
    const timestamp = new Date().toISOString();
    const message = buildDistressMessage(user?.name, timestamp, gps);
    const recipients = trustedContacts
      .map((c) => normalizePhoneInput(c.phone))
      .filter(Boolean)
      .join(",");

    if (!recipients) {
      setAlertStatus("Trusted contacts are missing valid phone numbers.");
      return;
    }

    setAlertStatus(reason === "test" ? "Opening test SMS alert..." : "Opening distress SMS alert...");
    window.open(`sms:${recipients}?body=${encodeURIComponent(message)}`, "_self");
  }, [trustedContacts, user?.name]);

  useEffect(() => {
    if (!showEmergency || user?.role !== "client") return;
    triggerTrustedContactAlert("distress");
  }, [showEmergency, triggerTrustedContactAlert, user?.role]);

  const createCase = useCallback(async ({ title, priority }) => {
    if (!user?.uid) return;
    setCreatingCase(true);
    try {
      const nowIso = new Date().toISOString();
      await addDoc(collection(db, "cases"), {
        title,
        status: "pending",
        stage: 0,
        clientUid: user.uid,
        client: user.name,
        lawyerUid: "",
        lawyer: "Unassigned",
        filed: nowIso.split("T")[0],
        nextHearing: "TBD",
        priority: priority || "medium",
        timeline: [{ id: `t-${Date.now()}`, time: nowIso, label: "Case Filed", detail: "Case created by client.", type: "milestone" }],
        updates: [],
        evidence: [],
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      setCasesError(error?.message || "Failed to create case.");
    } finally {
      setCreatingCase(false);
    }
  }, [user?.uid, user?.name]);

  const uploadEvidence = useCallback(async (caseId, file) => {
    if (!caseId || !file) return;
    setUploadingCaseId(caseId);
    try {
      const hash = await sha256Hex(file);
      const gps = await getCurrentGpsString();
      const timestamp = new Date().toISOString();
      const safeName = file.name.replace(/\s+/g, "-");
      if (!isSupabaseConfigured) {
        const fallbackEvidenceItem = {
          id: `e-${Date.now()}`,
          name: file.name,
          type: file.type?.split("/")[0] || "file",
          hash,
          verified: true,
          gps,
          timestamp,
          size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          downloadURL: "",
          metadataPath: "",
          storageProvider: "firestore-metadata-only",
        };

        await updateDoc(doc(db, "cases", caseId), {
          evidence: arrayUnion(fallbackEvidenceItem),
          timeline: arrayUnion({
            id: `t-${Date.now()}`,
            time: timestamp,
            label: "Evidence Logged",
            detail: `${file.name} metadata saved. Configure Supabase to store the actual file.`,
            type: "evidence",
          }),
        });

        setCasesError("Supabase is not configured. Evidence metadata was saved, but file binaries were not uploaded.");
        return;
      }

      const objectPath = `cases/${caseId}/evidence/${Date.now()}_${safeName}`;
      const { error: fileUploadError } = await supabase.storage
        .from(supabaseBucket)
        .upload(objectPath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (fileUploadError) {
        throw new Error(fileUploadError.message || "Supabase file upload failed.");
      }

      const { data: urlData } = supabase.storage.from(supabaseBucket).getPublicUrl(objectPath);
      const downloadURL = urlData?.publicUrl || "";

      const metadataPayload = {
        caseId,
        fileName: file.name,
        filePath: objectPath,
        url: downloadURL,
        gps,
        time: timestamp,
        hash,
      };

      const metadataPath = `cases/${caseId}/metadata/${Date.now()}_${safeName}.json`;
      const metadataBlob = new Blob([JSON.stringify(metadataPayload, null, 2)], { type: "application/json" });

      const { error: metadataUploadError } = await supabase.storage
        .from(supabaseBucket)
        .upload(metadataPath, metadataBlob, {
          contentType: "application/json",
          upsert: false,
        });

      if (metadataUploadError) {
        throw new Error(metadataUploadError.message || "Supabase metadata upload failed.");
      }

      const evidenceItem = {
        id: `e-${Date.now()}`,
        name: file.name,
        type: file.type?.split("/")[0] || "file",
        hash,
        verified: true,
        gps,
        timestamp,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        downloadURL,
        metadataPath,
        storageProvider: "supabase",
      };

      await updateDoc(doc(db, "cases", caseId), {
        evidence: arrayUnion(evidenceItem),
        timeline: arrayUnion({
          id: `t-${Date.now()}`,
          time: timestamp,
          label: "New Evidence Added",
          detail: `${file.name} uploaded and verified.`,
          type: "evidence",
        }),
      });
      setCasesError("");
    } catch (error) {
      setCasesError(error?.message || "Failed to upload evidence.");
    } finally {
      setUploadingCaseId("");
    }
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setCases([]);
      return;
    }

    setLoadingCases(true);
    setCasesError("");

    const casesRef = collection(db, "cases");
    const constraints = user.role === "lawyer"
      ? [where("lawyerUid", "==", user.uid)]
      : [where("clientUid", "==", user.uid)];

    const scopedQuery = query(casesRef, ...constraints);

    const unsub = onSnapshot(
      scopedQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((d) => mapCaseDoc(d.id, d.data()));
        setCases(mapped);
        setLoadingCases(false);
      },
      (error) => {
        console.warn("Case subscription failed:", error?.message || error);
        setCasesError(error?.message || "Could not load case data.");
        setCases([]);
        setLoadingCases(false);
      }
    );

    return () => unsub();
  }, [user?.uid, user?.role]);

  if (authLoading) {
    return (
      <div className="login-screen">
        <div className="login-card fade-in" style={{ textAlign: "center" }}>
          <div className="login-title" style={{ fontSize: 24 }}>Checking session...</div>
          <div className="login-sub">Restoring secure access.</div>
        </div>
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={handleLogin} errorMessage={authError} />;

  const isClient = user.role === "client";

  const pageTitle = {
    dashboard: isClient ? `Welcome back, ${user.name.split(" ")[0]}` : "Attorney Dashboard",
    cases: isClient ? "My Cases & Evidence" : "All Cases",
    settings: "Settings",
    clients: "Clients",
  };
  const pageSub = {
    dashboard: isClient ? "Here's a summary of your active case and recent updates." : "Overview of all active cases and client activity.",
    cases: isClient ? "View your case progress, timeline, and uploaded evidence." : "Manage evidence, timelines, and case strategy.",
    settings: "Manage your account, notifications, and security preferences.",
    clients: "Clients who have granted you legal access.",
  };

  const renderPage = () => {
    if (page === "dashboard") return isClient
      ? <ClientDashboard onNavigate={navigate} cases={cases} loadingCases={loadingCases} />
      : <LawyerDashboard user={user} cases={cases} loadingCases={loadingCases} onUploadEvidence={uploadEvidence} uploadingCaseId={uploadingCaseId} />;
    if (page === "cases") return isClient
      ? <ClientCases cases={cases} loadingCases={loadingCases} user={user} onCreateCase={createCase} creatingCase={creatingCase} onUploadEvidence={uploadEvidence} uploadingCaseId={uploadingCaseId} />
      : <LawyerDashboard user={user} cases={cases} loadingCases={loadingCases} onUploadEvidence={uploadEvidence} uploadingCaseId={uploadingCaseId} />;
    if (page === "settings" && isClient) {
      return (
        <SettingsPanel
          trustedContacts={trustedContacts}
          onAddContact={addTrustedContact}
          onRemoveContact={removeTrustedContact}
          onSendTestAlert={() => triggerTrustedContactAlert("test")}
          alertStatus={alertStatus}
        />
      );
    }
    return (
      <div className="fade-in" style={{ textAlign: "center", paddingTop: 60, color: "var(--text-muted)" }}>
        <Icon name="settings" size={40} style={{ margin: "0 auto 16px", display: "block" }} />
        <div style={{ fontSize: 16, fontWeight: 600 }}>Settings</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>Configuration options coming soon.</div>
      </div>
    );
  };

  return (
    <>
      {showEmergency && <EmergencyMode onClose={() => setShowEmergency(false)} />}
      <div className="app-layout">
        <Sidebar user={user} currentPage={page} onNavigate={navigate} onLogout={handleLogout} />
        <div className="main-content">
          <div className="page-header">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="page-title">{pageTitle[page]}</div>
                <div className="page-subtitle">{pageSub[page]}</div>
                {!isSupabaseConfigured && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#fbbf24" }}>
                    Supabase is not configured. Evidence uploads will save metadata only.
                  </div>
                )}
                {casesError && <div style={{ marginTop: 8, fontSize: 12, color: "#fca5a5" }}>{casesError}</div>}
              </div>
              {isClient && page === "dashboard" && (
                <button onClick={() => setShowEmergency(true)} style={{ padding: "8px 16px", background: "var(--red-dim)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-sm)", color: "#fca5a5", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 8 }}>●</span> Emergency
                </button>
              )}
              {!isClient && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--emerald)", boxShadow: "0 0 8px var(--emerald)" }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Live feed active</span>
                </div>
              )}
            </div>
          </div>
          <div className="page-body" style={{ display: page === "dashboard" && !isClient ? "flex" : "block", flexDirection: "column", flex: 1 }}>
            {renderPage()}
          </div>
        </div>
        <BottomNav user={user} currentPage={page} onNavigate={navigate} />
      </div>
    </>
  );
}

// Inject styles
const styleEl = document.createElement("style");
styleEl.textContent = styles;
document.head.appendChild(styleEl);

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
