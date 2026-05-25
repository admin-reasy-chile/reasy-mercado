import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabaseAdmin()
    .from('keywords')
    .select('*')
    .order('activa', { ascending: false })
    .order('palabra')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { palabra } = await req.json()
  if (!palabra?.trim()) return NextResponse.json({ error: 'Palabra requerida' }, { status: 400 })

  const { data, error } = await supabaseAdmin()
    .from('keywords')
    .insert({ palabra: palabra.trim().toLowerCase() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
