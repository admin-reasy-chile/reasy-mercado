import { NextRequest, NextResponse } from 'next/server'
import { validateCredentials, createSessionToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  const user = validateCredentials(email, password)
  if (!user) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
  }

  const token = createSessionToken({ email: user.email, name: user.name })
  const res = NextResponse.json({ ok: true, name: user.name })

  res.cookies.set('reasy_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 días
    path: '/',
  })

  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('reasy_session')
  return res
}
