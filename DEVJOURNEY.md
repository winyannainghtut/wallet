# Dev Journey - Wallet App

## 2026-03-24

### Completed

- **Settings + Data consistency updates:**
  - Strengthened Excel import path to use API-backed context actions for expenses/incomes.
  - Added import issue reporting, row-level validation, and duplicate skip behavior.
- **Savings assets and reporting updates:**
  - Extended savings assets support for `insurance`, `crypto`, and `stocks`.
  - Added live crypto valuation (quantity-based) with Coinbase ticker + USD to app-currency conversion.
  - Reflected Savings + Assets values across dashboard/reporting and AI financial context.
- **Excel export coverage upgrade:**
  - Added `Savings Assets`, `Trips`, and `Trip Summary` sheets.
  - Included custom categories from both settings and transaction data in export reference sheets.
- **AI category suggestion upgrade:**
  - Suggest Category now supports custom category proposals.
  - Auto-creates missing custom expense category from AI suggestion and pre-selects it in the form.
- **Localization and stability fixes:**
  - Fixed undefined-category label crashes by hardening category label lookups.
  - Fixed malformed Myanmar locale JSON entries causing build/runtime issues.

## 2026-03-23 (Part 2)

### Completed

- **AI Assistant Enhancements:**
  - Expanded AI context payload to include incomes, active subscriptions, and monthly savings.
  - Hardened System Prompt to strictly enforce Myanmar-language only responses and block off-topic prompt injections.
  - Added Chat History persistence using `localStorage`.
  - Added "Clear Chat" functionality.
  - Fixed scroll-lock UI bugs for a smoother conversational experience.
- **Dashboard Enhancements:**
  - Refactored `IncomeExpenseBarChart` to support multi-timeframe tabs (7D, 1M, 1Y).
  - Implemented dynamic date-bucketing for 1-month and 1-year views.
  - Added numerical labels directly onto trend bars.
  - Fixed client-side hydration issues and resilient fallback for missing data instances.

## 2026-03-23 (Part 1)

### Completed

- Added income tracking API and UI flow:
  - `/api/incomes`, `/api/incomes/[id]`
  - `/income` page
- Added savings goals API and UI flow:
  - `/api/savings-goals`, `/api/savings-goals/[id]`
  - `/savings` page goal set/edit/delete + progress
- Updated Dashboard for cross comparison:
  - monthly expense vs income
  - monthly net savings
  - expense/income ratio
- Updated Reports for weekly/monthly comparison metrics:
  - total expense
  - income
  - net savings
  - savings rate
  - expense/income ratio
- Updated Calendar to include income entries and day/month net view.
- Added PocketBase repair migration:
  - `pb_migrations/1774301000_ensure_income_savings_collections.js`
- Updated K8s migration ConfigMap:
  - `k8s/pocketbase-bootstrap.yaml`
- Updated documentation set:
  - `README.md`
  - `docs/POCKETBASE.md`
  - `docs/SETUP-GUIDE.md`
  - `techstack.md`

## 2026-03-22

### Completed

- Migrated app data flow to PocketBase API routes.
- Implemented authentication-first routing (`/login` required by default).
- Removed app-level password protection flow.
- Added API endpoints for trips and subscriptions:
  - `/api/trips`, `/api/trips/[id]`
  - `/api/subscriptions`, `/api/subscriptions/[id]`
- Updated `AppContext` to use API-backed persistence for:
  - expenses
  - trips
  - subscriptions
- Added PocketBase schema migration:
  - `pb_migrations/1774166000_wallet_schema.js`
- Added Kubernetes bootstrap automation:
  - schema auto-apply via initContainer
  - superuser auto upsert via secret values
- Improved `/api/auth/login` error handling:
  - clearer invalid credential response
  - explicit message when PocketBase superuser credentials are used in app login

## Current Architecture

Browser -> Next.js API routes -> PocketBase

- Auth in HTTP-only cookie (`pb_auth`)
- PocketBase collections managed through migration files
- K8s startup is idempotent (`migrate up` + `superuser upsert`)

## Current Migration Set

- `1774166000_wallet_schema.js`
- `1774300000_income_savings_collections.js`
- `1774301000_ensure_income_savings_collections.js`

## Next Practical Tasks

1. Add Myanmar translation coverage for newly added report/dashboard/savings labels.
2. Add CI check to validate migration applies on a clean PocketBase data dir.
3. Add end-to-end smoke test for login -> add income -> set goal -> report/calendar comparison.

---

Last updated: 2026-03-24
