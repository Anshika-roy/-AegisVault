# AegisVault 🛡️⚖️

<div align="center">
  <p><strong>Secure Litigation Intelligence & Operations Platform for Indian Legal Workflows</strong></p>
  
  <a href="https://aegisvault-liard.vercel.app/" target="_blank">
    <img src="https://img.shields.io/badge/Launch%20AegisVault%20🚀-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Launch Web App" height="42" />
  </a>
  
  <br/><br/>
  
  <img src="https://img.shields.io/badge/Status-Production%20Ready-31C48D?style=flat-square" />
  <img src="https://img.shields.io/badge/Stack-React%20%7C%20Supabase%20%7C%20TypeScript-4F46E5?style=flat-square" />
  <img src="https://img.shields.io/badge/Security-AES--256--GCM%20E2EE-10B981?style=flat-square" />
  <img src="https://img.shields.io/badge/Build-Passing-brightgreen?style=flat-square" />
</div>

---

<p align="center">
  <img src="frontend/public/dashboard-preview.png" alt="AegisVault Dashboard Mockup" width="85%" style="border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);" />
</p>

AegisVault transitions legal operations from chaotic, unsecure communication channels into an institutional, security-first digital workspace. Built for counsel and clients to navigate legal reasoning, document analysis, and secure case operations seamlessly.

---

## 🏛️ Key System Modules

### 1. 🔍 Legally Grounded Jurisdiction Intelligence
Ensures precise jurisdictional advice instead of vague recommendation algorithms:
*   **Statutory Mapping**: Filters filings to correct territorial High Courts using case parameters.
*   **Section 142(2)(a) Compliance**: Direct evaluation of Negotiable Instruments Act standards, anchoring cheque bounce matters to the payee's bank branch.
*   **Calibration & Refusal**: Calculates certainty scores and declines to suggest forums when factual information is ambiguous.

### 2. 🔐 Zero-Trust Case Security & E2EE
Attorney-client privilege is secured using zero-knowledge client-side encryption:
*   **Client-Side Cryptography**: Encrypts messages directly in the browser via **AES-256-GCM** prior to network transmission.
*   **User-Configured Passphrases**: Keys are derived locally on-device using PBKDF2 with custom case passwords and a dynamic salt.
*   **Row-Level Security (RLS)**: PostgreSQL tables are locked down with policies matching `auth.uid()` against profile assignments.

### 3. 🧠 IPC-to-BNS Transposition
Smoothly transposes traditional Indian Penal Code (IPC) references into Bharatiya Nyaya Sanhita (BNS) workflow changes, displaying semantic shifts, precedent risks, and process updates.

---

## ⚙️ Architecture & Data Flow

```mermaid
graph TD
    User([Counsel / Client]) -->|Vite + React App| FE[Frontend Client]
    FE -->|Supabase Auth| Auth[Auth Service]
    FE -->|AES-GCM Local Encryption/Decryption| FE
    FE -->|PostgreSQL Queries| DB[(Supabase DB)]
    DB -->|Enforces| RLS[Row Level Security]
    FE -->|REST API Calls| Edge[Supabase Edge Functions]
    Edge -->|Deno Runtime| AI[AI Reasoning Engines]
    AI -->|LLaMA Inference| Groq[Groq API]
```

---

## 💻 Tech Stack Highlights

*   **Frontend**: React 19, TypeScript, Vite, TailwindCSS, Framer Motion
*   **Backend & Security**: Supabase Auth, PostgreSQL DB, Row-Level Security
*   **Serverless**: Supabase Edge Functions (Deno runtime)
*   **AI Engine**: LLaMA models via Groq API
*   **Testing**: Node.js Native Test Runner (`node --test`)

---

## 📂 Project Structure

```text
AegisVault/
├── .github/workflows/    # CI/CD pipelines
├── frontend/             # React single-page application (Vite)
│   ├── src/
│   │   ├── components/   # Reusable UI elements (auth, modal, sidebar)
│   │   ├── hooks/        # Auth and data retrieval hooks
│   │   ├── lib/          # Supabase client config & types
│   │   └── pages/        # Main route dashboards and simulator views
├── supabase/
│   ├── functions/        # Serverless Deno Edge Functions
│   └── migrations/       # PostgreSQL DB schema, triggers, and demo seeds
├── tests/                # Regression tests for reasoning engines
├── Dockerfile            # Container definition for frontend build & host
├── vercel.json           # Vercel deployment settings
└── docker-compose.yml    # Single-command local dev environment spin-up
```

---

## 🚀 Local Setup & Development

### 1. Installation
Clone the repository and install the client dependencies:
```bash
git clone https://github.com/Anshika-roy/-AegisVault.git AegisVault
cd AegisVault
npm install --prefix frontend
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your Supabase variables:
```bash
cp .env.example .env
```
Provide:
*   `VITE_SUPABASE_URL`
*   `VITE_SUPABASE_ANON_KEY`

### 3. Run Development Server
```bash
npm run dev
```
Open **`http://localhost:5173`** to access the application.

### 4. Running Regression Tests
Verify reasoning model and scoring metrics offline:
```bash
npm test
```

---

## 🛡️ Security Audit & Policies

*   **Zero Server Plaintext**: Messages are encrypted via client keys and never stored in plain-text on Supabase.
*   **Granular RLS**: Clients can only query rows where `client_id = auth.uid()`, and lawyers where `assigned_lawyer_id = auth.uid()`.
