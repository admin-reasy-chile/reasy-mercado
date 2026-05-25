import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  // Acepta tanto sesión de usuario como API key para el cron de GitHub Actions
  const session = await getSession()
  const authHeader = req.headers.get('authorization')
  const cronKey = process.env.CRON_SECRET

  const authorized = session || (cronKey && authHeader === `Bearer ${cronKey}`)
  if (!authorized) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // En Vercel el sync lo hace el worker de Python via GitHub Actions.
  // Este endpoint sirve para trigger manual desde el dashboard.
  // Dispara el webhook de GitHub Actions si está configurado.
  const ghWebhook = process.env.GITHUB_DISPATCH_URL
  const ghToken   = process.env.GITHUB_TOKEN

  if (!ghWebhook || !ghToken) {
    return NextResponse.json({
      ok: false,
      message: 'Sync manual no configurado. El sync automático corre a las 9:00 AM.'
    })
  }

  const response = await fetch(ghWebhook, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ghToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ event_type: 'manual-sync' }),
  })

  if (!response.ok) {
    return NextResponse.json({ ok: false, message: 'Error disparando sync' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, message: 'Sync iniciado. Los datos se actualizarán en ~2 minutos.' })
}
