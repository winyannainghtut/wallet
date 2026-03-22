# Dev Journey - Wallet App

## 2026-03-22 (Saturday)

### ✅ Completed Today

#### PocketBase Integration (BFF Pattern)
- [x] Installed PocketBase SDK
- [x] Created `docker-compose.pb.yml` for local PocketBase development
- [x] Created `src/lib/pb.ts` - Server-side PocketBase client
- [x] Created Auth API routes (`/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/register`)
- [x] Created Transactions API routes (`/api/transactions`, `/api/transactions/[id]`)
- [x] Updated `AuthContext` to use API routes (BFF pattern)
- [x] Updated `useTransactions` hook
- [x] Build compiles successfully

#### Architecture Decision
**Chosen: BFF (Backend for Frontend) Pattern**
```
Browser → Next.js API Routes → PocketBase (internal)
```
- PocketBase NOT exposed publicly
- Only Next.js frontend exposed via Cloudflare Tunnel
- Auth tokens stored in HTTP-only cookies

---

## 2026-03-21 (Friday)

### ✅ Completed

#### 1. Wallet App Foundation
- [x] Next.js 16.2.1 setup with App Router
- [x] Tailwind CSS v4 + shadcn/ui components
- [x] Expense tracking with categories (Groceries, Transport, etc.)
- [x] Weekly/Monthly reports with charts
- [x] Excel import/export functionality
- [x] Multi-language support (English/Myanmar)
- [x] User switching and password protection
- [x] Docker and Kubernetes deployment configs

#### 2. AI Integration
- [x] Integrated Google Gemini API for AI insights
- [x] Chat assistant for expense queries
- [x] Category suggestions from descriptions
- [x] Natural language expense parsing

#### 3. Git & Deployment
- [x] Pushed to GitHub: https://github.com/winyannainghtut/wallet
- [x] Created `main` and `dev` branches
- [x] Updated `.gitignore` for sensitive data

---

## 🔜 Next Steps

### Priority 1: Test PocketBase Integration
```bash
# 1. Start PocketBase locally
docker-compose -f docker-compose.pb.yml up -d

# 2. Open PocketBase admin UI
open http://localhost:8090/_/

# 3. Create admin account and collections

# 4. Start Next.js dev server
npm run dev

# 5. Test login/register at http://localhost:3000/login
```

### Priority 2: Create PocketBase Collections
1. **users** (default) - Authentication
2. **transactions** - Income/Expense records

**transactions collection fields:**
| Field | Type | Options |
|-------|------|---------|
| user | relation | → users, Required |
| type | select | income, expense |
| category | text | Required |
| amount | number | Required |
| description | text | |
| date | date | Required |

**API Rules:**
```
List/View: user = @request.auth.id
Create: @request.auth.id != ""
Update: user = @request.auth.id
Delete: user = @request.auth.id
```

### Priority 3: Migrate Existing Features
- [ ] Update `AppContext` to use PocketBase instead of localStorage
- [ ] Migrate expense form to use `useTransactions` hook
- [ ] Update reports page to fetch from PocketBase
- [ ] Test Excel import/export with PocketBase data

---

## 📝 Environment Variables

```env
# .env.local (Development)
POCKETBASE_URL=http://localhost:8090

# .env.production (K8s)
POCKETBASE_URL=http://pocketbase-service.wallet-app.svc.cluster.local:8090
```

---

## 📁 New Files Created

| File | Purpose |
|------|---------|
| `docker-compose.pb.yml` | Local PocketBase container |
| `src/lib/pb.ts` | Server-side PB client |
| `src/app/api/auth/login/route.ts` | Login endpoint |
| `src/app/api/auth/logout/route.ts` | Logout endpoint |
| `src/app/api/auth/me/route.ts` | Get current user |
| `src/app/api/auth/register/route.ts` | Register endpoint |
| `src/app/api/transactions/route.ts` | Transactions CRUD |
| `src/app/api/transactions/[id]/route.ts` | Single transaction ops |

---

## 🐛 Known Issues
- [ ] Gemini 2.0 Flash not available to new users (using `gemini-1.5-flash-latest`)

---

## 📚 Resources
- [PocketBase Docs](https://pocketbase.io/docs/)
- [PocketBase JS SDK](https://github.com/pocketbase/js-sdk)

---

## Git Branches
- `main` - Production ready code
- `dev` - Development & PocketBase integration

---

*Last updated: 2026-03-22*
