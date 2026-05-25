import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { DashboardStats } from '@/lib/types'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = supabaseAdmin()

  const { data: activas } = await db
    .from('licitaciones')
    .select('semaforo, monto_estimado')
    .eq('estado', 'publicada')

  const { data: syncMeta } = await db
    .from('sync_log')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const stats: DashboardStats = {
    total_activas: activas?.length ?? 0,
    urgentes:   activas?.filter(l => l.semaforo === 'urgente').length   ?? 0,
    proximas:   activas?.filter(l => l.semaforo === 'proximo').length   ?? 0,
    con_tiempo: activas?.filter(l => l.semaforo === 'con_tiempo').length ?? 0,
    monto_total: activas?.reduce((s, l) => s + (l.monto_estimado ?? 0), 0) ?? 0,
    ultima_sync: syncMeta?.created_at ?? null,
  }

  return NextResponse.json({ data: stats })
}
