import { cache } from 'react'
import { cookies } from 'next/headers'
import { API_URL } from '@/lib/api-url'
import { getWorkbenchHeader } from '@/server/me'
import type { SeasonSummary } from '@/lib/boomland'
import type {
  ProjectOption,
  TeamChallengeDto,
  TeamWorkbenchDto,
} from '@/lib/team'

/**
 * 组队 tab 的 Server 端数据层。
 *
 * 约定与 `server/boomland.ts` 一致：`cache()` 去重、只做读请求（写操作走
 * `lib/team-api.ts`）、cookie 手动转发。
 *
 * 为什么用 `fetch` 而不是 eden treaty：组队接口由 api-dev 并行实现，
 * treaty 的类型从 `@shenicest/api` 的 `App` 推断 —— 接口还没合并时前端会被
 * 类型卡住。契约文档是权威，这里按它拼路径。
 *
 * 错误口径分两种：
 *   · 首屏聚合（`getTeamWorkbench`）：把状态码与后端文案原样交给页面，
 *     由页面决定是「空态」还是「错误卡片」；
 *   · 弹窗的候选数据（命题、我的项目）：读不到就降级成空数组 —— 它们是
 *     弹窗里的可选项，不该让整页变成错误卡片。
 */

export type TeamLoadResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'empty' }
  | { kind: 'error'; status: number; message: string }

type ApiErrorBody = { error?: { code?: string; message?: string } }

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = (await cookies()).get('shenicest_token')?.value
  return token ? { cookie: `shenicest_token=${token}` } : null
}

async function serverGet<T>(path: string): Promise<TeamLoadResult<T>> {
  const headers = await authHeaders()
  if (!headers) return { kind: 'error', status: 401, message: '请先登录' }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { headers, cache: 'no-store' })
  } catch {
    return { kind: 'error', status: 0, message: '网络异常，请稍后重试' }
  }

  if (response.status === 404) return { kind: 'empty' }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null
    return {
      kind: 'error',
      status: response.status,
      // 契约 §2：错误统一是 `{ error: { code, message } }`，直接展示后端那句话。
      message: body?.error?.message || '读取失败，请稍后重试',
    }
  }

  return { kind: 'ok', data: (await response.json()) as T }
}

/**
 * 我参加的赛季（组队页的赛季选择器数据源）。
 *
 * 复用页头那份数据：`/me/applications` 已经取过一次，`cache()` 保证同一次
 * 渲染里不会为了选择器再发一轮请求。`getWorkbenchHeader` 只保留
 * active / upcoming 的赛季，正好是「组队还有意义」的那些。
 */
export const getMyTeamSeasons = cache(async (): Promise<SeasonSummary[]> => {
  const header = await getWorkbenchHeader()
  return header?.activeSeasons ?? []
})

/** `GET /seasons/:id/team/me` —— 组队 tab 首屏聚合。 */
export const getTeamWorkbench = cache(
  async (seasonId: number): Promise<TeamLoadResult<TeamWorkbenchDto>> =>
    serverGet<TeamWorkbenchDto>(`/seasons/${seasonId}/team/me`),
)

/**
 * 发起项目弹窗的命题选项。
 *
 * 读失败降级成空数组：命题读不到时弹窗仍可打开（会提示「本赛季还没有已发布
 * 命题」），而不是整页报错。
 */
export const getTeamChallenges = cache(
  async (seasonId: number): Promise<TeamChallengeDto[]> => {
    const result = await serverGet<{ items?: TeamChallengeDto[] }>(
      `/seasons/${seasonId}/challenges`,
    )
    return result.kind === 'ok' ? (result.data.items ?? []) : []
  },
)

/**
 * 「带入已有项目」的候选列表。
 *
 * `/founder/projects` 要求 Founder 角色；没有角色的账号会 403 —— 这里按
 * 「没有可带入项目」处理，弹窗里仍可以新建。
 */
export const getMyProjectOptions = cache(async (): Promise<ProjectOption[]> => {
  const result = await serverGet<{ data?: ProjectOption[] }>('/founder/projects?limit=100')
  return result.kind === 'ok' ? (result.data.data ?? []) : []
})
