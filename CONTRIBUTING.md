# Contributing to AegisVault

Thank you for contributing to AegisVault! To maintain a professional, clean, and highly secure codebase, please adhere to the following development guidelines.

---

## 🛠️ Development Setup

1. **Prerequisites**: Ensure you have Node.js (v22+) and the Supabase CLI installed locally.
2. **Clone and Install**:
   ```bash
   git clone https://github.com/Anshika-roy/-AegisVault.git
   cd AegisVault
   npm install --prefix frontend
   ```
3. **Local Variables**: Create a local `.env` file from `.env.example` and set your credentials.

---

## 💾 Database Migrations

We manage our database schema directly using PostgreSQL migrations. 

- **Do not modify production schemas directly**. 
- Write new migration SQL files under `supabase/migrations/` using incremental timestamps.
- Ensure all tables have Row-Level Security (RLS) enabled. Every SELECT/INSERT/UPDATE query must be restricted based on security credentials or `auth.uid()`.

---

## 🧪 Coding Standards & Linting

We enforce strict TypeScript typing and linting using ESLint.

- Run the linter locally before pushing:
  ```bash
  npm run lint
  ```
- Do not use `any` types; define interface parameters in `frontend/src/lib/types.ts`.
- Keep components focused, modular, and reusable. Avoid monolithic layouts.

---

## 🛡️ Security Protocol

AegisVault handles sensitive legal and client data. Security is our top priority:

*   **No Raw Secrets**: Never hardcode API keys, service roles, or database passwords in the frontend client or Git-tracked configuration files.
*   **Client-Side Encryption**: Message communications must be encrypted using client-side keys via AES-GCM before database submission.

---

## 📋 Git Workflow & Commits

We follow semantic commit message guidelines to ensure our history is readable:

*   `feat: ...` for new features
*   `fix: ...` for bug fixes
*   `docs: ...` for documentation updates
*   `chore: ...` for configuration or build updates
*   `test: ...` for adding or updating tests

To submit changes:
1. Create a feature branch: `git checkout -b feat/your-feature-name`.
2. Commit your changes semantic-style.
3. Push and submit a Pull Request using our [PR Template](.github/pull_request_template.md).
