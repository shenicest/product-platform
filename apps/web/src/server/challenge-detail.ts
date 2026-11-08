import { cache } from 'react'
import { cookies } from 'next/headers'
import { api } from '@/lib/api'
import { normalizeChallengeDetail, type ChallengeDetailDto } from '@/lib/challenge-detail'

/**
 * 命题详情页的服务端取数（`GET /challenges/:id`）。
 *
 * 三条口径（见 docs/boomland/challenge-detail-contract.md §4.1）：
 *   · 404 → 返回 `null`，页面据此 `notFound()`；
 *   · 其它失败 → 抛错，由页面降级成「暂时无法加载」的空态，而不是整页 500；
 *   · 响应逐字段兜底（`normalizeChallengeDetail`）—— 后端正在并行加字段，
 *     字段暂时缺失时页面必须照样渲染。
 *
 * 用 `cache()` 包一层：同一请求里 `generateMetadata` 与页面各取一次，只发一次 HTTP。
 */

async function authHeaders() {
  const token = (await cookies()).get('shenicest_token')?.value
  return token ? { cookie: `shenicest_token=${token}` } : undefined
}

export const getChallengeDetail = cache(async (id: number): Promise<ChallengeDetailDto | null> => {
  const { data, error } = await api.challenges({ id }).get({
    headers: await authHeaders(),
  })
  if ((error as { status?: number } | null)?.status === 404) return null
  if (error || !data) throw new Error('Failed to load challenge detail')
  return normalizeChallengeDetail(data)
})
