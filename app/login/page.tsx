'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (res.ok) {
      router.push('/dashboard')
      router.refresh()
    } else {
      setError('Email o contraseña incorrectos.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[oklch(0.97_0.005_240)]">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-2xl font-semibold tracking-tight text-[oklch(0.22_0.08_240)]">
              REASY
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[oklch(0.88_0.020_240)] text-[oklch(0.40_0.13_240)]">
              Mercado Público
            </span>
          </div>
          <p className="text-sm text-[oklch(0.50_0.010_240)]">
            Monitor de oportunidades REAS
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-xl border border-[oklch(0.88_0.010_240)] shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[oklch(0.30_0.010_240)] mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg border border-[oklch(0.85_0.010_240)] bg-[oklch(0.98_0.004_240)] text-sm text-[oklch(0.20_0.010_240)] placeholder:text-[oklch(0.65_0.008_240)] focus:outline-none focus:border-[oklch(0.55_0.14_240)] focus:ring-2 focus:ring-[oklch(0.55_0.14_240)]/20 transition-colors"
                placeholder="tu@reasy.cl"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[oklch(0.30_0.010_240)] mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-[oklch(0.85_0.010_240)] bg-[oklch(0.98_0.004_240)] text-sm text-[oklch(0.20_0.010_240)] focus:outline-none focus:border-[oklch(0.55_0.14_240)] focus:ring-2 focus:ring-[oklch(0.55_0.14_240)]/20 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 rounded-lg bg-[oklch(0.48_0.14_240)] hover:bg-[oklch(0.43_0.14_240)] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[oklch(0.65_0.008_240)] mt-6">
          Solo para el equipo REASY
        </p>
      </div>
    </div>
  )
}
