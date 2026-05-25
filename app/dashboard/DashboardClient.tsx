'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Licitacion, DashboardStats, SemaforoEstado, EstadoCRM, SEMAFORO_CONFIG, CRM_CONFIG } from '@/lib/types'
import { SemaforoTag } from '@/components/SemaforoTag'
import { CRMBadge } from '@/components/CRMBadge'
import { MontoTag } from '@/components/MontoTag'
import { LicitacionDetail } from '@/components/LicitacionDetail'

interface Props {
  userName: string
}

interface ActividadEntry {
  id: number
  usuario: string | null
  accion: string
  valor_anterior: string | null
  valor_nuevo: string | null
  created_at: string
  licitacion_codigo: string
  licitaciones: { nombre: string; organismo: string } | null
}

function formatFecha(f: string | null) {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

function tiempoRelativo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `hace ${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

function exportarCSV(licitaciones: Licitacion[]) {
  const headers = ['Código', 'Nombre', 'Organismo', 'Región', 'Tipo', 'Semáforo', 'Fecha Cierre', 'Monto', 'Moneda', 'Estado CRM', 'Notas']
  const rows = licitaciones.map(l => [
    l.codigo,
    l.nombre,
    l.organismo,
    l.region,
    l.tipo,
    l.semaforo,
    l.fecha_cierre ?? '',
    l.monto_estimado ?? '',
    l.moneda ?? 'CLP',
    l.seguimiento?.estado_crm ?? '',
    l.seguimiento?.notas ?? '',
  ])
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reasy-licitaciones-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function formatUltimaSync(ts: string | null) {
  if (!ts) return 'Nunca sincronizado'
  const d = new Date(ts)
  return `Última sync: ${d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
}

const REGIONES = [
  'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo',
  'Valparaíso', 'Metropolitana de Santiago', "O'Higgins", 'Maule', 'Ñuble',
  'Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes',
]

export function DashboardClient({ userName }: Props) {
  const router = useRouter()
  const [licitaciones, setLicitaciones] = useState<Licitacion[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [selected, setSelected] = useState<Licitacion | null>(null)
  const [actividad, setActividad] = useState<ActividadEntry[]>([])

  // Filters
  const [filterSemaforo, setFilterSemaforo] = useState<SemaforoEstado | ''>('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterCRM, setFilterCRM] = useState<EstadoCRM | ''>('')
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ estado: 'publicada' })
    if (filterSemaforo) params.set('semaforo', filterSemaforo)
    if (filterRegion)   params.set('region', filterRegion)
    if (filterTipo)     params.set('tipo', filterTipo)
    if (filterCRM)      params.set('crm', filterCRM)

    const [licRes, statsRes] = await Promise.all([
      fetch(`/api/licitaciones?${params}`),
      fetch('/api/stats'),
    ])

    if (licRes.status === 401 || statsRes.status === 401) {
      router.push('/login')
      return
    }

    const [licData, statsData] = await Promise.all([licRes.json(), statsRes.json()])
    setLicitaciones(licData.data ?? [])
    setStats(statsData.data ?? null)
    setLoading(false)

    fetch('/api/actividad').then(r => r.json()).then(d => setActividad(d.data ?? []))
  }, [filterSemaforo, filterRegion, filterTipo, filterCRM, router])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSync() {
    setSyncing(true)
    setSyncMsg('')
    const res = await fetch('/api/sync', { method: 'POST' })
    const data = await res.json()
    setSyncMsg(data.message)
    setSyncing(false)
    if (data.ok) setTimeout(() => { fetchData(); setSyncMsg('') }, 3000)
  }

  async function handleCRMUpdate(codigo: string, update: { estado_crm?: EstadoCRM; notas?: string }) {
    await fetch(`/api/licitaciones/${codigo}/seguimiento`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    await fetchData()
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
  }

  const filtered = licitaciones.filter(l => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      l.nombre.toLowerCase().includes(q) ||
      l.organismo.toLowerCase().includes(q) ||
      l.codigo.toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen bg-[oklch(0.97_0.005_240)]">
      {/* Topbar */}
      <header className="sticky top-0 z-30 bg-white border-b border-[oklch(0.90_0.008_240)] px-6 py-3">
        <div className="max-w-screen-xl mx-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[oklch(0.22_0.08_240)]">REASY</span>
            <span className="text-xs text-[oklch(0.60_0.008_240)]">/ Oportunidades</span>
          </div>

          <div className="flex-1" />

          {/* Sync status */}
          <span className="text-xs text-[oklch(0.60_0.008_240)] hidden sm:block">
            {formatUltimaSync(stats?.ultima_sync ?? null)}
          </span>

          <button
            onClick={() => router.push('/dashboard/analytics')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[oklch(0.85_0.010_240)] text-xs font-medium text-[oklch(0.40_0.010_240)] hover:border-[oklch(0.70_0.010_240)] bg-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Analytics
          </button>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-sync flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[oklch(0.85_0.010_240)] text-xs font-medium text-[oklch(0.40_0.010_240)] hover:border-[oklch(0.70_0.010_240)] bg-white"
          >
            <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? 'Actualizando...' : 'Actualizar'}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[oklch(0.55_0.008_240)] hidden sm:block">{userName}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-[oklch(0.60_0.008_240)] hover:text-[oklch(0.35_0.010_240)] transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6">
        {/* Sync message */}
        {syncMsg && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
            {syncMsg}
          </div>
        )}

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Urgentes', value: stats.urgentes, semaforo: 'urgente' as SemaforoEstado, filter: 'urgente' },
              { label: 'Próximas', value: stats.proximas, semaforo: 'proximo' as SemaforoEstado, filter: 'proximo' },
              { label: 'Con tiempo', value: stats.con_tiempo, semaforo: 'con_tiempo' as SemaforoEstado, filter: 'con_tiempo' },
              { label: 'Total activas', value: stats.total_activas, semaforo: null, filter: '' },
            ].map(({ label, value, semaforo, filter }) => {
              const cfg = semaforo ? SEMAFORO_CONFIG[semaforo] : null
              const isActive = filterSemaforo === filter
              return (
                <button
                  key={label}
                  onClick={() => setFilterSemaforo(isActive ? '' : filter as SemaforoEstado | '')}
                  className={`text-left p-4 rounded-xl border transition-colors
                    ${isActive
                      ? `${cfg?.bg ?? 'bg-[oklch(0.94_0.010_240)]'} ${cfg?.border ?? 'border-[oklch(0.80_0.010_240)]'}`
                      : 'bg-white border-[oklch(0.90_0.008_240)] hover:border-[oklch(0.80_0.010_240)]'
                    }`}
                >
                  <p className={`text-2xl font-semibold mb-0.5 ${cfg?.color ?? 'text-[oklch(0.22_0.08_240)]'}`}>
                    {value}
                  </p>
                  <p className="text-xs text-[oklch(0.55_0.008_240)]">{label}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* Resumen semanal */}
        {stats && (
          <div className="flex items-center gap-3 mb-5 px-4 py-3 bg-white rounded-xl border border-[oklch(0.90_0.008_240)]">
            <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.55_0.14_240)]" />
            <span className="text-xs font-medium text-[oklch(0.40_0.010_240)]">Esta semana</span>
            <span className="text-sm font-semibold text-[oklch(0.22_0.08_240)]">
              {stats.nuevas_esta_semana} nuevas licitaciones
            </span>
            <span className="text-xs text-[oklch(0.60_0.008_240)]">·</span>
            {stats.nuevas_esta_semana === stats.nuevas_semana_anterior ? (
              <span className="text-xs text-[oklch(0.55_0.008_240)]">igual que la semana anterior</span>
            ) : stats.nuevas_esta_semana > stats.nuevas_semana_anterior ? (
              <span className="text-xs text-emerald-600 font-medium">
                ↑ {stats.nuevas_esta_semana - stats.nuevas_semana_anterior} más que la semana anterior
              </span>
            ) : (
              <span className="text-xs text-[oklch(0.55_0.008_240)]">
                ↓ {stats.nuevas_semana_anterior - stats.nuevas_esta_semana} menos que la semana anterior
              </span>
            )}
            <span className="text-xs text-[oklch(0.70_0.008_240)] ml-auto">
              sem. anterior: {stats.nuevas_semana_anterior}
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar organismo, nombre..."
            className="px-3 py-1.5 rounded-lg border border-[oklch(0.85_0.010_240)] bg-white text-sm text-[oklch(0.25_0.010_240)] placeholder:text-[oklch(0.65_0.008_240)] focus:outline-none focus:border-[oklch(0.55_0.14_240)] focus:ring-2 focus:ring-[oklch(0.55_0.14_240)]/20 transition-colors w-56"
          />

          <select
            value={filterRegion}
            onChange={e => setFilterRegion(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[oklch(0.85_0.010_240)] bg-white text-sm text-[oklch(0.35_0.010_240)] focus:outline-none focus:border-[oklch(0.55_0.14_240)] transition-colors"
          >
            <option value="">Todas las regiones</option>
            {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <select
            value={filterTipo}
            onChange={e => setFilterTipo(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[oklch(0.85_0.010_240)] bg-white text-sm text-[oklch(0.35_0.010_240)] focus:outline-none focus:border-[oklch(0.55_0.14_240)] transition-colors"
          >
            <option value="">Todos los tipos</option>
            {['L1', 'LE', 'LP', 'LQ', 'LR'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <select
            value={filterCRM}
            onChange={e => setFilterCRM(e.target.value as EstadoCRM | '')}
            className="px-3 py-1.5 rounded-lg border border-[oklch(0.85_0.010_240)] bg-white text-sm text-[oklch(0.35_0.010_240)] focus:outline-none focus:border-[oklch(0.55_0.14_240)] transition-colors"
          >
            <option value="">Todos los estados CRM</option>
            {(Object.entries(CRM_CONFIG) as [EstadoCRM, { label: string; color: string }][]).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>

          {(filterSemaforo || filterRegion || filterTipo || filterCRM || search) && (
            <button
              onClick={() => { setFilterSemaforo(''); setFilterRegion(''); setFilterTipo(''); setFilterCRM(''); setSearch('') }}
              className="px-3 py-1.5 text-xs text-[oklch(0.55_0.008_240)] hover:text-[oklch(0.30_0.010_240)] transition-colors"
            >
              Limpiar filtros
            </button>
          )}

          <span className="ml-auto text-xs text-[oklch(0.60_0.008_240)]">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </span>

          <button
            onClick={() => exportarCSV(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[oklch(0.85_0.010_240)] bg-white text-xs font-medium text-[oklch(0.40_0.010_240)] hover:border-[oklch(0.70_0.010_240)] disabled:opacity-40 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar CSV
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[oklch(0.90_0.008_240)] overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-[oklch(0.60_0.008_240)]">
              Cargando licitaciones...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-[oklch(0.55_0.008_240)]">No hay licitaciones activas con los filtros aplicados.</p>
              <p className="text-xs text-[oklch(0.65_0.008_240)] mt-1">
                El sync automático corre a las 9:00 AM.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[oklch(0.91_0.008_240)] bg-[oklch(0.97_0.005_240)]">
                    {['Score', 'Estado', 'Organismo', 'Región', 'Licitación', 'Cierre', 'Monto', 'CRM'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[oklch(0.50_0.008_240)] whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[oklch(0.93_0.006_240)]">
                  {filtered.map(lic => (
                    <tr
                      key={lic.codigo}
                      className={`licitacion-row ${lic.semaforo === 'urgente' ? 'bg-red-50/50' : ''}`}
                      onClick={() => setSelected(lic)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {lic.score != null ? (
                          <span className={`text-xs font-bold tabular-nums ${
                            lic.score >= 70 ? 'text-emerald-600' :
                            lic.score >= 40 ? 'text-amber-600' :
                            'text-[oklch(0.60_0.008_240)]'
                          }`}>
                            {lic.score}
                          </span>
                        ) : <span className="text-xs text-[oklch(0.75_0.008_240)]">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <SemaforoTag estado={lic.semaforo} diasRestantes={lic.dias_restantes} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[oklch(0.22_0.010_240)] truncate max-w-[220px]">{lic.organismo}</p>
                        <p className="text-xs text-[oklch(0.60_0.008_240)] font-mono mt-0.5">{lic.codigo}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-[oklch(0.45_0.008_240)] whitespace-nowrap">
                        {lic.region?.replace('Metropolitana de Santiago', 'Metropolitana') ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[oklch(0.30_0.010_240)] line-clamp-2 max-w-xs leading-snug">
                          {lic.nombre}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-[oklch(0.40_0.008_240)]">
                        {formatFecha(lic.fecha_cierre)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <MontoTag monto={lic.monto_estimado} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {lic.seguimiento?.estado_crm && (
                          <CRMBadge estado={lic.seguimiento.estado_crm} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

        {/* Actividad reciente */}
        {actividad.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-medium text-[oklch(0.50_0.008_240)] uppercase tracking-wide mb-3">
              Actividad reciente del equipo
            </p>
            <div className="bg-white rounded-xl border border-[oklch(0.90_0.008_240)] divide-y divide-[oklch(0.93_0.006_240)]">
              {actividad.slice(0, 8).map(entry => (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-6 h-6 rounded-full bg-[oklch(0.92_0.010_240)] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-[oklch(0.45_0.010_240)]">
                      {(entry.usuario ?? 'S')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[oklch(0.35_0.010_240)]">
                      <span className="font-medium">{entry.usuario ?? 'Sistema'}</span>
                      {entry.accion === 'estado_crm' ? (
                        <> marcó como <span className={`font-medium ${CRM_CONFIG[entry.valor_nuevo as EstadoCRM]?.color ?? ''}`}>
                          {CRM_CONFIG[entry.valor_nuevo as EstadoCRM]?.label ?? entry.valor_nuevo}
                        </span></>
                      ) : (
                        <> actualizó las notas</>
                      )}
                    </p>
                    <p className="text-xs text-[oklch(0.60_0.008_240)] truncate mt-0.5">
                      {entry.licitaciones?.organismo ?? entry.licitacion_codigo}
                    </p>
                  </div>
                  <span className="text-xs text-[oklch(0.65_0.008_240)] shrink-0">
                    {tiempoRelativo(entry.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Detail panel */}
      {selected && (
        <LicitacionDetail
          licitacion={selected}
          onClose={() => setSelected(null)}
          onUpdate={async (codigo, data) => {
            await handleCRMUpdate(codigo, data)
            setSelected(prev => prev ? { ...prev, seguimiento: { ...prev.seguimiento, ...data } as any } : null)
          }}
        />
      )}
    </div>
  )
}
