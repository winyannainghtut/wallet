# Wallet App Setup Guide

This guide covers local setup and Kubernetes deployment with automated PocketBase bootstrap.

## Contents

1. Prerequisites
2. Local Setup
3. Verify Core Flows
4. Kubernetes Setup
5. Troubleshooting

## 1) Prerequisites

Install:

- Docker Desktop
- Node.js 18+
- Git
- `kubectl` (for Kubernetes deployments)

## 2) Local Setup

### 2.1 Clone and install

```bash
git clone https://github.com/winyannainghtut/wallet-app.git
cd wallet-app
npm install
```

### 2.2 Start PocketBase

```bash
docker-compose -f docker-compose.pb.yml up -d
```

### 2.3 Bootstrap PocketBase schema + superuser

Run once for fresh `pb_data`.

Bash:

```bash
docker run --rm --entrypoint /bin/sh -v "$(pwd):/work" ghcr.io/muchobien/pocketbase@sha256:244e8028be1fc9a9ab3649e746c248f40dd0cf852f7cdc8b12e17922347f52cf -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up && pocketbase --dir=/work/pb_data superuser upsert admin@wallet.local change-me-strong-password"
```

PowerShell:

```powershell
docker run --rm --entrypoint /bin/sh -v "${pwd}:/work" ghcr.io/muchobien/pocketbase@sha256:244e8028be1fc9a9ab3649e746c248f40dd0cf852f7cdc8b12e17922347f52cf -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up && pocketbase --dir=/work/pb_data superuser upsert admin@wallet.local change-me-strong-password"
```

Restart local PocketBase:

```bash
docker restart wallet-pocketbase
```

Important:

- Superuser is only for PocketBase Admin (`http://localhost:8090/_/`).
- App login uses `users` collection accounts.

### 2.4 Start Next.js app

```bash
npm run dev
```

Open:

- App: `http://localhost:3000`
- PocketBase Admin: `http://localhost:8090/_/`

### 2.5 Registration policy (internal usage)

In `.env.local`:

```env
AUTH_REGISTRATION_ENABLED=false
# AUTH_ALLOWED_EMAILS=alice@company.com,bob@company.com
# AUTH_ALLOWED_DOMAINS=company.com
```

If registration is disabled, create users manually from PocketBase Admin (`users` collection).

### 2.6 AI keys (server-side only)

In `.env.local`:

```env
AI_DEFAULT_MODEL=glm-5
ZAI_OPENAI_BASE_URL=https://api.z.ai/api/coding/paas/v4
ZAI_API_KEYS_JSON={"admin@wallet.local":"sk-xxx","finance@wallet.local":"sk-yyy"}
# optional fallback:
# ZAI_API_KEY=sk-fallback
```

Settings page is model-only (no browser API key field).
Supported model choices: `glm-5`, `glm-5-turbo`, `glm-4.7`.

## 3) Verify Core Flows

### 3.1 Auth

1. Open `http://localhost:3000`.
2. Confirm redirect to `/login`.
3. Login with a valid app user.

### 3.2 Core data

1. Add expense from `/add`.
2. Add income from `/income`.
3. Add subscription from `/subscriptions`.
4. Add savings goal from `/savings`.
5. Open `/settings` and change currency sign display.
6. Verify:
   - Dashboard/Reports show expense vs income vs net savings.
   - Calendar shows expense and income day-level breakdown.
   - Amount labels use your selected currency sign while FX/export still use the currency code.

### 3.3 Accounts + bills

1. Open `/accounts` and add:
   - one bank account
   - one credit card account
2. Add one expense and one income linked to those accounts.
3. Open `/subscriptions` and add one recurring subscription.
4. Open `/savings` and add one insurance asset with recurring monthly contribution + start date.
5. Open `/bills`.
6. Verify:
   - accounts are selectable in expense and income forms
   - bills center combines subscription renewals and recurring insurance contributions
   - recurring insurance entries appear with the saved monthly cadence and start date

### 3.4 Savings assets + live market data

1. Open `/savings`.
2. Add one insurance asset and one personal saving funds asset with manual value.
3. Add one crypto asset using quantity input and a symbol (for example `BTC` or `BTC-USD`).
4. Add one stocks asset using manual value entry.
5. Verify:
   - Crypto value updates from live Coinbase ticker feed.
   - Stock assets stay as manual values.
   - USD market price is converted to app currency via `/api/market/fx` (for example USD->SGD).
   - Savings + Assets values appear in dashboard/reporting summaries.
