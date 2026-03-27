# Dev Journey - Wallet App

## 2026-03-27

### Completed

- Added trip-level destination currency support:
  - `trips.currency`
  - `trips.exchangeRate`
- Added transaction source metadata for trip-linked expenses:
  - `transactions.sourceAmount`
  - `transactions.sourceCurrency`
  - `transactions.sourceExchangeRate`
- Updated trip create/edit UI so budgets and group funds can be managed in manual destination currency.
- Updated expense form so trip-linked expenses can be entered in destination currency and converted to app currency on save.
- Updated trip cards and settle-up views to render trip totals in destination currency with app-currency reference text.
- Updated Excel import/export and template files for trip currency round-trip support.
- Added trip participant and settlement support:
  - `trip_members`
  - `trip_settlements`
  - `transactions.paidByMemberId`
- Added fund goals:
  - `fund_goals`
  - savings/dashboard wiring
- Added forecast and projected net worth views in Reports and Calendar.
- Added manual planning and collaboration layers:
  - `accounts`
  - `households`
  - `household_members`
- Added bills center that consolidates subscriptions and recurring insurance contributions.
- Hardened household collaboration:
  - household creation now seeds the active owner membership
  - invited members can auto-bind by matching email on sign-in
  - household/member management is owner-only
  - member rows can no longer be moved across households
- Hardened account-linked validation:
  - incomes now validate account ownership like transactions
- Preserved historical trip-currency exchange rates when editing trip-linked expenses.
- Added budget duplicate protection:
  - API rejects duplicate `(user, month, category)` budgets
  - legacy duplicate rows are deduped in summaries
- Improved trip settle-up UX:
  - selectors now show names instead of raw ids
  - simplified debt wording
  - exact-cent split math to avoid rounding residue after settlement recording
- Rolled back experimental stock live pricing and kept stocks manual-only while crypto live pricing remains.
- Added PocketBase migration:
  - `1775300000_trip_currency_and_source_metadata.js`
- Added PocketBase migration:
  - `1775400000_planning_collaboration_collections.js`
- Added PocketBase migration:
  - `1775500000_fix_household_rules_and_budget_indexes.js`
- Removed budgets and liabilities from the product and backend:
  - deleted `/budgets` and `/liabilities` UI/API flows
  - removed `budgets` and `liabilities` collections from the expected final PocketBase state
  - updated Bills center to show only subscriptions and recurring insurance contributions
- Added PocketBase migration:
  - `1775600000_remove_budget_and_liability_features.js`
- Synced bootstrap ConfigMap:
  - `k8s/pocketbase-bootstrap.yaml`
- Removed the review queue and transaction-rules backend/UI slice.
- Added PocketBase migration:
  - `1775700000_remove_review_feature.js`
- Synced docs for trip currency, planning/collaboration hardening, the budgets/liabilities removal, and the review removal.

## 2026-03-26

### Completed

- **Per-user settings upgrade:**
  - Added user-selectable currency display sign while keeping currency code for FX/export logic.
  - Synced settings persistence between local bootstrap cache and backend `user_preferences`.
- **Trips shared expense upgrade:**
  - Added `Shared Friend Group` option for trip-linked expenses.
  - Group fund usage now counts only shared-group tagged trip expenses.
  - Extended Excel import/export to round-trip shared trip expense metadata.
- **AI model options refresh:**
  - Re-enabled `glm-5-turbo` as a selectable AI model alongside `glm-5` and `glm-4.7`.
- **Theme refresh:**
  - Reworked Blossom theme palette and gradients.
- **Backend/migration updates:**
  - Added migrations for trip group fields, `user_preferences.currencySign`, and `transactions.sharedGroupExpense`.
- **Documentation sync:**
  - Updated README, setup guide, PocketBase setup, tech stack, and env docs for the latest app behavior.

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
- `1774500000_savings_assets_collection.js`
- `1774600000_add_symbol_to_savings_assets.js`
- `1774700000_user_preferences_and_personal_funds.js`
- `1774800000_trip_group_fund_fields.js`
- `1774900000_add_currency_sign_to_preferences.js`
- `1775000000_add_shared_group_expense_to_transactions.js`
- `1775100000_add_recurring_insurance_fields.js`
- `1775200000_trip_settlements_and_fund_goals.js`
- `1775300000_trip_currency_and_source_metadata.js`
- `1775400000_planning_collaboration_collections.js`
- `1775500000_fix_household_rules_and_budget_indexes.js`
- `1775600000_remove_budget_and_liability_features.js`
- `1775700000_remove_review_feature.js`

## Next Practical Tasks

1. Expand Myanmar translation coverage for the newer accounts, household, and fund-goal screens.
2. Add CI coverage for migration bootstraps plus the new accounts/household routes.
3. Add end-to-end smoke tests for bills and trip settle-up flows.

---

Last updated: 2026-03-27
