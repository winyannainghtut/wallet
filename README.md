# Wallet App

Wallet App is a Next.js 16 personal finance tracker with PocketBase backend, authentication, trips, subscriptions, reports, calendar view, and AI insights.

## Key Features

- Email/password authentication via PocketBase (`/login` required by default)
- Expense tracking with categories and date history
- Trips and subscriptions persisted in PocketBase
- Daily/weekly/monthly summaries and reports
- English/Myanmar language support
- Kubernetes deployment manifests for frontend + PocketBase

## Architecture

Browser -> Next.js App Router + API routes -> PocketBase

- PocketBase auth is handled through server API routes (`/api/auth/*`)
- App data APIs:
  - `/api/transactions`
  - `/api/trips`
  - `/api/subscriptions`

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Start PocketBase

```bash
docker-compose -f docker-compose.pb.yml up -d
```

### 3. Bootstrap schema + superuser (one-time per fresh `pb_data`)

Bash:

```bash
docker run --rm --entrypoint /bin/sh -v "$(pwd):/work" ghcr.io/muchobien/pocketbase:latest -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up && pocketbase --dir=/work/pb_data superuser upsert admin@wallet.local change-me-strong-password"
```

PowerShell:

```powershell
docker run --rm --entrypoint /bin/sh -v "${pwd}:/work" ghcr.io/muchobien/pocketbase:latest -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up && pocketbase --dir=/work/pb_data superuser upsert admin@wallet.local change-me-strong-password"
```

`superuser` account is for PocketBase Admin UI only.  
For Wallet App login, create a normal user from the Register tab in `/login`.

### 4. Start app

```bash
npm run dev
```

Open `http://localhost:3000`.

### 5. Control who can register

Registration is controlled by server env vars:

```env
AUTH_REGISTRATION_ENABLED=false
AUTH_ALLOWED_EMAILS=alice@company.com,bob@company.com
AUTH_ALLOWED_DOMAINS=company.com
```

Rules:
- `AUTH_REGISTRATION_ENABLED=false`: no self-registration (internal default).
- `AUTH_REGISTRATION_ENABLED=true` with allowlists: only listed emails/domains can register.
- `AUTH_REGISTRATION_ENABLED=true` with no allowlists: anyone can register.

## Kubernetes Deployment

PocketBase bootstrap is automated in K8s:

- migrations from `pb_migrations/1774166000_wallet_schema.js`
- superuser upsert via K8s secret `pocketbase-bootstrap`

Apply in order:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl -n wallet-app create secret generic pocketbase-bootstrap --from-literal=PB_SUPERUSER_EMAIL='admin@wallet.local' --from-literal=PB_SUPERUSER_PASSWORD='replace-with-strong-password' --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f k8s/pocketbase-bootstrap.yaml
kubectl apply -f k8s/pocketbase-deployment.yaml
kubectl apply -f k8s/pocketbase-service.yaml
kubectl apply -f k8s/deployment.yaml
```

## GitHub Pipeline (Docker Hub)

Workflow file:

- `.github/workflows/dockerhub-build.yml`

Triggers:

- push to `dev` and `main`
- manual run via `workflow_dispatch`

Required GitHub Secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

Published tags:

- `sha-<commit>` (every build)
- `dev-latest` (when pushing `dev`)
- `latest` (when pushing `main`)

## Docs

- [Setup Guide](docs/SETUP-GUIDE.md)
- [PocketBase Setup](docs/POCKETBASE.md)
- [Tech Stack](techstack.md)
- [Dev Journey](DEVJOURNEY.md)
