# PocketBase Backend Setup

This document explains how PocketBase is provisioned for this project in both local development and Kubernetes.

## Current Backend Model

Browser -> Next.js API Routes -> PocketBase

- Browser never talks to PocketBase directly for app data writes.
- Auth and data operations are routed via `src/app/api/*`.
- Auth cookie used by API routes: `pb_auth`.

## API Surface Used by the App

Auth:

- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/auth/register`

Data:

- `/api/transactions`
- `/api/transactions/[id]`
- `/api/trips`
- `/api/trips/[id]`
- `/api/subscriptions`
- `/api/subscriptions/[id]`

## Collections Managed by Migration

Schema is versioned in:

- `pb_migrations/1774166000_wallet_schema.js`

Managed collections:

- `users` (auth collection)
- `transactions`
- `trips`
- `subscriptions`

## Kubernetes Auto Bootstrap

### Files involved

- `k8s/pocketbase-bootstrap.yaml`
  - ConfigMap: `pocketbase-migrations` (migration JS files)
- `k8s/pocketbase-deployment.yaml`
  - initContainer runs:
    - `pocketbase migrate up`
    - `pocketbase superuser upsert`

Superuser credentials are provided by K8s secret `pocketbase-bootstrap`.

### Deploy order

```bash
kubectl apply -f k8s/namespace.yaml
kubectl -n wallet-app create secret generic pocketbase-bootstrap --from-literal=PB_SUPERUSER_EMAIL='admin@wallet.local' --from-literal=PB_SUPERUSER_PASSWORD='replace-with-strong-password' --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f k8s/pocketbase-bootstrap.yaml
kubectl apply -f k8s/pocketbase-deployment.yaml
kubectl apply -f k8s/pocketbase-service.yaml
```

### Verify

```bash
kubectl get pods -n wallet-app
kubectl logs -n wallet-app deployment/pocketbase -c pocketbase-bootstrap
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

Important:
- The superuser account is only for PocketBase Admin UI access.
- App login at `/login` authenticates against the `users` collection, not `_superusers`.

## How to Update Schema

1. Edit or add migration file in `pb_migrations/`.
2. Test locally:

```bash
docker run --rm --entrypoint /bin/sh -v "$(pwd):/work" ghcr.io/muchobien/pocketbase:latest -lc "mkdir -p /tmp/pbdata && pocketbase --dir=/tmp/pbdata --migrationsDir=/work/pb_migrations migrate up"
```

3. Deploy updated `k8s/pocketbase-bootstrap.yaml` (if migration content changed).
4. Restart PocketBase deployment or roll out new image.

## Notes

- `superuser upsert` is idempotent and safe on restart.
- Existing PVC data is preserved across pod restarts.
- For a completely clean environment, delete the PVC/data and run bootstrap again.
- App self-registration is controlled by Next.js env vars:
  - `AUTH_REGISTRATION_ENABLED`
  - `AUTH_ALLOWED_EMAILS`
  - `AUTH_ALLOWED_DOMAINS`

## Troubleshooting

### Migration did not run in K8s

- Check init container logs.
- Confirm `k8s/pocketbase-bootstrap.yaml` was applied before deployment.

### Superuser credentials not working

- Update K8s secret values:

```bash
kubectl -n wallet-app create secret generic pocketbase-bootstrap --from-literal=PB_SUPERUSER_EMAIL='admin@wallet.local' --from-literal=PB_SUPERUSER_PASSWORD='replace-with-strong-password' --dry-run=client -o yaml | kubectl apply -f -
```

- Re-apply and restart PocketBase deployment.

### App can login but cannot save data

- Confirm collections exist (`transactions`, `trips`, `subscriptions`).
- Confirm user-specific rules are present from migration.
