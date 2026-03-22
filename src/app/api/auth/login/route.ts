import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

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
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return response
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 401 }
    )
  }
}
