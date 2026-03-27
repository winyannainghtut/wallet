# PocketBase Backend Setup

This document describes PocketBase provisioning for local Docker and Kubernetes.

## Backend Model

Browser -> Next.js API routes -> PocketBase

- Browser does not write directly to PocketBase.
- Next.js route handlers (`src/app/api/*`) own auth and data access.
- Auth cookie used by API routes: `pb_auth`.

## API Surface Used by the App

### Auth

- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/auth/register`
- `/api/auth/register-policy`

### Data

- `/api/transactions`
- `/api/transactions/[id]`
- `/api/incomes`
- `/api/incomes/[id]`
- `/api/savings-goals`
- `/api/savings-goals/[id]`
- `/api/savings-assets`
- `/api/savings-assets/[id]`
- `/api/preferences`
- `/api/fund-goals`
- `/api/fund-goals/[id]`
- `/api/market/fx` (Coinbase exchange rate proxy for currency conversion, e.g., USD->SGD)
- `/api/trips`
- `/api/trips/[id]`
- `/api/trip-members`
- `/api/trip-members/[id]`
- `/api/trip-settlements`
- `/api/trip-settlements/[id]`
- `/api/subscriptions`
- `/api/subscriptions/[id]`
- `/api/ai` (server-side Z.AI calls; does not expose keys to browser)

### Market data integration for savings assets

- Live crypto quote stream uses Coinbase Advanced Trade WebSocket (`wss://advanced-trade-ws.coinbase.com`) directly from browser.
- Live stock quote stream can use `wss://ws.realtime-finance.ws/stocks/{SYMBOL}` directly from browser when a stock asset has a saved symbol.
- FX conversion (USD -> app currency such as SGD) is fetched via `/api/market/fx`.
- Savings asset values are resolved client-side as:
  - insurance/personal funds: manual value (`amount`)
  - crypto: `quantity * live USD quote * FX rate`
  - stocks with symbol: `quantity * live USD quote * FX rate`
  - stocks without symbol: manual value (`amount`)
- Per-user settings, custom categories, and AI chat history are stored in `user_preferences` via `/api/preferences`.
- `user_preferences` now carries settings such as `language`, `currency`, `currencySign`, `aiModel`, `theme`, `customCategories`, and `chatHistory`.
- `transactions` can carry `tripId`, `sharedGroupExpense`, and `paidByMemberId` for trip-linked pooled friend-group spend and settle-up calculations.
- `trip_members` stores the participant list for each trip.
- `trip_settlements` stores planned or paid settle-up records between trip members.
- `fund_goals` stores linked savings/trip targets, status, and linked asset ids.

## Schema and Migrations

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

Purpose summary:

- `1774166000`: base wallet schema (`users`, `transactions`, `trips`, `subscriptions`)
- `1774300000`: adds `incomes` and `savings_goals`
- `1774301000`: repair migration that ensures `incomes`/`savings_goals` exist even when history is inconsistent
- `1774400000`: updates legacy income category values
- `1774500000`: adds `savings_assets` (`insurance`, `crypto`, `stocks`)
- `1774600000`: adds optional `symbol` field in `savings_assets` for live crypto ticker mapping
- `1774700000`: adds `user_preferences` and extends `savings_assets.type` with `personal_funds`
- `1774800000`: adds `trips.groupName`, `trips.groupSize`, and `trips.groupFund`
- `1774900000`: adds `user_preferences.currencySign`
- `1775000000`: adds `transactions.sharedGroupExpense`
- `1775100000`: adds recurring monthly insurance contribution fields to `savings_assets`
- `1775200000`: adds `trip_members`, `trip_settlements`, `fund_goals`, and `transactions.paidByMemberId`

Expected collections:

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

## Kubernetes Auto Bootstrap

### Related files

- `k8s/pocketbase-bootstrap.yaml`
  - ConfigMap: `pocketbase-migrations`
- `k8s/pocketbase-deployment.yaml`
  - initContainer runs:
    - `pocketbase migrate up`
    - `pocketbase superuser upsert`
  - PVC uses the cluster default storage class unless you set one explicitly
  - PocketBase image is pinned by digest for deterministic deploys

Superuser credentials come from secret `pocketbase-bootstrap`.

### Deploy order

```bash
kubectl apply -f k8s/namespace.yaml
kubectl -n wallet-app create secret generic pocketbase-bootstrap --from-literal=PB_SUPERUSER_EMAIL='admin@wallet.local' --from-literal=PB_SUPERUSER_PASSWORD='replace-with-strong-password' --dry-run=client -o yaml | kubectl apply -f -
kubectl -n wallet-app create secret generic wallet-ai-secrets --from-literal=ZAI_API_KEYS_JSON='{"admin@wallet.local":"sk-xxx"}' --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f k8s/pocketbase-bootstrap.yaml
kubectl apply -f k8s/pocketbase-deployment.yaml
kubectl apply -f k8s/pocketbase-service.yaml
```

