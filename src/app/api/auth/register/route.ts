import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'

export async function POST(request: NextRequest) {
  try {
    const { email, password, passwordConfirm, name } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
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
    const user = await pb.collection('users').create({
      email,
      password,
      passwordConfirm: passwordConfirm || password,
      name,
    })

    // Auto-login after registration
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

    // Set auth cookie
    response.cookies.set('pb_auth', pb.authStore.exportToCookie(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return response
  } catch (error: any) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: error.message || 'Registration failed' },
      { status: 400 }
    )
  }
}
