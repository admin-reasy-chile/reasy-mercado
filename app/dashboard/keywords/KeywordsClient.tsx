'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Keyword {
  id: number
  palabra: string
  activa: boolean
  created_at: string
}

export function KeywordsClient({ userName }: { userName: string }) {
  const router = useRouter()
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(true)
  const [nueva, setNueva] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function cargar() {
    const res = await fetch('/api/keywords')
    if (res.status === 401) { router.push('/login'); return }
    const data = await res.json()
    setKeywords(data.data ?? [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!nueva.trim()) return
    setAdding(true)
    setError('')
    const res = await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ palabra: nueva }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error?.includes('unique') ? 'Esa palabra ya existe.' : data.error)
    } else {
      setNueva('')
      await cargar()
    }
    setAdding(false)
  }

  async function handleToggle(kw: Keyword) {
    await fetch(`/api/keywords/${kw.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activa: !kw.activa }),
    })
    await cargar()
  }

  async function handleDelete(kw: Keyword) {
    await fetch(`/api/keywords/${kw.id}`, { method: 'DELETE' })
    await cargar()
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
  }

  const activas   = keywords.filter(k => k.activa)
  const inactivas = keywords.filter(k => !k.activa)

  return (
    <div className="min-h-screen bg-[#EDF2F4]">
      {/* Topbar */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#D9E1E5] px-6 py-3">
        <div className="max-w-screen-xl mx-auto flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-[#5A7888] hover:text-[#0A2233] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Volver</span>
          </button>
          <span className="font-semibold text-[#0A2233]">REASY</span>
          <span className="text-xs text-[#6A8898]">/ Palabras clave</span>
          <div className="flex-1" />
          <span className="text-xs text-[#5A7888] hidden sm:block">{userName}</span>
          <button onClick={handleLogout}
            className="text-xs text-[#6A8898] hover:text-[#1E3E50] transition-colors">
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Explicación */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-xs font-medium text-blue-800 mb-1">¿Cómo funciona?</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            El sync diario busca todas las licitaciones publicadas en Mercado Público y filtra
            las que contengan alguna de estas palabras en el nombre o descripción.
            Los cambios se aplican en el próximo sync (9:00 AM) o al hacer sync manual.
          </p>
        </div>

        {/* Agregar */}
        <div className="bg-white rounded-xl border border-[#D9E1E5] p-5">
          <p className="text-xs font-medium text-[#4A6878] uppercase tracking-wide mb-3">
            Agregar palabra clave
          </p>
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="text"
              value={nueva}
              onChange={e => { setNueva(e.target.value); setError('') }}
              placeholder="ej: gestión de desechos"
              className="flex-1 px-3 py-2 rounded-lg border border-[#BDC9CF] bg-[#F4F8FA] text-sm text-[#0A2233] placeholder:text-[#7A9AAA] focus:outline-none focus:border-[#55B1BF] focus:ring-2 focus:ring-[#55B1BF]/20 transition-colors"
            />
            <button
              type="submit"
              disabled={adding || !nueva.trim()}
              className="px-4 py-2 rounded-lg bg-[#55B1BF] hover:bg-[#3D9AA8] text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {adding ? 'Agregando...' : 'Agregar'}
            </button>
          </form>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>

        {/* Lista activas */}
        <div className="bg-white rounded-xl border border-[#D9E1E5] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#D9E1E5] flex items-center justify-between">
            <p className="text-xs font-medium text-[#4A6878] uppercase tracking-wide">
              Activas
            </p>
            <span className="text-xs font-semibold text-emerald-600">{activas.length}</span>
          </div>
          {loading ? (
            <p className="text-sm text-[#6A8898] p-5">Cargando...</p>
          ) : activas.length === 0 ? (
            <p className="text-sm text-[#6A8898] p-5">No hay palabras clave activas.</p>
          ) : (
            <ul className="divide-y divide-[#E8EEF1]">
              {activas.map(kw => (
                <li key={kw.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="flex-1 text-sm text-[#0A2233] font-mono">{kw.palabra}</span>
                  <button
                    onClick={() => handleToggle(kw)}
                    className="text-xs text-[#6A8898] hover:text-amber-600 transition-colors px-2 py-1 rounded hover:bg-amber-50"
                  >
                    Pausar
                  </button>
                  <button
                    onClick={() => handleDelete(kw)}
                    className="text-xs text-[#6A8898] hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Lista inactivas */}
        {inactivas.length > 0 && (
          <div className="bg-white rounded-xl border border-[#D9E1E5] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#D9E1E5] flex items-center justify-between">
              <p className="text-xs font-medium text-[#4A6878] uppercase tracking-wide">
                Pausadas
              </p>
              <span className="text-xs font-semibold text-[#6A8898]">{inactivas.length}</span>
            </div>
            <ul className="divide-y divide-[#E8EEF1]">
              {inactivas.map(kw => (
                <li key={kw.id} className="flex items-center gap-3 px-5 py-3 opacity-50">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0" />
                  <span className="flex-1 text-sm text-[#4A6878] font-mono line-through">{kw.palabra}</span>
                  <button
                    onClick={() => handleToggle(kw)}
                    className="text-xs text-[#6A8898] hover:text-emerald-600 transition-colors px-2 py-1 rounded hover:bg-emerald-50 no-underline opacity-100"
                    style={{ textDecoration: 'none' }}
                  >
                    Activar
                  </button>
                  <button
                    onClick={() => handleDelete(kw)}
                    className="text-xs text-[#6A8898] hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50 opacity-100"
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}
