'use client'

import { useState } from 'react'
import { Licitacion, EstadoCRM, CRM_CONFIG, TIPO_CONFIG } from '@/lib/types'
import { SemaforoTag } from './SemaforoTag'
import { MontoTag } from './MontoTag'

interface Props {
  licitacion: Licitacion
  onClose: () => void
  onUpdate: (codigo: string, data: { estado_crm?: EstadoCRM; notas?: string }) => Promise<void>
}

function formatFecha(f: string | null) {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function LicitacionDetail({ licitacion: lic, onClose, onUpdate }: Props) {
  const crm = lic.seguimiento
  const [estadoCRM, setEstadoCRM] = useState<EstadoCRM>(crm?.estado_crm ?? 'nueva')
  const [notas, setNotas] = useState(crm?.notas ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onUpdate(lic.codigo, { estado_crm: estadoCRM, notas })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Panel */}
      <div
        className="detail-panel relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[oklch(0.90_0.008_240)]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <SemaforoTag estado={lic.semaforo} diasRestantes={lic.dias_restantes} />
              <span className="text-xs text-[oklch(0.60_0.008_240)] font-mono">{lic.codigo}</span>
            </div>
            <h2 className="text-sm font-semibold text-[oklch(0.20_0.010_240)] leading-snug line-clamp-3">
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Organismo', value: lic.organismo },
              { label: 'Región', value: lic.region },
              { label: 'Tipo', value: `${lic.tipo} — ${TIPO_CONFIG[lic.tipo] ?? ''}` },
              { label: 'Monto estimado', value: <MontoTag monto={lic.monto_estimado} /> },
              { label: 'Publicación', value: formatFecha(lic.fecha_pub) },
              { label: 'Cierre', value: formatFecha(lic.fecha_cierre) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[oklch(0.97_0.005_240)] rounded-lg px-3 py-2.5">
                <p className="text-xs text-[oklch(0.60_0.008_240)] mb-0.5">{label}</p>
                <p className="text-sm font-medium text-[oklch(0.22_0.010_240)]">{value}</p>
              </div>
            ))}
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

          {/* Link a Mercado Público */}
          <a
            href={lic.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-[oklch(0.85_0.010_240)] hover:border-[oklch(0.55_0.14_240)] hover:bg-[oklch(0.97_0.008_240)] transition-colors text-sm font-medium text-[oklch(0.48_0.14_240)]"
          >
            Ver en Mercado Público
            <span className="text-base">→</span>
          </a>

          {/* Divisor */}
          <div className="border-t border-[oklch(0.91_0.008_240)]" />

          {/* CRM */}
          <div>
            <p className="text-xs font-medium text-[oklch(0.50_0.008_240)] uppercase tracking-wide mb-3">
              Seguimiento interno
            </p>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {(Object.entries(CRM_CONFIG) as [EstadoCRM, { label: string; color: string }][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setEstadoCRM(key)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors
                    ${estadoCRM === key
                      ? `${cfg.color} border-current`
                      : 'border-[oklch(0.88_0.008_240)] text-[oklch(0.55_0.008_240)] hover:border-[oklch(0.75_0.008_240)]'
                    }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>

            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Notas internas (visibles para el equipo)..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-[oklch(0.85_0.010_240)] bg-[oklch(0.98_0.004_240)] text-sm text-[oklch(0.25_0.010_240)] placeholder:text-[oklch(0.65_0.008_240)] focus:outline-none focus:border-[oklch(0.55_0.14_240)] focus:ring-2 focus:ring-[oklch(0.55_0.14_240)]/20 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[oklch(0.90_0.008_240)] flex items-center justify-between">
          {crm?.usuario && (
            <p className="text-xs text-[oklch(0.60_0.008_240)]">
              Actualizado por {crm.usuario}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary ml-auto px-4 py-2 rounded-lg bg-[oklch(0.48_0.14_240)] hover:bg-[oklch(0.43_0.14_240)] text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
