import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_ROUTES = new Set(['/login'])

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.endsWith('/') && request.nextUrl.pathname !== '/'
    ? request.nextUrl.pathname.slice(0, -1)
    : request.nextUrl.pathname
  const isPublicRoute = PUBLIC_ROUTES.has(pathname)
  const hasAuthCookie = Boolean(request.cookies.get('pb_auth')?.value)

  if (!hasAuthCookie && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (hasAuthCookie && isPublicRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)'],
}
