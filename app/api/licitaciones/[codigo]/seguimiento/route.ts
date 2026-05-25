import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { EstadoCRM } from '@/lib/types'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { codigo } = await params
  const body = await req.json() as { estado_crm?: EstadoCRM; notas?: string }

  const db = supabaseAdmin()

  // Estado anterior para el log
  const { data: anterior } = await db
    .from('seguimiento')
    .select('estado_crm, notas')
    .eq('licitacion_codigo', codigo)
    .single()

  const { data, error } = await db
    .from('seguimiento')
    .upsert(
      {
        licitacion_codigo: codigo,
        estado_crm: body.estado_crm,
        notas: body.notas,
        usuario: session.name,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'licitacion_codigo' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Registrar cambios en el log
  const logs: object[] = []
  if (body.estado_crm && body.estado_crm !== anterior?.estado_crm) {
    logs.push({
      licitacion_codigo: codigo,
      usuario: session.name,
      accion: 'estado_crm',
      valor_anterior: anterior?.estado_crm ?? null,
      valor_nuevo: body.estado_crm,
    })
  }
  if (body.notas !== undefined && body.notas !== anterior?.notas) {
    logs.push({
      licitacion_codigo: codigo,
      usuario: session.name,
      accion: 'notas',
      valor_anterior: anterior?.notas ?? null,
      valor_nuevo: body.notas,
    })
  }
  if (logs.length > 0) {
    await db.from('seguimiento_log').insert(logs)
  }

  return NextResponse.json({ data })
}
