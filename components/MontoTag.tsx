interface Props {
  monto: number | null
}

function formatMonto(monto: number): string {
  if (monto >= 1_000_000) return `$${(monto / 1_000_000).toFixed(1)}M`
  if (monto >= 1_000) return `$${(monto / 1_000).toFixed(0)}K`
  return `$${monto}`
}

export function MontoTag({ monto }: Props) {
  if (!monto) return <span className="text-xs text-[oklch(0.65_0.008_240)]">—</span>
  return (
    <span className="text-xs font-mono font-medium text-[oklch(0.30_0.010_240)]">
      {formatMonto(monto)}
    </span>
  )
}
