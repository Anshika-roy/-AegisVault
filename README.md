# AegisVault

AegisVault is a litigation intelligence and secure legal operations platform built for Indian legal workflows.

It is not a generic chatbot. It is designed to feel like institutional legal software: structured dashboards, jurisdiction intelligence, BNS workflow adaptation, encrypted case communication, and role-based workspaces for lawyers and clients.

Live demo: https://aegisvault-legal-intel.vercel.app

## What It Does

- Compares High Courts using sample operational metrics such as disposal speed, injunction tendency, and jurisdiction fit.
- Maps IPC/CrPC thinking into BNS/BNSS workflow changes.
- Gives bounded legal risk assessment with explainable factors.
- Provides client-lawyer case requests, dashboards, and encrypted communication.
- Uses Supabase Row Level Security so clients and lawyers only see the data they are meant to see.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, TailwindCSS, Framer Motion |
| Backend | Supabase, PostgreSQL, Row Level Security |
| Serverless | Supabase Edge Functions |
| AI | LLaMA via Groq API |
| Security | Supabase Auth, RLS, client-side AES-GCM message encryption |
| Deployment | Vercel for frontend, Supabase for backend |
| Local Runtime | Node.js or Docker |

## Project Structure

```text
AegisVault/
  frontend/                  React app
  supabase/
    functions/               Supabase Edge Functions
    migrations/              Database schema, RLS policies, demo data
  Dockerfile                 Production container for the frontend
  docker-compose.yml         One-command Docker run
  vercel.json                Vercel build configuration
  README.md
```

## Run Locally With Node

Requirements:

- Node.js 22 or newer
- npm

Steps:

```bash
git clone https://github.com/Anshika-roy/-AegisVault.git AegisVault
cd AegisVault
cp .env.example .env
npm install --prefix frontend
npm run dev
```

Open:

```text
http://localhost:5173
```

The public Supabase anon key is safe to use in the browser, but each teammate should still copy `.env.example` to `.env` and use the current project values.

## Run Locally With Docker

Requirements:

- Docker Desktop

Steps:

```bash
git clone https://github.com/Anshika-roy/-AegisVault.git AegisVault
cd AegisVault
cp .env.example .env
docker compose up --build
```

Open:

```text
http://localhost:8080
```

Without Docker Compose:

```bash
docker build -t aegisvault .
docker run --rm -p 8080:80 aegisvault
```

## Supabase Setup

The live project already uses Supabase. For a new Supabase project:

1. Create a Supabase project.
2. Run the SQL files in `supabase/migrations/` in order.
3. Set these Edge Function secrets:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
GROQ_API_KEY
```

4. Deploy the functions:

```bash
supabase functions deploy analyze-case
supabase functions deploy bns-transposer
supabase functions deploy court-arbitrage
supabase functions deploy litigation-probability
supabase functions deploy cross-examine
```

5. Add your frontend URL to Supabase Auth redirect URLs:

```text
http://localhost:5173/auth-callback
https://your-domain.vercel.app/auth-callback
```

## Important Security Notes

- The frontend uses only the Supabase anon key.
- Service role keys must never be committed or shipped to the browser.
- Messages are encrypted client-side using AES-GCM before storage.
- RLS policies enforce request, message, notification, and dashboard visibility.
- AI responses are advisory decision support, not legal advice or guaranteed predictions.

## Demo Notes

Some analytics tables use seeded sample metrics so the hackathon demo is stable. This is intentional. The product language avoids claiming official court feeds or guaranteed predictions unless a real verified data source is connected.

## Useful Commands

```bash
npm run dev       # start Vite locally
npm run lint      # run frontend lint
npm test          # run jurisdiction reasoning regression tests
npm run build     # type-check and build
npm run start     # preview built frontend
```

## Deployment

Frontend:

- Vercel reads `vercel.json`.
- Build command: `npm run build --prefix frontend`
- Output directory: `frontend/dist`

Backend:

- Supabase migrations define tables and RLS policies.
- Supabase Edge Functions run AI and analytics workflows.

## Product Principle

AegisVault should feel calm, operational, and trustworthy. It avoids hype language and focuses on explainable litigation workflows that a lawyer, client, or technical judge can question without the system falling apart.
