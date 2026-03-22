# Wallet App

Wallet App is a Next.js 16 personal finance tracker with PocketBase backend, authentication, trips, subscriptions, income tracking, savings goals, reports, calendar view, and AI insights.

## Key Features

- Authentication-first flow (`/login` required before using the app)
- Expense tracking (categories, history, reports)
- Income tracking
- Savings page with monthly savings goal CRUD
- Trips and subscriptions persisted in PocketBase
- Dashboard/Reports/Calendar cross comparison for:
  - expense
  - income
  - net savings
- English/Myanmar language support
- AI assistant with Gemini or Z.AI GLM (OpenAI-compatible)
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
- `/api/incomes`
- `/api/incomes/[id]`
- `/api/savings-goals`
- `/api/savings-goals/[id]`
- `/api/trips`
- `/api/trips/[id]`
- `/api/subscriptions`
- `/api/subscriptions/[id]`

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
docker run --rm --entrypoint /bin/sh -v "$(pwd):/work" ghcr.io/muchobien/pocketbase:latest -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up && pocketbase --dir=/work/pb_data superuser upsert admin@wallet.local change-me-strong-password"
```

PowerShell:

```powershell
docker run --rm --entrypoint /bin/sh -v "${pwd}:/work" ghcr.io/muchobien/pocketbase:latest -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up && pocketbase --dir=/work/pb_data superuser upsert admin@wallet.local change-me-strong-password"
```

Superuser is for PocketBase Admin UI only (`http://localhost:8090/_/`).

### 4) Start app

```bash
npm run dev
```

Open `http://localhost:3000`.

### 5) Configure AI provider

Provider selection:
- `auto` (default): `AIza...` key -> Gemini, otherwise Z.AI
- forced: `NEXT_PUBLIC_AI_PROVIDER=gemini|zai`

Optional overrides:

```env
NEXT_PUBLIC_AI_PROVIDER=auto
NEXT_PUBLIC_ZAI_OPENAI_BASE_URL=https://api.z.ai/api/coding/paas/v4
NEXT_PUBLIC_ZAI_MODEL=glm-4.7
NEXT_PUBLIC_GEMINI_MODEL=gemini-3.1-flash-lite-preview
```

Set the API key in the app Settings page.

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

Expected collections:

- `users`
- `transactions`
- `incomes`
- `savings_goals`
- `trips`
- `subscriptions`

## Kubernetes Deployment

Apply in order:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl -n wallet-app create secret generic pocketbase-bootstrap --from-literal=PB_SUPERUSER_EMAIL='admin@wallet.local' --from-literal=PB_SUPERUSER_PASSWORD='replace-with-strong-password' --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f k8s/pocketbase-bootstrap.yaml
kubectl apply -f k8s/pocketbase-deployment.yaml
kubectl apply -f k8s/pocketbase-service.yaml
kubectl apply -f k8s/deployment.yaml
```

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
docker run --rm --entrypoint /bin/sh -v "$(pwd):/work" ghcr.io/muchobien/pocketbase:latest -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up"
docker restart wallet-pocketbase
```

3. In K8s, re-apply bootstrap ConfigMap and restart PocketBase deployment.
4. Verify `POCKETBASE_URL` points to the correct instance.

## GitHub Pipeline (Docker Hub)

Workflow: `.github/workflows/dockerhub-build.yml`

- Trigger: push to `main`, and `workflow_dispatch`
- Required secrets:
  - `DOCKERHUB_USERNAME`
  - `DOCKERHUB_TOKEN`
- Published tags:
  - `sha-<commit>`
  - `latest` (on `main`)

## Docs

- [Setup Guide](docs/SETUP-GUIDE.md)
- [PocketBase Setup](docs/POCKETBASE.md)
- [Tech Stack](techstack.md)
- [Dev Journey](DEVJOURNEY.md)
