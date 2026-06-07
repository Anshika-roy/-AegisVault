# AegisVault

<div align="center">
  <p><strong>Enterprise Litigation Intelligence & Secure Operations Platform</strong></p>
  
  <a href="https://aegisvault-liard.vercel.app/" style="text-decoration: none;">
    <img src="https://img.shields.io/badge/Launch%20Platform-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Launch Application" />
  </a>
  &nbsp;
  <a href="https://github.com/Anshika-roy/-AegisVault/blob/main/LICENSE" style="text-decoration: none;">
    <img src="https://img.shields.io/badge/License-MIT-555555?style=for-the-badge" alt="License" />
  </a>
  
  <br/><br/>
  
  <img src="https://img.shields.io/badge/Status-Production%20Ready-2E7D32?style=flat-square" />
  <img src="https://img.shields.io/badge/Stack-React%20%7C%20Supabase%20%7C%20TypeScript-1565C0?style=flat-square" />
  <img src="https://img.shields.io/badge/Security-AES--256--GCM%20E2EE-37474F?style=flat-square" />
  <img src="https://img.shields.io/badge/CI%2FCD-Passing-2E7D32?style=flat-square" />
</div>

---

<p align="center">
  <img src="frontend/public/dashboard-preview.png" alt="AegisVault Dashboard" width="85%" style="border-radius: 6px; border: 1px solid #222;" />
</p>

AegisVault transitions legal proceedings from fragmented email threads into a centralized, security-first digital workspace. The platform empowers legal counsel and corporate clients with advanced litigation intelligence, statutory analytics, and zero-knowledge encrypted communications.

---

## 🏛️ System Overview & Core Capabilities

### 1. B2B Case Workspaces
- **Counsel Dashboard**: Real-time litigation overview, caseload analytics, case request evaluation, and centralized client directory.
- **Client Workspace**: Straightforward interface to request legal representation, upload matter summaries, and track matter status.

### 2. Legal Grounding & Jurisdiction Intelligence
Unlike generic chat models, AegisVault evaluates litigation parameters against real Indian statutory anchors:
- **Negotiable Instruments Act (Sec. 142(2)(a))**: Automatically aligns cheque bounce matters to the payee's home bank branch.
- **Territorial Jurisdictions**: Anchors cases directly to the correct High Courts based on physical location and cause-of-action parameters.
- **Certainty Calibration**: refusal parameters block recommendation outputs when factual context is insufficient, preventing hallucinations.

### 3. Client-Side End-to-End Encryption
To safeguard attorney-client privilege:
- **AES-256-GCM Cryptography**: Chat messages are encrypted client-side in the browser before being written to the database.
- **PBKDF2 Key Derivation**: Encryption keys are derived locally using user-defined case passwords and a dynamic salt.
- **Row-Level Security (RLS)**: PostgreSQL tables are locked down with policies matching `auth.uid()` against profile assignments.

### 4. IPC-to-BNS Transposition
Adapts traditional Indian Penal Code (IPC) and Code of Criminal Procedure (CrPC) sections into Bharatiya Nyaya Sanhita (BNS) workflow changes, displaying semantic shifts, precedent risks, and process updates.

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

## 💻 Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS, Framer Motion | User interface, client-side encryption, reactive dashboard |
| **Backend & Database** | Supabase, PostgreSQL | User profile mapping, relational schema storage, and Auth |
| **Serverless runtime** | Supabase Edge Functions (Deno) | Serverless execution of AI analytical models |
| **AI Processing** | LLaMA via Groq API | High-speed semantic matching and legal transposition |
| **Validation** | Node.js Test Runner | Regression testing suite for jurisdiction and risk engines |

---

## 📂 Project Structure

```text
AegisVault/
├── .github/
│   ├── workflows/        # CI/CD pipelines
│   └── pull_request_template.md
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
├── LICENSE               # MIT License
├── CONTRIBUTING.md       # Contribution guidelines
├── Dockerfile            # Container definition for frontend build & host
├── vercel.json           # Vercel deployment settings
└── docker-compose.yml    # Single-command local dev environment spin-up
```

---

## 🚀 Local Setup & Installation

### 1. Clone & Dependencies
Clone the repository and install client modules:
```bash
git clone https://github.com/Anshika-roy/-AegisVault.git AegisVault
cd AegisVault
npm install --prefix frontend
```

### 2. Environment Configuration
Create a local `.env` file from the example template:
```bash
cp .env.example .env
```
Provide the following credentials:
*   `VITE_SUPABASE_URL`: Your Supabase project URL.
*   `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous client key.

### 3. Start Development Server
```bash
npm run dev
```
Open **`http://localhost:5173`** to access the local application.

### 4. Running Regression Tests
Verify reasoning calculations and scoring weights:
```bash
npm test
```

---

## 🛡️ Security Audit & Policies

*   **Zero Server Plaintext**: Messages are encrypted via client keys and never stored in plain-text on Supabase.
*   **Granular RLS**: Clients can only query rows where `client_id = auth.uid()`, and lawyers where `assigned_lawyer_id = auth.uid()`.
