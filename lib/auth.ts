import { cookies } from 'next/headers'

const USERS = [
  { email: process.env.USER1_EMAIL || '', password: process.env.USER1_PASSWORD || '', name: process.env.USER1_NAME || 'Usuario 1' },
  { email: process.env.USER2_EMAIL || '', password: process.env.USER2_PASSWORD || '', name: process.env.USER2_NAME || 'Usuario 2' },
  { email: process.env.USER3_EMAIL || '', password: process.env.USER3_PASSWORD || '', name: process.env.USER3_NAME || 'Usuario 3' },
].filter(u => u.email)

export function validateCredentials(email: string, password: string) {
  return USERS.find(u => u.email === email && u.password === password) || null
}

export async function getSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get('reasy_session')
  if (!session) return null
  try {
    return JSON.parse(Buffer.from(session.value, 'base64').toString()) as { email: string; name: string }
  } catch {
    return null
  }
}

export function createSessionToken(user: { email: string; name: string }) {
  return Buffer.from(JSON.stringify(user)).toString('base64')
}
