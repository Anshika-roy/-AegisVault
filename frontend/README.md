# AegisVault Frontend Client

This directory contains the single-page application (SPA) client for AegisVault. It is built using React, TypeScript, and Vite, and styled with Vanilla CSS and TailwindCSS.

## Directory Structure

- **`src/components/`**: Reusable UI blocks, layout components, and modals.
  - `AuthModals.tsx`: Combined sign-in and sign-up modal handlers.
  - `Modal.tsx`: Accessible dialog wrapper.
  - `ProtectedRoute.tsx`: Router guard enforcing active Supabase sessions.
  - `Sidebar.tsx`: Persistent navigation sidebar.
- **`src/hooks/`**: Custom hooks for handling global operations.
  - `useAuth.ts`: Hook mapping Supabase Auth sessions to global state.
  - `useDashboardData.ts`: React state hooks for querying and formatting analytics.
- **`src/lib/`**: Config and client setup files.
  - `supabase.ts`: Supabase client client initialization.
  - `types.ts`: TypeScript interface definitions for database records and payloads.
  - `utils.ts`: Utility helpers for TailwindCSS merging.
- **`src/pages/`**: Main dashboard pages and analytics layouts.
  - `LandingPage.tsx`: Product marketing homepage with the preview dashboard mockup.
  - `LawyerDashboard.tsx` & `ClientDashboard.tsx`: Secure user-role workspaces.
  - `CourtArbitrage.tsx`: Panel comparing territorial High Court performance and metrics.
  - `LitigationEngine.tsx`: Interactive legal assessment panel.
  - `JudicialIntelligence.tsx`: Deep-dive data explorer for court precedents.
  - `CrossExamSimulator.tsx`: AI-assisted cross-examination prep.
  - `Chat.tsx`: End-to-end client-side encrypted messaging channel.

## Local Development

Start the development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

Build the application for production (results outputted to `dist/`):

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Security Design (Client-Side Encryption)

The messaging component (`Chat.tsx`) implements browser-native Web Crypto APIs (**AES-GCM**) to secure messages. Messages are encrypted locally using derived client-side key combinations before transmission, ensuring that the Supabase database hosting the backend never contains plain-text communication.
