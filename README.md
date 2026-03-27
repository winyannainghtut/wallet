# Wallet App

Wallet App is a Next.js 16 personal finance system with PocketBase backend, authentication, trips, budgets, liabilities, accounts, review workflows, household collaboration, subscriptions, savings goals, reports, calendar planning, and AI insights.

## Key Features

- Authentication-first flow (`/login` required before using the app)
- Expense tracking (categories, history, reports)
- Income tracking
- Savings page with monthly savings goal CRUD
- Savings assets (insurance, crypto, stocks, personal saving funds) with live crypto market feeds and manual stock values
- Crypto assets support quantity input and live conversion to app currency (for example SGD)
- Stock assets use manual value entry
- Manual accounts layer for cash, bank, credit card, e-wallet, investment, and other balances
- Liabilities tracking with payoff projection, minimum-payment planning, and due-date visibility
- Category budgets with monthly limits, rollovers, and month-by-month comparisons
- Transaction review queue with tags, merchant cleanup, account assignment, and reusable transaction rules
- Household workspaces with member roles and shared base currency
- Bills center that combines subscriptions, liabilities, and recurring insurance contributions
- Trips and subscriptions persisted in PocketBase
- Trip plans support shared friend-group setup, pooled group fund tracking, and per-expense `Shared Friend Group` tagging
- Trip plans now support participant tracking, payer-aware shared expenses, settle-up balances, manual settlement records, and simplified debt suggestions
- Trips can now store a manual destination currency + exchange rate so trip budgets, group funds, and trip-linked expense entry use that currency
- Fund goals let users link savings assets, trip targets, and monthly savings toward named milestones
- Reports and calendar now include cashflow forecasting and projected net worth views
- User settings support custom currency display sign separate from the currency code used for FX/export
- AI-assisted category suggestion for expenses with optional auto-create custom category flow
- Excel import with validation and duplicate detection for expenses, incomes, and trips
- Excel export with unified workbook for expenses, incomes, savings assets, trips, and category references
- Dashboard/Reports/Calendar cross comparison for:
  - expense
  - income
  - net savings
- English/Myanmar language support
- AI assistant with Z.AI GLM (server-side key management)
  - Selectable models: `glm-5`, `glm-5-turbo`, `glm-4.7`
  - Understands full financial context (expenses, incomes, savings, subscriptions)
  - Strict domain guarding (finance only) and forced Myanmar language output
  - Persistent chat history across sessions
- Multi-timeframe trend analytics (7 Days, 1 Month, 1 Year)
- Kubernetes manifests for frontend + PocketBase bootstrap

## Architecture

Browser -> Next.js App Router + API routes -> PocketBase

- Browser never writes directly to PocketBase collections
- Auth and data operations are handled via `src/app/api/*`
- PocketBase auth cookie: `pb_auth`

### API Routes

