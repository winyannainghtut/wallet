# Tech Stack Overview: Wallet App

This document summarizes the current technologies used in the Wallet App codebase.

## Core Framework

- **Next.js (16.2.1):** App Router, API route handlers, server/client components.
- **React (18.3.1):** UI foundation.
- **TypeScript (5+):** Type-safe app and API layers.

## Backend and Data

- **PocketBase SDK (0.26.x):** Auth + database backend.
- **Backend-for-Frontend pattern:** Browser -> Next.js API routes -> PocketBase.
- **Schema migration files:**
  - `pb_migrations/1774166000_wallet_schema.js`
  - `pb_migrations/1774300000_income_savings_collections.js`
  - `pb_migrations/1774301000_ensure_income_savings_collections.js`
  - `pb_migrations/1774400000_update_income_category.js`
  - `pb_migrations/1774500000_savings_assets_collection.js`
  - `pb_migrations/1774600000_add_symbol_to_savings_assets.js`
  - `pb_migrations/1774700000_user_preferences_and_personal_funds.js`
  - `pb_migrations/1774800000_trip_group_fund_fields.js`
  - `pb_migrations/1774900000_add_currency_sign_to_preferences.js`
  - `pb_migrations/1775000000_add_shared_group_expense_to_transactions.js`
  - `pb_migrations/1775100000_add_recurring_insurance_fields.js`
  - `pb_migrations/1775200000_trip_settlements_and_fund_goals.js`
- **Main collections:**
  - `users`
  - `transactions`
  - `incomes`
  - `savings_goals`
  - `savings_assets`
  - `user_preferences`
  - `trips`
  - `trip_members`
  - `trip_settlements`
  - `fund_goals`
  - `subscriptions`

## Product Data Domains

- **Expenses**
- **Income**
- **Savings goals**
- **Savings assets (`insurance`, `crypto`, `stocks`, `personal_funds`)** with live ticker pricing for crypto and manual stock values
- **Trips** with optional shared friend-group pooled spend metadata
- **Trip members and settle-up records** for payer-aware group trip accounting
- **Subscriptions (recurring cost modeled into reports/calendar)**
- **Fund goals** linked to trips, savings assets, and monthly savings progress
- **Cashflow forecast / projected net worth** derived from expenses, incomes, subscriptions, and recurring insurance contributions

## UI and Styling

- **Tailwind CSS v4** with `@tailwindcss/postcss`.
- **shadcn/ui** + accessible headless primitives.
- **@base-ui/react** for dialogs and UI primitives.
- **lucide-react** icon system.
- **cmdk** command palette.
- **react-day-picker** for date/calendar UI.
- **clsx + tailwind-merge + tw-animate-css** for styling ergonomics.

## Utilities

- **date-fns** for date calculations and formatting.
- **xlsx** for Excel import/export.
- **Coinbase Advanced Trade WebSocket** for live crypto pricing.
- **uuid** for local identifier generation where needed.
- **Next.js middleware** for auth-first route protection.

## AI

- **Z.AI GLM** via OpenAI-compatible HTTP endpoint.
- **Server-side API key mapping** (per-user keys from env/Kubernetes secrets).
- **Client setting:** model selection only (`glm-5`, `glm-5-turbo`, `glm-4.7`).

## State and i18n

- **React Context:**
  - `AuthContext`
  - `AppContext`
- **PocketBase-backed user preferences:**
  - `user_preferences` stores app settings, including `currencySign`, theme, AI model, custom categories, and AI chat history per authenticated user
  - client keeps a local cache only for fast bootstrap/theme hydration
- **API-backed domain hooks:**
  - `useSavingsAssetsPortfolio`
  - `useFundGoals`
- **Custom i18n layer:**
  - `src/i18n/config.ts`
  - `src/i18n/en.json`
  - `src/i18n/my.json`

## DevOps and Deployment

- **Docker Compose** for local PocketBase runtime (`docker-compose.pb.yml`).
- **Kubernetes manifests** under `k8s/` for frontend and PocketBase.
- **PocketBase bootstrap in K8s:**
  - initContainer runs `migrate up`
  - initContainer runs `superuser upsert`
  - migration payload comes from `k8s/pocketbase-bootstrap.yaml`
- **GitHub Actions** workflow to build/push image to Docker Hub.
- **CI gates** for `npm run lint` and `npm run build` before image publish.

## Quality Tooling

- **ESLint 9** with Next.js + TypeScript rules.
- **Next.js build/type checks** via `npm run build`.
