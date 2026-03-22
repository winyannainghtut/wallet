# Wallet App Setup Guide

This guide covers local development setup and Kubernetes deployment with automated PocketBase bootstrap.

## Contents

1. Prerequisites
2. Local Setup (Recommended)
3. Verify Application Flow
4. Kubernetes Setup
5. Troubleshooting

## 1) Prerequisites

Install:

- Docker Desktop
- Node.js 18+
- Git
- (For K8s) `kubectl` configured to your cluster

## 2) Local Setup (Recommended)

### 2.1 Clone and install

```bash
git clone https://github.com/winyannainghtut/wallet.git
cd wallet
git checkout dev
npm install
```

### 2.2 Start PocketBase container

```bash
docker-compose -f docker-compose.pb.yml up -d
```

### 2.3 Bootstrap PocketBase schema and superuser

Run this once for a fresh `pb_data` directory.

Bash:

```bash
docker run --rm --entrypoint /bin/sh -v "$(pwd):/work" ghcr.io/muchobien/pocketbase:latest -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up && pocketbase --dir=/work/pb_data superuser upsert admin@wallet.local change-me-strong-password"
```

PowerShell:

```powershell
docker run --rm --entrypoint /bin/sh -v "${pwd}:/work" ghcr.io/muchobien/pocketbase:latest -lc "pocketbase --dir=/work/pb_data --migrationsDir=/work/pb_migrations migrate up && pocketbase --dir=/work/pb_data superuser upsert admin@wallet.local change-me-strong-password"
```

Important:
- Superuser credentials are for PocketBase Admin (`http://localhost:8090/_/`) only.
- Wallet App login uses normal `users` collection accounts (create from Register tab at `/login`).

### 2.4 Start Next.js app

```bash
npm run dev
```

Open:

- App: `http://localhost:3000`
- PocketBase Admin: `http://localhost:8090/_/`

### 2.5 Restrict registration (internal use)

Set these in your `.env.local`:

```env
AUTH_REGISTRATION_ENABLED=false
# AUTH_ALLOWED_EMAILS=alice@company.com,bob@company.com
# AUTH_ALLOWED_DOMAINS=company.com
```

If you later set `AUTH_REGISTRATION_ENABLED=true`, you can restrict access by allowlisted emails/domains.

## 3) Verify Application Flow

### 3.1 Auth flow

1. Open `http://localhost:3000`
2. You should be redirected to `/login`
3. Register a new user (or login if already created)

### 3.2 Data flow

1. Add an expense from `/add`
2. Create a trip from `/trips`
3. Create a subscription from `/subscriptions`
4. Verify records in PocketBase Admin collections:
   - `transactions`
   - `trips`
   - `subscriptions`

### 3.3 Collection bootstrap check

Expected collections:

- `users` (auth collection)
- `transactions`
- `trips`
- `subscriptions`

Schema source is tracked in:

- `pb_migrations/1774166000_wallet_schema.js`

## 4) Kubernetes Setup

### 4.1 Create bootstrap secret

Create or update the PocketBase bootstrap secret in the cluster:

```bash
kubectl -n wallet-app create secret generic pocketbase-bootstrap --from-literal=PB_SUPERUSER_EMAIL='admin@wallet.local' --from-literal=PB_SUPERUSER_PASSWORD='replace-with-strong-password' --dry-run=client -o yaml | kubectl apply -f -
```

### 4.2 Apply manifests

```bash
kubectl apply -f k8s/namespace.yaml
kubectl -n wallet-app create secret generic pocketbase-bootstrap --from-literal=PB_SUPERUSER_EMAIL='admin@wallet.local' --from-literal=PB_SUPERUSER_PASSWORD='replace-with-strong-password' --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f k8s/pocketbase-bootstrap.yaml
kubectl apply -f k8s/pocketbase-deployment.yaml
kubectl apply -f k8s/pocketbase-service.yaml
kubectl apply -f k8s/deployment.yaml
```

### 4.3 Verify bootstrap logs

```bash
kubectl logs -n wallet-app deployment/pocketbase -c pocketbase-bootstrap
```

You should see migration apply and superuser upsert messages.

## 5) Troubleshooting

### "Unauthorized" from app APIs

- Ensure you are logged in from `/login`
- Check auth routes (`/api/auth/me`) in browser network tab

### Collections missing after fresh setup

- Re-run the bootstrap command in section 2.3
- Check migration output for errors

### Superuser login fails in PocketBase Admin

- Update the `pocketbase-bootstrap` K8s secret with the command in section 4.1
- Restart PocketBase deployment:

```bash
kubectl rollout restart deployment/pocketbase -n wallet-app
```

### Container port conflict on 8090

```bash
docker-compose -f docker-compose.pb.yml down
# free up port 8090, then start again
docker-compose -f docker-compose.pb.yml up -d
```

### Reset local PocketBase data

```bash
docker-compose -f docker-compose.pb.yml down
rm -rf pb_data
docker-compose -f docker-compose.pb.yml up -d
# then run section 2.3 again
```
