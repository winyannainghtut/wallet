import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'

type PocketBaseLikeError = {
  status?: number
  message?: string
}

function isInvalidCredentialsError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  const status = 'status' in error ? (error as PocketBaseLikeError).status : undefined
  const message = 'message' in error ? (error as PocketBaseLikeError).message : undefined

  return status === 400 && message === 'Failed to authenticate.'
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as PocketBaseLikeError).message
    if (typeof message === 'string' && message.length > 0) {
      return message
    }
  }
  return fallback
}

async function isSuperuserCredentials(email: string, password: string): Promise<boolean> {
  const pb = createPbServer()

  try {
    await pb.collection('_superusers').authWithPassword(email, password)
    return true
  } catch {
    return false
  } finally {
    pb.authStore.clear()
  }
}

export async function POST(request: NextRequest) {
  let email = ''
  let password = ''

  try {
    const payload = await request.json()
    email = payload?.email || ''
    password = payload?.password || ''

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const pb = createPbServer()

    // Authenticate with PocketBase
    const authData = await pb.collection('users').authWithPassword(email, password)

    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: authData.record.id,
        email: authData.record.email,
        name: authData.record.name,
      },
    })

    // Set auth cookie (httpOnly for security)
    response.cookies.set('pb_auth', pb.authStore.exportToCookie(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 3, // 3 days (client-side inactivity logout at 2 days)
    })

    return response
  } catch (error: unknown) {
    console.error('Login error:', error)

    if (isInvalidCredentialsError(error)) {
      const superuserMatched = await isSuperuserCredentials(email, password)
      if (superuserMatched) {
        return NextResponse.json(
          {
            error: 'This is a PocketBase superuser account. For app login, use Register to create a normal user account first.',
          },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { error: 'Invalid email or password. If this is your first login, create an account from Register.' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: getErrorMessage(error, 'Login failed') },
      { status: 500 }
    )
  }
}
