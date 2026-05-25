'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CRM_CONFIG, EstadoCRM } from '@/lib/types'

interface AnalyticsData {
  funnel: Record<EstadoCRM, number>
  winRate: number | null
  scorePromedio: number
  montoTotal: number
  totalActivas: number
  trendSemanal: { fecha: string; count: number }[]
  topOrganismos: { nombre: string; count: number }[]
}

function formatMonto(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function formatSemana(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

function ScoreRing({ value }: { value: number }) {
  const color = value >= 70 ? 'text-emerald-600' : value >= 40 ? 'text-amber-600' : 'text-[#5A7888]'
  return (
    <div className={`text-4xl font-bold ${color}`}>
      {value}
      <span className="text-lg font-normal text-[#6A8898]">/100</span>
    </div>
  )
}

export function AnalyticsClient({ userName }: { userName: string }) {
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null }
        return r.json()
      })
      .then(d => { if (d) { setData(d.data); setLoading(false) } })
  }, [router])

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EDF2F4] flex items-center justify-center">
        <p className="text-sm text-[#6A8898]">Cargando analytics...</p>
      </div>
    )
  }

  if (!data) return null

  const funnelOrden: EstadoCRM[] = ['nueva', 'en_analisis', 'postulada', 'ganada', 'descartada']
  const maxFunnel = Math.max(...funnelOrden.map(k => data.funnel[k] ?? 0), 1)
  const maxTrend = Math.max(...data.trendSemanal.map(s => s.count), 1)

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
          <span className="text-xs text-[#6A8898]">/ Analytics</span>
          <div className="flex-1" />
          <span className="text-xs text-[#5A7888] hidden sm:block">{userName}</span>
          <button onClick={handleLogout}
            className="text-xs text-[#6A8898] hover:text-[#1E3E50] transition-colors">
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6 space-y-6">

        {/* KPIs top */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-[#D9E1E5] p-4">
            <p className="text-xs text-[#5A7888] mb-2">Score promedio</p>
            <ScoreRing value={data.scorePromedio} />
            <p className="text-xs text-[#7A9AAA] mt-1">de oportunidades activas</p>
          </div>

          <div className="bg-white rounded-xl border border-[#D9E1E5] p-4">
            <p className="text-xs text-[#5A7888] mb-2">Win rate</p>
            {data.winRate !== null ? (
              <>
                <div className={`text-4xl font-bold ${data.winRate >= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {data.winRate}
                  <span className="text-lg font-normal text-[#6A8898]">%</span>
                </div>
                <p className="text-xs text-[#7A9AAA] mt-1">
                  {data.funnel.ganada} ganadas · {data.funnel.descartada} descartadas
                </p>
              </>
            ) : (
              <>
                <div className="text-4xl font-bold text-[#9EB0BA]">—</div>
                <p className="text-xs text-[#7A9AAA] mt-1">Sin datos aún</p>
              </>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#D9E1E5] p-4">
            <p className="text-xs text-[#5A7888] mb-2">Monto total activo</p>
            <div className="text-4xl font-bold text-[#0A2233]">
              {formatMonto(data.montoTotal)}
            </div>
            <p className="text-xs text-[#7A9AAA] mt-1">CLP estimado</p>
          </div>

          <div className="bg-white rounded-xl border border-[#D9E1E5] p-4">
            <p className="text-xs text-[#5A7888] mb-2">En seguimiento</p>
            <div className="text-4xl font-bold text-[#0A2233]">
              {data.funnel.en_analisis + data.funnel.postulada}
            </div>
            <p className="text-xs text-[#7A9AAA] mt-1">
              {data.funnel.en_analisis} en análisis · {data.funnel.postulada} postuladas
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Funnel CRM */}
          <div className="bg-white rounded-xl border border-[#D9E1E5] p-5">
            <p className="text-xs font-medium text-[#4A6878] uppercase tracking-wide mb-4">
              Pipeline CRM
            </p>
            <div className="space-y-3">
              {funnelOrden.map(key => {
                const cfg = CRM_CONFIG[key]
                const count = data.funnel[key] ?? 0
                const pct = Math.round((count / maxFunnel) * 100)
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-sm font-semibold text-[#0A2233]">{count}</span>
                    </div>
                    <div className="h-2 bg-[#EAF0F3] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          key === 'ganada' ? 'bg-emerald-400' :
                          key === 'descartada' ? 'bg-neutral-300' :
                          key === 'postulada' ? 'bg-orange-400' :
                          key === 'en_analisis' ? 'bg-violet-400' : 'bg-blue-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tendencia semanal */}
          <div className="bg-white rounded-xl border border-[#D9E1E5] p-5">
            <p className="text-xs font-medium text-[#4A6878] uppercase tracking-wide mb-4">
              Nuevas licitaciones · últimas 8 semanas
            </p>
            <div className="flex items-end gap-1.5 h-32">
              {data.trendSemanal.map((s, i) => {
                const h = maxTrend > 0 ? Math.max(Math.round((s.count / maxTrend) * 100), s.count > 0 ? 8 : 0) : 0
                const isLast = i === data.trendSemanal.length - 1
                return (
                  <div key={s.fecha} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-[#5A7888]">{s.count || ''}</span>
                    <div
                      className={`w-full rounded-t transition-all duration-500 ${isLast ? 'bg-[#55B1BF]' : 'bg-[#BDC9CF]'}`}
                      style={{ height: `${h}%`, minHeight: s.count > 0 ? '4px' : '0' }}
                    />
                    <span className="text-[10px] text-[#7A9AAA] whitespace-nowrap">
                      {formatSemana(s.fecha)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Top organismos */}
        <div className="bg-white rounded-xl border border-[#D9E1E5] p-5">
          <p className="text-xs font-medium text-[#4A6878] uppercase tracking-wide mb-4">
            Organismos con más oportunidades activas
          </p>
          {data.topOrganismos.length === 0 ? (
            <p className="text-sm text-[#6A8898]">Sin datos aún.</p>
          ) : (
            <div className="space-y-3">
              {data.topOrganismos.map((org, i) => {
                const pct = Math.round((org.count / data.topOrganismos[0].count) * 100)
                return (
                  <div key={org.nombre} className="flex items-center gap-3">
                    <span className="text-xs text-[#7A9AAA] w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-[#0A2233] truncate pr-2">{org.nombre}</p>
                        <span className="text-xs font-semibold text-[#2C4E60] shrink-0">{org.count}</span>
                      </div>
                      <div className="h-1.5 bg-[#EAF0F3] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#55B1BF] rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
