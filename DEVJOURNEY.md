# Dev Journey - Wallet App

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

### Infra and Docs

- Added `k8s/pocketbase-bootstrap.yaml` (Secret + ConfigMap).
- Updated `k8s/pocketbase-deployment.yaml` to run bootstrap init container.
- Updated docs for local and k8s bootstrap flow:
  - `README.md`
  - `docs/SETUP-GUIDE.md`
  - `docs/POCKETBASE.md`
  - `techstack.md`
- Reconciled docs with current runtime behavior:
  - superuser is for PocketBase Admin UI only
  - app login uses `users` collection accounts

## Current Architecture

Browser -> Next.js API routes -> PocketBase

- Auth in HTTP-only cookie (`pb_auth`)
- PocketBase collections managed through migration files
- K8s startup is idempotent (`migrate up` + `superuser upsert`)

## Next Practical Tasks

1. Move bootstrap secret to SealedSecret/ExternalSecret for production.
2. Add CI check to validate migration applies on a clean PocketBase data dir.
3. Ignore PocketBase runtime WAL/SHM artifacts in git workflow if needed.

---

Last updated: 2026-03-22
