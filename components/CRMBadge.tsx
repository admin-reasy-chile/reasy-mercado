import { EstadoCRM, CRM_CONFIG } from '@/lib/types'

interface Props {
  estado: EstadoCRM
}

export function CRMBadge({ estado }: Props) {
  const cfg = CRM_CONFIG[estado]
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}
