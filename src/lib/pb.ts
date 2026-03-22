import PocketBase from 'pocketbase'

// PocketBase URL - uses environment variable or defaults to localhost for development
// In production (K8s), this will be the internal service URL
// PocketBase URL configuration
// - Local dev: http://localhost:8090 (via docker-compose.pb.yml)
// - Production K8s: http://pocketbase-service.wallet-app.svc.cluster.local:8090
const pbUrl = process.env.POCKETBASE_URL || 'http://localhost:8090'

// Server-side PocketBase instance factory
// Creates a new instance for each request to avoid auth state leaking
export function createPbServer(authCookie?: string) {
  const pb = new PocketBase(pbUrl)
  if (authCookie) {
    try {
      pb.authStore.loadFromCookie(authCookie)
    } catch {
      // Invalid cookie, ignore
    }
  }
  return pb
}
