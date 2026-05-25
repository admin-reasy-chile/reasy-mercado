import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = supabaseAdmin()

  // Últimas 8 semanas — inicio del lunes más antiguo
  const now = new Date()
  const dow = now.getDay()
  const mondayThis = new Date(now)
  mondayThis.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  mondayThis.setHours(0, 0, 0, 0)
  const desde8Semanas = new Date(mondayThis)
  desde8Semanas.setDate(desde8Semanas.getDate() - 7 * 7)

  const [
    { data: seguimientos },
    { data: licitacionesActivas },
    { data: todasLicitaciones },
    { data: topOrganismos },
  ] = await Promise.all([
    // Funnel CRM
    db.from('seguimiento').select('estado_crm'),

    // Score distribution (activas)
    db.from('licitaciones')
      .select('score, semaforo, monto_estimado, region, tipo')
      .eq('estado', 'publicada')
      .order('score', { ascending: false }),

    // Trend semanal (últimas 8 semanas)
    db.from('licitaciones')
      .select('created_at')
      .gte('created_at', desde8Semanas.toISOString()),

    // Top organismos (activas)
    db.from('licitaciones')
      .select('organismo')
      .eq('estado', 'publicada'),
  ])

  // Funnel CRM
  const funnel = { nueva: 0, en_analisis: 0, postulada: 0, ganada: 0, descartada: 0 }
  for (const s of seguimientos ?? []) {
    const k = s.estado_crm as keyof typeof funnel
    if (k in funnel) funnel[k]++
  }

  // Win rate
  const totalTerminadas = funnel.ganada + funnel.descartada
  const winRate = totalTerminadas > 0 ? Math.round((funnel.ganada / totalTerminadas) * 100) : null

  // Score distribution
  const activas = licitacionesActivas ?? []
  const scorePromedio = activas.length > 0
    ? Math.round(activas.reduce((s, l) => s + (l.score ?? 0), 0) / activas.length)
    : 0
  const topScore = activas.slice(0, 5)

  // Monto total activas
  const montoTotal = activas.reduce((s, l) => s + (l.monto_estimado ?? 0), 0)

  // Trend semanal — agrupar por semana
  const semanas: Record<string, number> = {}
  for (let i = 7; i >= 0; i--) {
    const lunes = new Date(mondayThis)
    lunes.setDate(lunes.getDate() - 7 * i)
    const key = lunes.toISOString().slice(0, 10)
    semanas[key] = 0
  }
  for (const l of todasLicitaciones ?? []) {
    const d = new Date(l.created_at)
    const dow2 = d.getDay()
    const lunes = new Date(d)
    lunes.setDate(d.getDate() - (dow2 === 0 ? 6 : dow2 - 1))
    lunes.setHours(0, 0, 0, 0)
    const key = lunes.toISOString().slice(0, 10)
    if (key in semanas) semanas[key]++
  }
  const trendSemanal = Object.entries(semanas).map(([fecha, count]) => ({ fecha, count }))

  // Top organismos
  const orgCount: Record<string, number> = {}
  for (const l of topOrganismos ?? []) {
    if (l.organismo) orgCount[l.organismo] = (orgCount[l.organismo] ?? 0) + 1
  }
  const topOrg = Object.entries(orgCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([nombre, count]) => ({ nombre, count }))

  return NextResponse.json({
    data: {
      funnel,
      winRate,
      scorePromedio,
      montoTotal,
      trendSemanal,
      topOrganismos: topOrg,
      totalActivas: activas.length,
    }
  })
}
