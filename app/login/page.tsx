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
    <div className="min-h-screen flex items-center justify-center bg-[#EDF2F4]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/logo-horizontal-dark..png"
            alt="REASY"
            className="h-10 mx-auto mb-4"
          />
          <p className="text-sm text-[#6A8898]">
            Monitor de oportunidades REAS
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-[#D9E1E5] shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#0A2233] mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg border border-[#D9E1E5] bg-[#F4F8FA] text-sm text-[#0A2233] placeholder:text-[#7A9AAA] focus:outline-none focus:border-[#55B1BF] focus:ring-2 focus:ring-[#55B1BF]/20 transition-colors"
                placeholder="tu@reasy.cl"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0A2233] mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-[#D9E1E5] bg-[#F4F8FA] text-sm text-[#0A2233] focus:outline-none focus:border-[#55B1BF] focus:ring-2 focus:ring-[#55B1BF]/20 transition-colors"
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
              className="btn-primary w-full py-2.5 rounded-lg bg-[#0A2233] hover:bg-[#051824] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#7A9AAA] mt-6">
          Solo para el equipo REASY
        </p>
      </div>
    </div>
  )
}