Auth:
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/auth/register`
- `/api/auth/register-policy`

Data:
- `/api/transactions`
- `/api/transactions/[id]`
- `/api/transactions/review`
- `/api/transactions/review/[id]`
- `/api/accounts`
- `/api/accounts/[id]`
- `/api/budgets`
- `/api/budgets/[id]`
- `/api/incomes`
- `/api/incomes/[id]`
- `/api/liabilities`
- `/api/liabilities/[id]`
- `/api/savings-goals`
- `/api/savings-goals/[id]`
- `/api/savings-assets`
- `/api/savings-assets/[id]`
- `/api/market/fx`
- `/api/preferences`
- `/api/fund-goals`
- `/api/fund-goals/[id]`
- `/api/trips`
- `/api/trips/[id]`
- `/api/trip-members`
- `/api/trip-members/[id]`
- `/api/trip-settlements`
- `/api/trip-settlements/[id]`
- `/api/subscriptions`
- `/api/subscriptions/[id]`
- `/api/households`
- `/api/households/[id]`
- `/api/household-members`
- `/api/household-members/[id]`
- `/api/transaction-rules`
- `/api/transaction-rules/[id]`
- `/api/ai`

### Excel Data Tools

Import:
- Supports optional `Expenses`, `Incomes`, and `Trips` sheets
- Accepted headers:
  - `Date`
  - `Amount`
  - `Source Amount`, `Source Currency`, `Source Exchange Rate` (trip-linked expenses entered in destination currency)
  - `Category Key` (or `Category`)
  - `Description`
  - `Trip ID` (expenses only)
  - `Shared Friend Group` (expenses only, optional)
  - `Name`, `Start Date`, `End Date`, `Currency`, `Exchange Rate`, `Budget`, `Destinations`, `Group Name`, `Total Travelers`, `Group Fund` (trips)
- Invalid rows are skipped with issue reporting
- Duplicate rows inside the same file are skipped automatically
- Trips are imported first so exported `Trip ID` values can be remapped before expense import
- Data is imported via API-backed context actions (no direct localStorage write for transactions/preferences)

Export:
- Generates `wallet_data_YYYY-MM-DD.xlsx`
- Includes sheets:
  - `Summary`
  - `Expenses`
  - `Incomes`
  - `Savings Assets`
  - `Trips`
  - `Trip Summary`
  - `Expense Categories`
  - `Income Categories`
- `Expenses` sheet includes optional `Shared Friend Group` column for trip-linked shared expenses
- `Expenses` sheet also includes optional `Source Amount`, `Source Currency`, and `Source Exchange Rate` for trip-currency round-trip import/export
- `Trip Summary` includes currency-aware trip totals, app-currency reference totals, shared-group metrics, group fund left, and per-person shared spend
- Export includes built-in categories plus custom categories detected from settings and data
- Template download filename: `wallet_import_template.xlsx` and includes `Expenses`, `Incomes`, and `Trips` sheets

## Local Development

### 1) Install dependencies

```bash
npm install
```

### 2) Start PocketBase

```bash
docker-compose -f docker-compose.pb.yml up -d
```

### 3) Bootstrap schema + superuser (one-time per fresh `pb_data`)

Bash:

```bash
docker run --rm --entrypoint /bin/sh -v "$(pwd):/work" ghcr.io/muchobien/pocketbase@sha256:244e8028be1fc9a9ab3649e746c248f40dd0cf852f7cdc8b12e17922347f52cf -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up && pocketbase --dir=/work/pb_data superuser upsert admin@wallet.local change-me-strong-password"
```

PowerShell:

```powershell
docker run --rm --entrypoint /bin/sh -v "${pwd}:/work" ghcr.io/muchobien/pocketbase@sha256:244e8028be1fc9a9ab3649e746c248f40dd0cf852f7cdc8b12e17922347f52cf -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up && pocketbase --dir=/work/pb_data superuser upsert admin@wallet.local change-me-strong-password"
```

Superuser is for PocketBase Admin UI only (`http://localhost:8090/_/`).

### 4) Start app

```bash
npm run dev
```

Open `http://localhost:3000`.

### 5) Configure AI keys (server-side)

Set keys in `.env.local` for local dev:

```env
AI_DEFAULT_MODEL=glm-5
ZAI_OPENAI_BASE_URL=https://api.z.ai/api/coding/paas/v4
ZAI_API_KEYS_JSON={"admin@wallet.local":"sk-xxx","user2@wallet.local":"sk-yyy"}
# optional fallback:
# ZAI_API_KEY=sk-fallback
```

Settings page now allows **model selection only** (`glm-5`, `glm-5-turbo`, `glm-4.7`).
API keys are never stored in browser/localStorage.

### 6) Control registration (internal use)

```env
AUTH_REGISTRATION_ENABLED=false
AUTH_ALLOWED_EMAILS=alice@company.com,bob@company.com
AUTH_ALLOWED_DOMAINS=company.com
```

Rules:
- `AUTH_REGISTRATION_ENABLED=false`: self-registration is blocked
- `AUTH_REGISTRATION_ENABLED=true` + allowlists: only allowlisted users can register
- `AUTH_REGISTRATION_ENABLED=true` + no allowlists: anyone can register

If self-registration is disabled, create users manually in PocketBase Admin (`users` collection).

## PocketBase Migrations

Managed migration files:

- `pb_migrations/1774166000_wallet_schema.js`
- `pb_migrations/1774300000_income_savings_collections.js`
- `pb_migrations/1774301000_ensure_income_savings_collections.js` (repair migration)
- `pb_migrations/1774400000_update_income_category.js`
- `pb_migrations/1774500000_savings_assets_collection.js`
- `pb_migrations/1774600000_add_symbol_to_savings_assets.js` (adds optional `symbol` for live crypto ticker)
- `pb_migrations/1774700000_user_preferences_and_personal_funds.js`
- `pb_migrations/1774800000_trip_group_fund_fields.js`
- `pb_migrations/1774900000_add_currency_sign_to_preferences.js`
- `pb_migrations/1775000000_add_shared_group_expense_to_transactions.js`
- `pb_migrations/1775100000_add_recurring_insurance_fields.js`
- `pb_migrations/1775200000_trip_settlements_and_fund_goals.js`
- `pb_migrations/1775300000_trip_currency_and_source_metadata.js`
- `pb_migrations/1775400000_planning_collaboration_collections.js`

