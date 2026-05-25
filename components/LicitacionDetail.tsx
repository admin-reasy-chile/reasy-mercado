'use client'

import { useState, useEffect } from 'react'
import { Licitacion, EstadoCRM, CRM_CONFIG, TIPO_CONFIG } from '@/lib/types'
import { SemaforoTag } from './SemaforoTag'

interface Props {
  licitacion: Licitacion
  onClose: () => void
  onUpdate: (codigo: string, data: { estado_crm?: EstadoCRM; notas?: string }) => Promise<void>
}

interface LogEntry {
  id: number
  usuario: string | null
  accion: string
  valor_anterior: string | null
  valor_nuevo: string | null
  created_at: string
}

function diasRestantesRealtime(fechaCierre: string | null): number | null {
  if (!fechaCierre) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const cierre = new Date(fechaCierre)
  cierre.setHours(0, 0, 0, 0)
  return Math.floor((cierre.getTime() - hoy.getTime()) / 86400000)
}

function semaforoRealtime(dias: number | null): 'urgente' | 'proximo' | 'con_tiempo' | 'cerrada' | 'sin_fecha' {
  if (dias === null) return 'sin_fecha'
  if (dias < 0) return 'cerrada'
  if (dias <= 5) return 'urgente'
  if (dias <= 15) return 'proximo'
  return 'con_tiempo'
}

