import PocketBase from 'pocketbase'

// PocketBase URL configuration
// - Client-side: uses NEXT_PUBLIC_POCKETBASE_URL (Cloudflare Tunnel URL)
// - Server-side: uses POCKETBASE_URL (internal K8s service URL) or falls back to public URL

const getClientUrl = () => {
  return process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090'
}

const getServerUrl = () => {
  return process.env.POCKETBASE_URL || process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090'
}

// Singleton pattern for PocketBase client
let pbClient: PocketBase | null = null
let pbServer: PocketBase | null = null

/**
 * Get PocketBase client instance for browser/client-side usage
 * Uses the public Cloudflare Tunnel URL
 */
export function getPocketBaseClient(): PocketBase {
  if (!pbClient) {
    pbClient = new PocketBase(getClientUrl())
    // Auto-refresh token when expired
    pbClient.authStore.onChange(() => {
      // Sync auth state with your app state if needed
      console.log('Auth store changed')
    })
  }
  return pbClient
}

/**
 * Get PocketBase server instance for server-side usage
 * Uses internal K8s service URL for faster internal communication
 */
export function getPocketBaseServer(authToken?: string): PocketBase {
  if (!pbServer) {
    pbServer = new PocketBase(getServerUrl())
  }

  // Set auth token if provided (for server-side requests with user context)
  if (authToken) {
    pbServer.authStore.save(authToken, null)
  }

  return pbServer
}

/**
 * Reset PocketBase instances (useful for testing or logout)
 */
export function resetPocketBase(): void {
  pbClient = null
  pbServer = null
}

// Export default client for convenience
export default getPocketBaseClient
