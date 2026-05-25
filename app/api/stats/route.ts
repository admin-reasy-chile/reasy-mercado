import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { DashboardStats } from '@/lib/types'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = supabaseAdmin()

  // Inicio del lunes de esta semana y el anterior
  const now = new Date()
  const dow = now.getDay()
  const mondayThis = new Date(now)
  mondayThis.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  mondayThis.setHours(0, 0, 0, 0)
  const mondayLast = new Date(mondayThis)
  mondayLast.setDate(mondayLast.getDate() - 7)

  const [
    { data: activas },
    { data: syncMeta },
    { count: nuevasEsta },
    { count: nuevasAnterior },
  ] = await Promise.all([
    db.from('licitaciones').select('semaforo, monto_estimado').eq('estado', 'publicada'),
    db.from('sync_log').select('created_at').order('created_at', { ascending: false }).limit(1).single(),
    db.from('licitaciones').select('*', { count: 'exact', head: true })
      .gte('created_at', mondayThis.toISOString()),
    db.from('licitaciones').select('*', { count: 'exact', head: true })
      .gte('created_at', mondayLast.toISOString())
      .lt('created_at', mondayThis.toISOString()),
  ])

  const stats: DashboardStats = {
    total_activas:        activas?.length ?? 0,
    urgentes:             activas?.filter(l => l.semaforo === 'urgente').length   ?? 0,
    proximas:             activas?.filter(l => l.semaforo === 'proximo').length   ?? 0,
    con_tiempo:           activas?.filter(l => l.semaforo === 'con_tiempo').length ?? 0,
    monto_total:          activas?.reduce((s, l) => s + (l.monto_estimado ?? 0), 0) ?? 0,
    ultima_sync:          syncMeta?.created_at ?? null,
    nuevas_esta_semana:   nuevasEsta   ?? 0,
    nuevas_semana_anterior: nuevasAnterior ?? 0,
  }

  return NextResponse.json({ data: stats })
}
