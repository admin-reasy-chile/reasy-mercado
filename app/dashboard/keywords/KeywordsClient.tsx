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
    <div className="min-h-screen bg-[oklch(0.97_0.005_240)]">
      {/* Topbar */}
      <header className="sticky top-0 z-30 bg-white border-b border-[oklch(0.90_0.008_240)] px-6 py-3">
        <div className="max-w-screen-xl mx-auto flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-[oklch(0.55_0.008_240)] hover:text-[oklch(0.30_0.010_240)] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Volver</span>
          </button>
          <span className="font-semibold text-[oklch(0.22_0.08_240)]">REASY</span>
          <span className="text-xs text-[oklch(0.60_0.008_240)]">/ Palabras clave</span>
          <div className="flex-1" />
          <span className="text-xs text-[oklch(0.55_0.008_240)] hidden sm:block">{userName}</span>
          <button onClick={handleLogout}
            className="text-xs text-[oklch(0.60_0.008_240)] hover:text-[oklch(0.35_0.010_240)] transition-colors">
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
        <div className="bg-white rounded-xl border border-[oklch(0.90_0.008_240)] p-5">
          <p className="text-xs font-medium text-[oklch(0.50_0.008_240)] uppercase tracking-wide mb-3">
            Agregar palabra clave
          </p>
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="text"
              value={nueva}
              onChange={e => { setNueva(e.target.value); setError('') }}
              placeholder="ej: gestión de desechos"
              className="flex-1 px-3 py-2 rounded-lg border border-[oklch(0.85_0.010_240)] bg-[oklch(0.98_0.004_240)] text-sm text-[oklch(0.25_0.010_240)] placeholder:text-[oklch(0.65_0.008_240)] focus:outline-none focus:border-[oklch(0.55_0.14_240)] focus:ring-2 focus:ring-[oklch(0.55_0.14_240)]/20 transition-colors"
            />
            <button
              type="submit"
              disabled={adding || !nueva.trim()}
              className="px-4 py-2 rounded-lg bg-[oklch(0.48_0.14_240)] hover:bg-[oklch(0.43_0.14_240)] text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {adding ? 'Agregando...' : 'Agregar'}
            </button>
          </form>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>

        {/* Lista activas */}
        <div className="bg-white rounded-xl border border-[oklch(0.90_0.008_240)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[oklch(0.91_0.008_240)] flex items-center justify-between">
            <p className="text-xs font-medium text-[oklch(0.50_0.008_240)] uppercase tracking-wide">
              Activas
            </p>
            <span className="text-xs font-semibold text-emerald-600">{activas.length}</span>
          </div>
          {loading ? (
            <p className="text-sm text-[oklch(0.60_0.008_240)] p-5">Cargando...</p>
          ) : activas.length === 0 ? (
            <p className="text-sm text-[oklch(0.60_0.008_240)] p-5">No hay palabras clave activas.</p>
          ) : (
            <ul className="divide-y divide-[oklch(0.93_0.006_240)]">
              {activas.map(kw => (
                <li key={kw.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="flex-1 text-sm text-[oklch(0.28_0.010_240)] font-mono">{kw.palabra}</span>
                  <button
                    onClick={() => handleToggle(kw)}
                    className="text-xs text-[oklch(0.60_0.008_240)] hover:text-amber-600 transition-colors px-2 py-1 rounded hover:bg-amber-50"
                  >
                    Pausar
                  </button>
                  <button
                    onClick={() => handleDelete(kw)}
                    className="text-xs text-[oklch(0.60_0.008_240)] hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
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
          <div className="bg-white rounded-xl border border-[oklch(0.90_0.008_240)] overflow-hidden">
            <div className="px-5 py-3 border-b border-[oklch(0.91_0.008_240)] flex items-center justify-between">
              <p className="text-xs font-medium text-[oklch(0.50_0.008_240)] uppercase tracking-wide">
                Pausadas
              </p>
              <span className="text-xs font-semibold text-[oklch(0.60_0.008_240)]">{inactivas.length}</span>
            </div>
            <ul className="divide-y divide-[oklch(0.93_0.006_240)]">
              {inactivas.map(kw => (
                <li key={kw.id} className="flex items-center gap-3 px-5 py-3 opacity-50">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0" />
                  <span className="flex-1 text-sm text-[oklch(0.50_0.008_240)] font-mono line-through">{kw.palabra}</span>
                  <button
                    onClick={() => handleToggle(kw)}
                    className="text-xs text-[oklch(0.60_0.008_240)] hover:text-emerald-600 transition-colors px-2 py-1 rounded hover:bg-emerald-50 no-underline opacity-100"
                    style={{ textDecoration: 'none' }}
                  >
                    Activar
                  </button>
                  <button
                    onClick={() => handleDelete(kw)}
                    className="text-xs text-[oklch(0.60_0.008_240)] hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50 opacity-100"
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
