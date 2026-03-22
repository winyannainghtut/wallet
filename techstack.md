# Tech Stack Overview: Wallet App

This document summarizes the technologies used in the Wallet App codebase.

## Core Framework

- **Next.js (16.2.1):** App Router, API routes, server/client components.
- **React (18.3.1):** UI foundation.
- **TypeScript (5+):** Strong typing across app and API layers.

## Backend and Data

- **PocketBase (0.26.x SDK):** Auth + database backend.
- **Backend-for-Frontend pattern:** Browser calls Next.js API routes; API routes call PocketBase.
- **Schema migration files:** `pb_migrations/*.js` (currently `1774166000_wallet_schema.js`).

## UI and Styling

- **Tailwind CSS v4** with `@tailwindcss/postcss`.
- **shadcn/ui** and headless primitives.
- **Base UI / Radix-style primitives** for accessible components.
- **lucide-react** icons.
- **cmdk** command palette.
- **react-day-picker** for calendar/date interactions.
- **clsx + tailwind-merge + tw-animate-css** for utility styling patterns.

## Utilities

- **date-fns** for date calculations and formatting.
- **xlsx** for Excel import/export.
- **uuid** for local identifier generation when needed.

## AI

- **@google/generative-ai** for AI insight/chat features.

## State and i18n

- **React Context** (`AuthContext`, `AppContext`) for app-wide state.
- **Custom i18n layer** (`src/i18n/config.ts`, `src/i18n/en.json`, `src/i18n/my.json`).

## DevOps and Deployment

- **Docker Compose** for local PocketBase runtime (`docker-compose.pb.yml`).
- **Kubernetes manifests** under `k8s/` for frontend and PocketBase deployment.
- **PocketBase bootstrap in K8s:**
  - initContainer runs migrations (`migrate up`)
  - superuser is created/updated (`superuser upsert`)
  - config is sourced from `k8s/pocketbase-bootstrap.yaml`

## Quality Tooling

- **ESLint 9** with Next.js + TypeScript configs.
- **Next.js build/type checks** via `npm run build`.
