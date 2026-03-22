import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'

export async function GET(request: NextRequest) {
  const authCookie = request.cookies.get('pb_auth')?.value
  const pb = createPbServer(authCookie)

  if (!pb.authStore.isValid || !pb.authStore.model) {
    return NextResponse.json({ user: null })
  }

  return NextResponse.json({
    user: {
      id: pb.authStore.model.id,
      email: pb.authStore.model.email,
      name: pb.authStore.model.name,
    },
  })
}
