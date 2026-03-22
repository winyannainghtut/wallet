# Wallet App - Step-by-Step Setup Guide

This guide will walk you through setting up the Wallet App with PocketBase backend.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Start PocketBase](#2-start-pocketbase)
3. [Create PocketBase Admin Account](#3-create-pocketbase-admin-account)
4. [Create Collections](#4-create-collections)
5. [Create Test User](#5-create-test-user)
6. [Test the Application](#6-test-the-application)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

Ensure you have the following installed:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 18+](https://nodejs.org/)
- [Git](https://git-scm.com/)

---

## 2. Start PocketBase

### 2.1 Clone the Repository

```bash
git clone https://github.com/winyannainghtut/wallet.git
cd wallet
git checkout dev
```

### 2.2 Install Dependencies

```bash
npm install
```

### 2.3 Start PocketBase Container

```bash
docker-compose -f docker-compose.pb.yml up -d
```

### 2.4 Verify PocketBase is Running

```bash
docker ps
```

You should see `wallet-pocketbase` container running.

---

## 3. Create PocketBase Admin Account

### 3.1 Open PocketBase Admin UI

Open your browser and go to:

```
http://localhost:8090/_/
```

### 3.2 First-Time Setup

On first access, you'll see a form to create an admin account:

| Field | Example Value |
|-------|---------------|
| Email | `admin@wallet.com` |
| Password | `admin123456` |
| Confirm Password | `admin123456` |

Click **Create** to create your admin account.

### 3.3 Login

After creating the admin account, log in with your credentials.

---

## 4. Create Collections

### 4.1 Create `transactions` Collection

1. Click **Collections** in the left sidebar
2. Click **New Collection** button
3. Enter name: `transactions`
4. Add the following fields:

#### Field 1: `user`
| Setting | Value |
|---------|-------|
| Type | Relation |
| Collection | users |
| Required | ✅ Yes |

#### Field 2: `type`
| Setting | Value |
|---------|-------|
| Type | Select |
| Values | `income`, `expense` |
| Required | ✅ Yes |

#### Field 3: `category`
| Setting | Value |
|---------|-------|
| Type | Text |
| Required | ✅ Yes |

#### Field 4: `amount`
| Setting | Value |
|---------|-------|
| Type | Number |
| Required | ✅ Yes |
| Min | 0 |

#### Field 5: `description`
| Setting | Value |
|---------|-------|
| Type | Text |
| Required | ❌ No |

#### Field 6: `date`
| Setting | Value |
|---------|-------|
| Type | Date |
| Required | ✅ Yes |

### 4.2 Set API Rules

After adding all fields, scroll down to **API Rules** section and set:

| Action | Rule |
|--------|------|
| List/View | `user = @request.auth.id` |
| Create | `@request.auth.id != ""` |
| Update | `user = @request.auth.id` |
| Delete | `user = @request.auth.id` |

### 4.3 Save Collection

Click **Save** button at the bottom.

---

## 5. Create Test User

### 5.1 Navigate to Users Collection

1. Click **Collections** in sidebar
2. Click on **users** collection

### 5.2 Create New User

1. Click **New Record** button
2. Fill in the form:

| Field | Example Value |
|-------|---------------|
| email | `test@wallet.com` |
| password | `test123456` |
| passwordConfirm | `test123456` |
| name | `Test User` (optional) |

3. Click **Save**

---

## 6. Test the Application

### 6.1 Start Next.js Development Server

```bash
npm run dev
```

### 6.2 Open the Application

```
http://localhost:3000
```

### 6.3 Login

1. You'll be redirected to `/login` page
2. Enter credentials:
   - Email: `test@wallet.com`
   - Password: `test123456`
3. Click **Sign In**

### 6.4 Add an Expense

1. Click **Add** in the navigation or go to `/add`
2. Fill in the expense form:
   - Category: Select one (e.g., Groceries)
   - Amount: Enter amount (e.g., 50)
   - Description: Enter description (e.g., Weekly groceries)
   - Date: Select date
3. Click **Add Expense**

### 6.5 Verify Data in PocketBase

1. Go to PocketBase Admin: `http://localhost:8090/_/`
2. Click **Collections** → **transactions**
3. You should see your expense record there!

---

## 7. Troubleshooting

### Error: "Missing collection context"

**Cause:** The `transactions` collection doesn't exist in PocketBase.

**Solution:** Follow [Section 4](#4-create-collections) to create the collection.

### Error: "Failed to authenticate"

**Cause:** User doesn't exist or password is incorrect.

**Solution:**
1. Go to PocketBase Admin
2. Check if user exists in `users` collection
3. Verify password or create new user

### Error: "Failed to save to backend"

**Cause:** API rules are not set correctly or user is not authenticated.

**Solution:**
1. Verify API rules in collection settings
2. Make sure you're logged in before adding expenses

### Container won't start

**Cause:** Port 8090 is already in use.

**Solution:**
```bash
# Check what's using port 8090
netstat -ano | findstr :8090

# Or reset PocketBase
docker-compose -f docker-compose.pb.yml down
rm -rf pb_data
docker-compose -f docker-compose.pb.yml up -d
```

---

## Quick Reference

### URLs

| Service | URL |
|---------|-----|
| Wallet App | http://localhost:3000 |
| PocketBase Admin | http://localhost:8090/_/ |
| PocketBase API | http://localhost:8090/api/ |

### Default Credentials

| Account | Email | Password |
|---------|-------|----------|
| PocketBase Admin | admin@wallet.com | admin123456 |
| Test User | test@wallet.com | test123456 |

### Docker Commands

```bash
# Start PocketBase
docker-compose -f docker-compose.pb.yml up -d

# Stop PocketBase
docker-compose -f docker-compose.pb.yml down

# View logs
docker-compose -f docker-compose.pb.yml logs -f

# Reset PocketBase (deletes all data)
docker-compose -f docker-compose.pb.yml down
rm -rf pb_data
docker-compose -f docker-compose.pb.yml up -d
```

### NPM Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Local Development                        │
│                                                             │
│  ┌─────────────────┐         ┌─────────────────┐          │
│  │   Next.js App   │         │   PocketBase    │          │
│  │   :3000         │ ──────► │   :8090         │          │
│  │                 │         │                 │          │
│  │  API Routes:    │         │  Collections:   │          │
│  │  /api/auth/*    │         │  - users        │          │
│  │  /api/transactions    │         │  - transactions │          │
│  └─────────────────┘         └─────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Support

If you encounter any issues:

1. Check the [Troubleshooting](#7-troubleshooting) section
2. Check browser console for errors
3. Check PocketBase logs: `docker-compose -f docker-compose.pb.yml logs -f`
4. Create an issue on GitHub: https://github.com/winyannainghtut/wallet/issues
