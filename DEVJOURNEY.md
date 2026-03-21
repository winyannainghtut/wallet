# Dev Journey - Wallet App

## 2026-03-21 (Friday)

### ✅ Completed Today

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

#### 4. PocketBase Backend Integration (dev branch)
- [x] MicroK8s deployment manifests for PocketBase
- [x] PersistentVolumeClaim for data persistence
- [x] PocketBase client singleton setup
- [x] AuthContext with `authWithPassword`
- [x] Login/Register pages
- [x] Transaction CRUD operations
- [x] Real-time subscriptions
- [x] Server Component helpers

---

## 🔜 Tomorrow's Tasks

### Priority 1: PocketBase Setup
- [ ] Deploy PocketBase to MicroK8s cluster
- [ ] Configure Cloudflare Tunnel for `pb.yourdomain.com`
- [ ] Create PocketBase collections (users, transactions, budgets)
- [ ] Set API rules for user-owned data
- [ ] Test authentication flow

### Priority 2: Migrate Existing Features
- [ ] Update `AppContext` to use PocketBase instead of localStorage
- [ ] Migrate expense form to use `useTransactions` hook
- [ ] Update reports page to fetch from PocketBase
- [ ] Test Excel import/export with PocketBase data

### Priority 3: Enhancements
- [ ] Add loading states for async operations
- [ ] Implement error boundaries
- [ ] Add offline support (consider PWA)
- [ ] Improve mobile responsiveness

---

## 📝 Notes

### Environment Variables Needed
```env
NEXT_PUBLIC_POCKETBASE_URL=https://pb.yourdomain.com
# Optional for server-side:
POCKETBASE_URL=http://pocketbase-service.wallet-app.svc.cluster.local:8090
```

### PocketBase Collections to Create
1. **users** (default) - Authentication
2. **transactions** - Income/Expense records
3. **budgets** - Category budgets
4. **subscriptions** - Recurring expenses
5. **trips** - Trip budgets

### API Rules Template
```
List/View: user = @request.auth.id
Create: user = @request.auth.id
Update: user = @request.auth.id
Delete: user = @request.auth.id
```

---

## 🐛 Known Issues
- [ ] Gemini 2.0 Flash not available to new users (using `gemini-1.5-flash-latest`)
- [ ] Need to verify PocketBase works behind Cloudflare Tunnel

---

## 📚 Resources
- [PocketBase Docs](https://pocketbase.io/docs/)
- [PocketBase JS SDK](https://github.com/pocketbase/js-sdk)
- [Cloudflare Tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [MicroK8s Docs](https://microk8s.io/docs)

---

## Git Branches
- `main` - Production ready code
- `dev` - Development & PocketBase integration

---

*Last updated: 2026-03-21 23:20*
