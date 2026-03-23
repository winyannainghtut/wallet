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
- `/api/market/fx` (Coinbase exchange rate proxy for currency conversion, e.g., USD->SGD)
- `/api/trips`
- `/api/trips/[id]`
- `/api/subscriptions`
- `/api/subscriptions/[id]`
- `/api/ai` (server-side Z.AI calls; does not expose keys to browser)

### Market data integration for savings assets

- Live crypto quote stream uses Coinbase Advanced Trade WebSocket (`wss://advanced-trade-ws.coinbase.com`) directly from browser.
- FX conversion (USD -> app currency such as SGD) is fetched via `/api/market/fx`.
- Savings asset values are resolved client-side as:
  - insurance/stocks: manual value (`amount`)
  - crypto: `quantity * live USD quote * FX rate`

## Schema and Migrations

Migration files:

- `pb_migrations/1774166000_wallet_schema.js`
- `pb_migrations/1774300000_income_savings_collections.js`
- `pb_migrations/1774301000_ensure_income_savings_collections.js`
- `pb_migrations/1774500000_savings_assets_collection.js`
- `pb_migrations/1774600000_add_symbol_to_savings_assets.js`

Purpose summary:

- `1774166000`: base wallet schema (`users`, `transactions`, `trips`, `subscriptions`)
- `1774300000`: adds `incomes` and `savings_goals`
- `1774301000`: repair migration that ensures `incomes`/`savings_goals` exist even when history is inconsistent
- `1774500000`: adds `savings_assets` (`insurance`, `crypto`, `stocks`)
- `1774600000`: adds optional `symbol` field in `savings_assets` for live crypto ticker mapping

Expected collections:

- `users`
- `transactions`
- `incomes`
- `savings_goals`
- `savings_assets`
- `trips`
- `subscriptions`

## Kubernetes Auto Bootstrap

### Related files

- `k8s/pocketbase-bootstrap.yaml`
  - ConfigMap: `pocketbase-migrations`
- `k8s/pocketbase-deployment.yaml`
  - initContainer runs:
    - `pocketbase migrate up`
    - `pocketbase superuser upsert`

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
docker run --rm --entrypoint /bin/sh -v "$(pwd):/work" ghcr.io/muchobien/pocketbase:latest -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up && pocketbase --dir=/work/pb_data superuser upsert admin@wallet.local change-me-strong-password"
```

PowerShell:

```powershell
docker run --rm --entrypoint /bin/sh -v "${pwd}:/work" ghcr.io/muchobien/pocketbase:latest -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up && pocketbase --dir=/work/pb_data superuser upsert admin@wallet.local change-me-strong-password"
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
docker run --rm --entrypoint /bin/sh -v "$(pwd):/work" ghcr.io/muchobien/pocketbase:latest -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up"
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
