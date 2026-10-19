export interface TractionSource {
  userCount: number | null
  monthlyRevenue: number | null
  retentionRate: number | null
}

export function tractionMetrics(source: TractionSource): { label: string; value: string }[] {
  return [
    source.userCount !== null && source.userCount !== undefined ? { label: '用户数', value: source.userCount.toLocaleString() } : null,
    source.monthlyRevenue !== null && source.monthlyRevenue !== undefined ? { label: '月收入', value: `¥${source.monthlyRevenue.toLocaleString()}` } : null,
    source.retentionRate !== null && source.retentionRate !== undefined ? { label: '留存率', value: `${source.retentionRate}%` } : null,
  ].filter((metric): metric is { label: string; value: string } => metric !== null)
}