function formatFecha(f: string | null) {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatFechaHora(f: string) {
  const d = new Date(f)
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function formatMonto(monto: number, moneda: string | null) {
  const m = moneda || 'CLP'
  if (m === 'CLP') return `$${monto.toLocaleString('es-CL')} CLP`
  return `${monto.toLocaleString('es-CL')} ${m}`
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="bg-[oklch(0.97_0.005_240)] rounded-lg px-3 py-2.5">
      <p className="text-xs text-[oklch(0.60_0.008_240)] mb-0.5">{label}</p>
      <div className="text-sm font-medium text-[oklch(0.22_0.010_240)]">{value}</div>
    </div>
  )
}

function LogLabel({ accion, valor }: { accion: string; valor: string | null }) {
  if (accion === 'estado_crm' && valor) {
    const cfg = CRM_CONFIG[valor as EstadoCRM]
    if (cfg) return <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.color}`}>{cfg.label}</span>
  }
  if (accion === 'notas') {
    return <span className="text-xs text-[oklch(0.45_0.008_240)] italic">"{valor?.slice(0, 60)}{(valor?.length ?? 0) > 60 ? '…' : ''}"</span>
  }
  return <span className="text-xs text-[oklch(0.55_0.008_240)]">{valor ?? '—'}</span>
}

export function LicitacionDetail({ licitacion: lic, onClose, onUpdate }: Props) {
  const crm = lic.seguimiento
  const [tab, setTab] = useState<'detalle' | 'historial'>('detalle')
  const [estadoCRM, setEstadoCRM] = useState<EstadoCRM>(crm?.estado_crm ?? 'nueva')
  const [notas, setNotas] = useState(crm?.notas ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [historial, setHistorial] = useState<LogEntry[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  const diasRT = diasRestantesRealtime(lic.fecha_cierre)
  const semaforoRT = semaforoRealtime(diasRT)

  useEffect(() => {
    if (tab !== 'historial') return
    setLoadingHistorial(true)
    fetch(`/api/licitaciones/${lic.codigo}/historial`)
      .then(r => r.json())
      .then(d => setHistorial(d.data ?? []))
      .finally(() => setLoadingHistorial(false))
  }, [tab, lic.codigo])

  async function handleSave() {
    setSaving(true)
    await onUpdate(lic.codigo, { estado_crm: estadoCRM, notas })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    // Recargar historial si está visible
    if (tab === 'historial') {
      fetch(`/api/licitaciones/${lic.codigo}/historial`)
        .then(r => r.json())
        .then(d => setHistorial(d.data ?? []))
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="detail-panel relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[oklch(0.90_0.008_240)]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <SemaforoTag estado={semaforoRT} diasRestantes={diasRT} />
              <span className="text-xs text-[oklch(0.60_0.008_240)] font-mono">{lic.codigo}</span>
              <span className="text-xs text-[oklch(0.70_0.008_240)] bg-[oklch(0.94_0.008_240)] px-1.5 py-0.5 rounded">
                {lic.tipo} — {TIPO_CONFIG[lic.tipo] ?? ''}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-[oklch(0.20_0.010_240)] leading-snug">
              {lic.nombre}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[oklch(0.55_0.008_240)] hover:bg-[oklch(0.93_0.008_240)] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[oklch(0.90_0.008_240)] px-6">
          {(['detalle', 'historial'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-2.5 mr-5 text-xs font-medium border-b-2 transition-colors capitalize
                ${tab === t
                  ? 'border-[oklch(0.48_0.14_240)] text-[oklch(0.30_0.10_240)]'
                  : 'border-transparent text-[oklch(0.60_0.008_240)] hover:text-[oklch(0.35_0.010_240)]'
                }`}
            >
              {t === 'detalle' ? 'Detalle' : 'Historial'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {tab === 'detalle' && (
            <div className="space-y-5">
              {/* Organismo */}
              <div className="bg-[oklch(0.97_0.005_240)] rounded-lg px-3 py-2.5">
                <p className="text-xs text-[oklch(0.60_0.008_240)] mb-0.5">Organismo comprador</p>
                <p className="text-sm font-semibold text-[oklch(0.22_0.010_240)]">{lic.organismo}</p>
                {(lic.comuna_unidad || lic.region) && (
                  <p className="text-xs text-[oklch(0.55_0.008_240)] mt-0.5">
                    {[lic.comuna_unidad, lic.region].filter(Boolean).join(' · ')}
                  </p>
                )}
                {lic.direccion_unidad && (
                  <p className="text-xs text-[oklch(0.65_0.008_240)] mt-0.5">{lic.direccion_unidad}</p>
                )}
              </div>

              {/* Fechas y monto */}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Publicación" value={formatFecha(lic.fecha_pub)} />
                <Field label="Cierre" value={
                  <span className={diasRT !== null && diasRT <= 5 ? 'text-red-700' : ''}>
                    {formatFecha(lic.fecha_cierre)}
                  </span>
                } />
                {lic.monto_estimado && (
                  <Field label="Monto estimado" value={formatMonto(lic.monto_estimado, lic.moneda)} />
                )}
                {lic.duracion_contrato && (
                  <Field label="Duración contrato" value={
                    <>
                      {lic.duracion_contrato}
                      {lic.es_renovable && <span className="ml-1 text-xs text-emerald-600">(renovable)</span>}
                    </>
                  } />
                )}
                {lic.fecha_adj && (
                  <Field label="Adjudicación" value={formatFecha(lic.fecha_adj)} />
                )}
              </div>

              {/* Descripción */}
              {lic.descripcion && (
                <div>
                  <p className="text-xs font-medium text-[oklch(0.50_0.008_240)] uppercase tracking-wide mb-2">
                    Descripción
                  </p>
                  <p className="text-sm text-[oklch(0.35_0.010_240)] leading-relaxed">
                    {lic.descripcion}
                  </p>
                </div>
              )}

              {/* Responsable */}
              {(lic.responsable_nombre || lic.responsable_email || lic.responsable_fono) && (
                <div>
                  <p className="text-xs font-medium text-[oklch(0.50_0.008_240)] uppercase tracking-wide mb-2">
                    Responsable de contrato
                  </p>
                  <div className="bg-[oklch(0.97_0.005_240)] rounded-lg px-3 py-2.5 space-y-1">
                    {lic.responsable_nombre && (
                      <p className="text-sm font-medium text-[oklch(0.22_0.010_240)]">{lic.responsable_nombre}</p>
                    )}
                    {lic.responsable_email && (
                      <a href={`mailto:${lic.responsable_email}`}
                        className="text-sm text-[oklch(0.48_0.14_240)] hover:underline block">
                        {lic.responsable_email}
                      </a>
                    )}
                    {lic.responsable_fono && (
                      <a href={`tel:${lic.responsable_fono}`}
                        className="text-sm text-[oklch(0.48_0.14_240)] hover:underline block">
                        {lic.responsable_fono}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Links */}
              <div className="flex flex-col gap-2">
                <a href={lic.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-[oklch(0.85_0.010_240)] hover:border-[oklch(0.55_0.14_240)] hover:bg-[oklch(0.97_0.008_240)] transition-colors text-sm font-medium text-[oklch(0.48_0.14_240)]">
                  Ver en Mercado Público
                  <span>→</span>
                </a>
                {lic.url_acta && (
                  <a href={lic.url_acta} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-[oklch(0.85_0.010_240)] hover:border-[oklch(0.55_0.14_240)] hover:bg-[oklch(0.97_0.008_240)] transition-colors text-sm font-medium text-[oklch(0.48_0.14_240)]">
                    Ver acta de adjudicación
                    <span>→</span>
                  </a>
                )}
              </div>

              <div className="border-t border-[oklch(0.91_0.008_240)]" />

              {/* CRM */}
              <div>
                <p className="text-xs font-medium text-[oklch(0.50_0.008_240)] uppercase tracking-wide mb-3">
                  Seguimiento interno
                </p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {(Object.entries(CRM_CONFIG) as [EstadoCRM, { label: string; color: string }][]).map(([key, cfg]) => (
                    <button key={key} onClick={() => setEstadoCRM(key)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors
                        ${estadoCRM === key
                          ? `${cfg.color} border-current`
                          : 'border-[oklch(0.88_0.008_240)] text-[oklch(0.55_0.008_240)] hover:border-[oklch(0.75_0.008_240)]'
                        }`}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
                <textarea value={notas} onChange={e => setNotas(e.target.value)}
                  placeholder="Notas internas (visibles para el equipo)..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border border-[oklch(0.85_0.010_240)] bg-[oklch(0.98_0.004_240)] text-sm text-[oklch(0.25_0.010_240)] placeholder:text-[oklch(0.65_0.008_240)] focus:outline-none focus:border-[oklch(0.55_0.14_240)] focus:ring-2 focus:ring-[oklch(0.55_0.14_240)]/20 transition-colors resize-none" />
              </div>
            </div>
          )}

          {tab === 'historial' && (
            <div>
              {loadingHistorial ? (
                <p className="text-sm text-[oklch(0.60_0.008_240)] py-8 text-center">Cargando historial...</p>
              ) : historial.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-[oklch(0.55_0.008_240)]">Sin cambios registrados aún.</p>
                  <p className="text-xs text-[oklch(0.65_0.008_240)] mt-1">Los cambios de estado y notas aparecen aquí.</p>
                </div>
              ) : (
                <ol className="relative border-l border-[oklch(0.90_0.008_240)] ml-2 space-y-5">
                  {historial.map(entry => (
                    <li key={entry.id} className="ml-5">
                      <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-[oklch(0.88_0.008_240)] border-2 border-white" />
                      <p className="text-xs text-[oklch(0.60_0.008_240)] mb-1">
                        <span className="font-medium text-[oklch(0.35_0.010_240)]">{entry.usuario ?? 'Sistema'}</span>
                        {' · '}{formatFechaHora(entry.created_at)}
                      </p>
                      {entry.accion === 'estado_crm' ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-[oklch(0.55_0.008_240)]">Estado →</span>
                          {entry.valor_anterior && <LogLabel accion="estado_crm" valor={entry.valor_anterior} />}
                          {entry.valor_anterior && <span className="text-xs text-[oklch(0.70_0.008_240)]">→</span>}
                          <LogLabel accion="estado_crm" valor={entry.valor_nuevo} />
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs text-[oklch(0.55_0.008_240)] mb-1">Notas actualizadas</p>
                          <LogLabel accion="notas" valor={entry.valor_nuevo} />
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {tab === 'detalle' && (
          <div className="px-6 py-4 border-t border-[oklch(0.90_0.008_240)] flex items-center justify-between">
            {crm?.usuario && (
              <p className="text-xs text-[oklch(0.60_0.008_240)]">
                Actualizado por {crm.usuario}
              </p>
            )}
            <button onClick={handleSave} disabled={saving}
              className="btn-primary ml-auto px-4 py-2 rounded-lg bg-[oklch(0.48_0.14_240)] hover:bg-[oklch(0.43_0.14_240)] text-white text-sm font-medium disabled:opacity-50">
              {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
