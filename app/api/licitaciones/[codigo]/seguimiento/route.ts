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
  return NextResponse.json({ data })
}