### Verify bootstrap

```bash
kubectl get pods -n wallet-app
kubectl logs -n wallet-app deployment/pocketbase -c pocketbase-bootstrap --tail=200
```

## Local Bootstrap

Start PocketBase:

```bash
docker-compose -f docker-compose.pb.yml up -d
```

Apply migration + create/update superuser:

Bash:

```bash
docker run --rm --entrypoint /bin/sh -v "$(pwd):/work" ghcr.io/muchobien/pocketbase@sha256:244e8028be1fc9a9ab3649e746c248f40dd0cf852f7cdc8b12e17922347f52cf -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up && pocketbase --dir=/work/pb_data superuser upsert admin@wallet.local change-me-strong-password"
```

PowerShell:

```powershell
docker run --rm --entrypoint /bin/sh -v "${pwd}:/work" ghcr.io/muchobien/pocketbase@sha256:244e8028be1fc9a9ab3649e746c248f40dd0cf852f7cdc8b12e17922347f52cf -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up && pocketbase --dir=/work/pb_data superuser upsert admin@wallet.local change-me-strong-password"
```

Then restart local PocketBase to ensure live process sees current DB state:

```bash
docker restart wallet-pocketbase
```

Important:

- Superuser is for PocketBase Admin UI only.
- Wallet app login uses normal `users` collection accounts.

## Registration Control (Internal Use)

Registration is controlled by Next.js env vars:

- `AUTH_REGISTRATION_ENABLED`
- `AUTH_ALLOWED_EMAILS`
- `AUTH_ALLOWED_DOMAINS`

Recommended internal setup:

```env
AUTH_REGISTRATION_ENABLED=false
```

If disabled, create users manually in PocketBase Admin (`users` collection).

## Troubleshooting

### "Savings goals collection is missing. Apply latest PocketBase migrations."

This usually means one of the following:

1. Migration was run against a different PocketBase instance/data directory.
2. K8s ConfigMap was updated but PocketBase pod was not restarted.
3. Migration history exists but collection creation was previously inconsistent.

Fix steps:

1. Ensure app points to the expected PocketBase URL (`POCKETBASE_URL`).
2. Re-run migration against the actual data dir:

```bash
docker run --rm --entrypoint /bin/sh -v "$(pwd):/work" ghcr.io/muchobien/pocketbase@sha256:244e8028be1fc9a9ab3649e746c248f40dd0cf852f7cdc8b12e17922347f52cf -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up"
```

3. Restart PocketBase process/container/pod.
4. In K8s, re-apply and restart:

```bash
kubectl apply -f k8s/pocketbase-bootstrap.yaml
kubectl rollout restart deployment/pocketbase -n wallet-app
kubectl logs -n wallet-app deployment/pocketbase -c pocketbase-bootstrap --tail=200
```

5. Confirm collections in PocketBase Admin:
   - `incomes`
   - `savings_goals`
   - `savings_assets`
   - `user_preferences`

### Settings or shared trip metadata not persisting

1. Confirm latest migrations are applied:
   - `1774800000_trip_group_fund_fields.js`
   - `1774900000_add_currency_sign_to_preferences.js`
   - `1775000000_add_shared_group_expense_to_transactions.js`
   - `1775100000_add_recurring_insurance_fields.js`
   - `1775200000_trip_settlements_and_fund_goals.js`
2. Re-apply `k8s/pocketbase-bootstrap.yaml` and restart PocketBase if running in Kubernetes.
3. In PocketBase Admin, verify:
   - `trips` has `groupName`, `groupSize`, `groupFund`
   - `user_preferences` has `currencySign`
   - `transactions` has `sharedGroupExpense`

### Trip settle-up or fund goals data missing

1. Confirm latest migration is applied:
   - `1775200000_trip_settlements_and_fund_goals.js`
2. Re-apply `k8s/pocketbase-bootstrap.yaml` and restart PocketBase.
3. In PocketBase Admin, verify:
   - `transactions` has `paidByMemberId`
   - `trip_members` collection exists
   - `trip_settlements` collection exists
   - `fund_goals` collection exists

### App login works but data save fails

- Confirm expected collections exist.
- Confirm collection rules are user-scoped (`user = @request.auth.id`).
- Confirm API routes use authenticated `pb_auth` cookie.

### Superuser credentials not working

Recreate K8s secret:

```bash
kubectl -n wallet-app create secret generic pocketbase-bootstrap --from-literal=PB_SUPERUSER_EMAIL='admin@wallet.local' --from-literal=PB_SUPERUSER_PASSWORD='replace-with-strong-password' --dry-run=client -o yaml | kubectl apply -f -
```

Then restart PocketBase deployment.
