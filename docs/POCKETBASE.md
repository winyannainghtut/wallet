# PocketBase Backend Setup

This document explains how to set up and use PocketBase as the backend for the Wallet App.

## Architecture

```
┌─────────────────┐     Cloudflare Tunnel     ┌─────────────────┐
│   Next.js App   │ ◄─────────────────────────►│   PocketBase    │
│   (Frontend)    │                            │   (Backend)     │
└─────────────────┘                            └─────────────────┘
        │                                              │
        │              MicroK8s Cluster                │
        └──────────────────────────────────────────────┘
```

## Prerequisites

1. MicroK8s cluster running
2. Cloudflare account with Tunnels enabled
3. `kubectl` configured to access your cluster

## Step 1: Deploy PocketBase to MicroK8s

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Deploy PocketBase
kubectl apply -f k8s/pocketbase-deployment.yaml
kubectl apply -f k8s/pocketbase-service.yaml

# Verify deployment
kubectl get pods -n wallet-app
kubectl get services -n wallet-app
```

## Step 2: Set Up Cloudflare Tunnel

1. Install `cloudflared` on your machine
2. Create a tunnel:

```bash
cloudflared tunnel create pocketbase
```

3. Configure the tunnel (`~/.cloudflared/config.yml`):

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: pb.yourdomain.com
    service: http://pocketbase-service.wallet-app.svc.cluster.local:8090
  - service: http_status:404
```

4. Create DNS record:

```bash
cloudflared tunnel route dns <TUNNEL_ID> pb.yourdomain.com
```

5. Run the tunnel:

```bash
cloudflared tunnel run pocketbase
```

## Step 3: Configure PocketBase

1. Access PocketBase admin UI: `https://pb.yourdomain.com/_/`
2. Create an admin account
3. Create the following collections:

### Users Collection (default)

The `users` collection is created by default. No changes needed.

### Transactions Collection

Create a new collection called `transactions` with the following fields:

| Field Name | Type | Options |
|------------|------|---------|
| user | relation | Collection: users, Required |
| type | select | Values: income, expense, Required |
| category | text | Required |
| amount | number | Required, Min: 0 |
| description | text | Required |
| date | date | Required |

**API Rules:**
- List/View: `user = @request.auth.id`
- Create: `user = @request.auth.id`
- Update: `user = @request.auth.id`
- Delete: `user = @request.auth.id`

### Budgets Collection (optional)

| Field Name | Type | Options |
|------------|------|---------|
| user | relation | Collection: users, Required |
| category | text | Required |
| amount | number | Required, Min: 0 |
| period | select | Values: weekly, monthly, Required |

**API Rules:** Same as transactions

### Subscriptions Collection (optional)

| Field Name | Type | Options |
|------------|------|---------|
| user | relation | Collection: users, Required |
| name | text | Required |
| amount | number | Required |
| category | text | Required |
| frequency | select | Values: daily, weekly, monthly, yearly |
| nextDueDate | date | Required |
| isActive | bool | Default: true |

**API Rules:** Same as transactions

## Step 4: Configure Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_POCKETBASE_URL=https://pb.yourdomain.com
```

## Step 5: Deploy Next.js App

```bash
# Build and deploy
kubectl apply -f k8s/deployment.yaml
```

## Usage in Code

### Client Components

```tsx
'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useTransactions } from '@/lib/use-transactions'

export default function MyComponent() {
  const { user, isAuthenticated } = useAuth()
  const { transactions, createTransaction, isLoading } = useTransactions()

  const handleAdd = async () => {
    await createTransaction({
      user: user.id,
      type: 'expense',
      category: 'groceries',
      amount: 50,
      description: 'Weekly groceries',
      date: new Date().toISOString().split('T')[0],
    })
  }

  if (!isAuthenticated) {
    return <div>Please log in</div>
  }

  return (
    <div>
      {transactions.map(t => (
        <div key={t.id}>{t.description}: ${t.amount}</div>
      ))}
      <button onClick={handleAdd}>Add Transaction</button>
    </div>
  )
}
```

### Server Components

```tsx
import { getTransactionsForServerComponent, isAuthenticatedServer } from '@/lib/server-transactions'
import { redirect } from 'next/navigation'

export default async function ReportsPage() {
  const isAuth = await isAuthenticatedServer()
  if (!isAuth) {
    redirect('/login')
  }

  const { items: transactions } = await getTransactionsForServerComponent({
    sort: '-date',
    perPage: 100,
  })

  return (
    <div>
      {transactions.map(t => (
        <div key={t.id}>{t.description}: ${t.amount}</div>
      ))}
    </div>
  )
}
```

## Token Storage

PocketBase automatically handles token storage:

- **Client-side**: Tokens are stored in `localStorage` under the key `pocketbase_auth`
- **Server-side**: Pass tokens via cookies for Server Components

The SDK automatically:
- Refreshes expired tokens
- Includes tokens in all API requests
- Clears tokens on logout

## Troubleshooting

### Connection Issues

1. Check Cloudflare Tunnel status:
```bash
cloudflared tunnel list
cloudflared tunnel info pocketbase
```

2. Check PocketBase pod logs:
```bash
kubectl logs -f deployment/pocketbase -n wallet-app
```

### Authentication Issues

1. Clear local storage and re-login
2. Check PocketBase admin UI for user status
3. Verify API rules are correctly set

### Data Not Syncing

1. Check real-time subscription in browser DevTools
2. Verify WebSocket connections are not blocked
3. Check Cloudflare Tunnel configuration for WebSocket support