- Savings page shows the market live-feed banner only for crypto assets.

### 3.5 Trips + shared friend group expenses

1. Open `/trips` and create a trip with optional `Destination Currency`, `Exchange Rate`, `Group Name`, `Total Travelers`, and `Group Fund`.
2. Open `/add`, select that trip, and choose `Trip Expense Scope`.
3. Save one `Personal` trip expense and one `Shared Friend Group` trip expense.
4. Verify:
   - Trip card shows total trip spend separately from shared group spend.
   - If destination currency is configured, budget/group fund/trip spend display in that currency with app-currency reference text.
- Group fund usage is based on `Shared Friend Group` expenses only.
- History list shows a `Shared Friend Group` badge for shared trip expenses.

### 3.6 Trips settle-up

1. Open the same trip in `/trips`.
2. Add at least two trip members.
3. Record one shared trip expense and select which member paid it.
4. Verify:
   - Trip page shows member balances.
   - Settlement suggestions appear as simplified debt payments when one member owes another.
   - Saving a settlement record updates the outstanding balance summary.

### 3.7 Fund goals

1. Open `/savings`.
2. Create a fund goal such as `Emergency Fund` or `Japan Trip`.
3. Link one or more savings assets and optionally set monthly contribution assumptions.
4. Verify:
   - Goal card shows target amount, linked asset value, and projected completion status.
   - Dashboard shows active fund goals.

### 3.9 Household collaboration

1. Open `/household`.
2. Create one household with a base currency.
3. Add at least one member.
4. Verify:
   - household list loads
   - creator is seeded automatically as the active owner member
   - owner can add members, but non-owner members cannot manage membership
   - invited member rows save by email and auto-bind to the matching signed-in user
   - members are grouped under the correct household

### 3.10 Cashflow forecast + projected net worth

1. Open `/reports` and switch to `Forecast`.
2. Open `/calendar` and inspect the forecast panel.
3. Verify:
   - Next 30-day income, outflows, savings transfers, and net values are shown.
   - Upcoming scheduled cashflow entries are listed.
   - 6-month projected net worth reflects tracked assets plus forecasted cashflow.

### 3.11 AI suggest category (auto custom category create)

1. Open `/add` and enter a description that does not fit built-in categories.
2. Click `Suggest Category`.
3. Verify:
   - AI returns either a built-in category or a custom category candidate.
   - When custom is returned, app auto-creates expense custom category and selects it.

### 3.12 Excel import/export

1. Open `/settings` -> `Excel`.
2. Download template (`wallet_import_template.xlsx`) and inspect `Expenses`, `Incomes`, and `Trips` sheets.
3. Import an Excel file with mixed valid/invalid rows across expenses, incomes, and trips.
4. Verify:
   - Valid rows are imported through API-backed actions.
   - Duplicate rows in the same file are skipped.
   - Settings page shows top import warnings.
   - Expenses sheet accepts optional `Shared Friend Group`, `Source Amount`, `Source Currency`, and `Source Exchange Rate` columns for trip-linked shared spend in destination currency.
   - Trips are imported before expenses so `Trip ID` references can be remapped safely.
5. Export data and verify workbook contains:
   - `Summary`
   - `Expenses`
   - `Incomes`
   - `Savings Assets`
   - `Trips`
   - `Trip Summary`
   - `Expense Categories`
   - `Income Categories`
6. Verify exported trip workbook details:
   - `Expenses` includes `Trip ID`, `Shared Friend Group`, `Source Amount`, `Source Currency`, and `Source Exchange Rate`
   - `Trips` includes `Currency` and `Exchange Rate`
   - `Trip Summary` includes trip-currency totals, app-currency reference totals, `Shared Group Expense`, `Shared Group Transactions`, `Group Fund Left`, and `Per Person Shared Spend`

### 3.13 Collection bootstrap check

Expected collections:

- `users`
- `transactions`
- `incomes`
- `savings_goals`
- `savings_assets`
- `user_preferences`
- `accounts`
- `trips`
- `trip_members`
- `trip_settlements`
- `fund_goals`
- `households`
- `household_members`
- `subscriptions`

