export type SemaforoEstado = 'urgente' | 'proximo' | 'con_tiempo' | 'cerrada' | 'sin_fecha'
export type EstadoCRM = 'nueva' | 'en_analisis' | 'postulada' | 'ganada' | 'descartada'
export type EstadoLicitacion = 'publicada' | 'cerrada' | 'adjudicada'

export interface Licitacion {
  id: number
  codigo: string
  nombre: string
  organismo: string
  region: string
  tipo: string
  estado: EstadoLicitacion
  keyword_match: string
  fecha_pub: string | null
  fecha_cierre: string | null
  fecha_adj: string | null
  dias_restantes: number | null
  semaforo: SemaforoEstado
  monto_estimado: number | null
  moneda: string | null
  url: string
  descripcion: string
  duracion_contrato: string | null
  es_renovable: boolean | null
  responsable_nombre: string | null
  responsable_email: string | null
  responsable_fono: string | null
  direccion_unidad: string | null
  comuna_unidad: string | null
  url_acta: string | null
  score: number | null
  created_at: string
  updated_at: string
  seguimiento?: Seguimiento | null
}

export interface Seguimiento {
  id: number
  licitacion_codigo: string
  estado_crm: EstadoCRM
  notas: string | null
  usuario: string | null
  updated_at: string
}

export interface SyncResult {
  total: number
  nuevas: number
  actualizadas: number
  timestamp: string
}

export interface DashboardStats {
  total_activas: number
  urgentes: number
  proximas: number
  con_tiempo: number
  monto_total: number
  ultima_sync: string | null
  nuevas_esta_semana: number
  nuevas_semana_anterior: number
}

export const SEMAFORO_CONFIG: Record<SemaforoEstado, {
  label: string
  color: string
  bg: string
  border: string
  dot: string
}> = {
  urgente: {
    label: 'URGENTE',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  proximo: {
    label: 'PRÓXIMO',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-400',
  },
  con_tiempo: {
    label: 'Con tiempo',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  cerrada: {
    label: 'Cerrada',
    color: 'text-neutral-500',
    bg: 'bg-neutral-50',
    border: 'border-neutral-200',
    dot: 'bg-neutral-400',
  },
  sin_fecha: {
    label: 'Sin fecha',
    color: 'text-neutral-400',
    bg: 'bg-neutral-50',
    border: 'border-neutral-100',
    dot: 'bg-neutral-300',
  },
}

export const CRM_CONFIG: Record<EstadoCRM, { label: string; color: string }> = {
  nueva:       { label: 'Nueva',       color: 'text-blue-600 bg-blue-50' },
  en_analisis: { label: 'En análisis', color: 'text-violet-600 bg-violet-50' },
  postulada:   { label: 'Postulada',   color: 'text-orange-600 bg-orange-50' },
  ganada:      { label: 'Ganada',      color: 'text-emerald-700 bg-emerald-50' },
  descartada:  { label: 'Descartada',  color: 'text-neutral-400 bg-neutral-50' },
}

export const TIPO_CONFIG: Record<string, string> = {
  L1: '< 100 UTM',
  LE: '< 1.000 UTM',
  LP: '< 2.000 UTM',
  LQ: '< 5.000 UTM',
  LR: '> 5.000 UTM',
}
