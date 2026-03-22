import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import { checkRegistrationAccess } from '@/lib/auth-policy'

export async function POST(request: NextRequest) {
  try {
    const { email, password, passwordConfirm, name } = await request.json()
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const access = checkRegistrationAccess(normalizedEmail)
    if (!access.allowed) {
      const message = access.reason === 'disabled'
        ? 'Registration is disabled. Contact your admin.'
        : 'This email is not allowed to register. Contact your admin.'

      return NextResponse.json(
        { error: message },
        { status: 403 }
      )
    }

    if (password !== passwordConfirm) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      )
    }

    const pb = createPbServer()

    // Create user
    await pb.collection('users').create({
      email: normalizedEmail,
      password,
      passwordConfirm: passwordConfirm || password,
      name,
    })

    // Auto-login after registration
    const authData = await pb.collection('users').authWithPassword(normalizedEmail, password)

    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: authData.record.id,
        email: authData.record.email,
        name: authData.record.name,
      },
    })

    // Set auth cookie
    response.cookies.set('pb_auth', pb.authStore.exportToCookie(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return response
  } catch (error: unknown) {
    const message =
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : 'Registration failed'

    console.error('Registration error:', error)
    return NextResponse.json(
      { error: message },
      { status: 400 }
    )
  }
}
