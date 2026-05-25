import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const estado   = searchParams.get('estado') || 'publicada'
  const semaforo = searchParams.get('semaforo')
  const region   = searchParams.get('region')
  const tipo     = searchParams.get('tipo')
  const crm      = searchParams.get('crm')

  const db = supabaseAdmin()

  let query = db
    .from('licitaciones')
    .select(`*, seguimiento(*)`)
    .eq('estado', estado)
    .order('dias_restantes', { ascending: true, nullsFirst: false })

  if (semaforo) query = query.eq('semaforo', semaforo)
  if (region)   query = query.eq('region', region)
  if (tipo)     query = query.eq('tipo', tipo)

  // Filtro por estado CRM: busca los codigos con ese estado en seguimiento
  if (crm) {
    const { data: segs } = await db
      .from('seguimiento')
      .select('licitacion_codigo')
      .eq('estado_crm', crm)

    const codigos = segs?.map(s => s.licitacion_codigo) ?? []
    if (codigos.length === 0) return NextResponse.json({ data: [] })
    query = query.in('codigo', codigos)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