Migration files:

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
- `pb_migrations/1775300000_trip_currency_and_source_metadata.js`
- `pb_migrations/1775400000_planning_collaboration_collections.js`
- `pb_migrations/1775500000_fix_household_rules_and_budget_indexes.js`
- `pb_migrations/1775600000_remove_budget_and_liability_features.js`
- `pb_migrations/1775700000_remove_review_feature.js`

## 4) Kubernetes Setup

### 4.1 Create/update bootstrap secret

```bash
kubectl -n wallet-app create secret generic pocketbase-bootstrap --from-literal=PB_SUPERUSER_EMAIL='admin@wallet.local' --from-literal=PB_SUPERUSER_PASSWORD='replace-with-strong-password' --dry-run=client -o yaml | kubectl apply -f -
```

Create/update AI secret:

```bash
kubectl -n wallet-app create secret generic wallet-ai-secrets --from-literal=ZAI_API_KEYS_JSON='{"admin@wallet.local":"sk-xxx"}' --dry-run=client -o yaml | kubectl apply -f -
```

### 4.2 Apply manifests

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/pocketbase-bootstrap.yaml
kubectl apply -f k8s/pocketbase-deployment.yaml
kubectl apply -f k8s/pocketbase-service.yaml
kubectl apply -f k8s/deployment.yaml
```

Patch the frontend deployment to the immutable application image you want to run:

```bash
kubectl -n wallet-app set image deployment/wallet-frontend wallet-app=winyannainghtut/wallet-app:sha-<commit>
kubectl rollout status deployment/wallet-frontend -n wallet-app
```

### 4.3 Verify bootstrap logs

```bash
kubectl logs -n wallet-app deployment/pocketbase -c pocketbase-bootstrap --tail=200
```

You should see migration and superuser upsert output.

For an incremental release that only changes PocketBase migrations plus the frontend image:

```bash
kubectl apply -f k8s/pocketbase-bootstrap.yaml
kubectl rollout restart deployment/pocketbase -n wallet-app
kubectl rollout status deployment/pocketbase -n wallet-app
kubectl logs -n wallet-app deployment/pocketbase -c pocketbase-bootstrap --tail=200
kubectl -n wallet-app set image deployment/wallet-frontend wallet-app=winyannainghtut/wallet-app:sha-<commit>
kubectl rollout status deployment/wallet-frontend -n wallet-app
```

## 5) Troubleshooting

### "Savings goals collection is missing"

1. Re-apply migration config and restart PocketBase:

```bash
kubectl apply -f k8s/pocketbase-bootstrap.yaml
kubectl rollout restart deployment/pocketbase -n wallet-app
kubectl logs -n wallet-app deployment/pocketbase -c pocketbase-bootstrap --tail=200
```

2. Confirm app `POCKETBASE_URL` points to that same PocketBase instance.
3. Confirm `incomes`, `savings_goals`, and `savings_assets` exist in PocketBase Admin.

### Household members cannot see or manage the expected household

1. Confirm the latest planning/collaboration migrations are applied:
   - `1775400000_planning_collaboration_collections.js`
   - `1775500000_fix_household_rules_and_budget_indexes.js`
2. Re-apply `k8s/pocketbase-bootstrap.yaml` and restart PocketBase.
3. In PocketBase Admin, verify:
   - `households` and `household_members` collections exist
   - household list rules are membership-based for reads
   - household/member create, update, and delete rules are owner-only
   - invited member rows store `email` and can populate `userId` after matching sign-in

### Legacy budgets or liabilities still appear

1. Confirm the destructive cleanup migration is applied:
   - `1775600000_remove_budget_and_liability_features.js`
2. Re-apply `k8s/pocketbase-bootstrap.yaml` and restart PocketBase.
3. In PocketBase Admin, verify `budgets` and `liabilities` no longer exist.

### App API unauthorized

- Re-login at `/login`.
- Confirm `/api/auth/me` returns authenticated user.

### PocketBase superuser login fails

- Recreate `pocketbase-bootstrap` secret with correct values.
- Restart PocketBase deployment.

### Reset local PocketBase data

```bash
docker-compose -f docker-compose.pb.yml down
rm -rf pb_data
docker-compose -f docker-compose.pb.yml up -d
# rerun section 2.3
```