Expected collections:

- `users`
- `transactions`
- `incomes`
- `savings_goals`
- `savings_assets`
- `user_preferences`
- `accounts`
- `liabilities`
- `budgets`
- `trips`
- `trip_members`
- `trip_settlements`
- `fund_goals`
- `transaction_rules`
- `households`
- `household_members`
- `subscriptions`

## Kubernetes Deployment

Apply in order:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl -n wallet-app create secret generic pocketbase-bootstrap --from-literal=PB_SUPERUSER_EMAIL='admin@wallet.local' --from-literal=PB_SUPERUSER_PASSWORD='replace-with-strong-password' --dry-run=client -o yaml | kubectl apply -f -
kubectl -n wallet-app create secret generic wallet-ai-secrets --from-literal=ZAI_API_KEYS_JSON='{"admin@wallet.local":"sk-xxx"}' --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f k8s/pocketbase-bootstrap.yaml
kubectl apply -f k8s/pocketbase-deployment.yaml
kubectl apply -f k8s/pocketbase-service.yaml
kubectl apply -f k8s/deployment.yaml
```

Then patch the frontend image to the exact immutable tag for the release you want to run:

```bash
kubectl -n wallet-app set image deployment/wallet-frontend wallet-app=winyannainghtut/wallet-app:sha-<commit>
kubectl rollout status deployment/wallet-frontend -n wallet-app
```

`k8s/deployment.yaml` is intentionally pinned to a known digest baseline. Do not rely on mutable tags like `dev-latest` for shared environments.

### Expose App via Cloudflare Tunnel (`wallet.winyan.dev`, token mode)

1) Create secret from tunnel token:

```bash
kubectl -n wallet-app create secret generic cloudflared-token --from-literal=TUNNEL_TOKEN='<YOUR_TUNNEL_TOKEN>' --dry-run=client -o yaml | kubectl apply -f -
```

2) Apply tunnel deployment:

```bash
kubectl apply -f k8s/cloudflare-tunnel.yaml
kubectl rollout status deployment/cloudflared -n wallet-app
```

3) In Cloudflare Zero Trust, configure Public Hostname:
- Hostname: `wallet.winyan.dev`
- Service Type: `HTTP`
- URL: `wallet-frontend-service.wallet-app.svc.cluster.local:80`

After changing migration config:

```bash
kubectl apply -f k8s/pocketbase-bootstrap.yaml
kubectl rollout restart deployment/pocketbase -n wallet-app
kubectl logs -n wallet-app deployment/pocketbase -c pocketbase-bootstrap --tail=200
```

## Quick Troubleshooting

### "Savings goals collection is missing"

1. Ensure migration runs against the same PocketBase instance used by the app.
2. Re-run migration:

```bash
docker run --rm --entrypoint /bin/sh -v "$(pwd):/work" ghcr.io/muchobien/pocketbase@sha256:244e8028be1fc9a9ab3649e746c248f40dd0cf852f7cdc8b12e17922347f52cf -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up"
docker restart wallet-pocketbase
```

3. In K8s, re-apply bootstrap ConfigMap and restart PocketBase deployment.
4. Verify `POCKETBASE_URL` points to the correct instance.

## GitHub Pipeline (Docker Hub)

Workflow: `.github/workflows/dockerhub-build.yml`

- Trigger: push to `main`, `dev`, and `workflow_dispatch`
- Required secrets:
  - `DOCKERHUB_USERNAME`
  - `DOCKERHUB_TOKEN`
- Published tags:
  - `sha-<commit>`
  - `latest` (on `main`)
  - `dev-latest` (on `dev`)

## Docs

- [Setup Guide](docs/SETUP-GUIDE.md)
- [PocketBase Setup](docs/POCKETBASE.md)
- [Tech Stack](techstack.md)
- [Dev Journey](DEVJOURNEY.md)
