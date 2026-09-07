// "Daily" limits in this platform follow Beijing calendar dates (the external
// event DB and ops reporting both use Beijing time), so day boundaries are
// computed in UTC+8 rather than the server's local zone.
export function beijingDate(now = new Date()): string {
  const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return `${beijing.getUTCFullYear()}-${String(beijing.getUTCMonth() + 1).padStart(2, '0')}-${String(beijing.getUTCDate()).padStart(2, '0')}`
}
