interface Props {
  monto: number | null
}

function formatMonto(monto: number): string {
  if (monto >= 1_000_000) return `$${(monto / 1_000_000).toFixed(1)}M`
  if (monto >= 1_000) return `$${(monto / 1_000).toFixed(0)}K`
  return `$${monto}`
}

export function MontoTag({ monto }: Props) {
  if (!monto) return <span className="text-xs text-[#7A9AAA]">—</span>
  return (
    <span className="text-xs font-mono font-medium text-[#0A2233]">
      {formatMonto(monto)}
    </span>
  )
}
