import { SemaforoEstado, SEMAFORO_CONFIG } from '@/lib/types'

interface Props {
  estado: SemaforoEstado
  diasRestantes?: number | null
  size?: 'sm' | 'md'
}

export function SemaforoTag({ estado, diasRestantes, size = 'md' }: Props) {
  const cfg = SEMAFORO_CONFIG[estado]

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border
        ${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'}
        ${cfg.color} ${cfg.bg} ${cfg.border}`}
    >
      <span
        className={`shrink-0 rounded-full
          ${size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'}
          ${cfg.dot}
          ${estado === 'urgente' ? 'dot-urgente' : ''}`}
      />
      {cfg.label}
      {diasRestantes !== null && diasRestantes !== undefined && diasRestantes >= 0 && (
        <span className="opacity-70">
          {diasRestantes === 0 ? '· hoy' : `· ${diasRestantes}d`}
        </span>
      )}
    </span>
  )
}
