/**
 * 本地开发用的 mock 用户切换客户端。
 *
 * 后端（`apps/api` 的 mock 模块）只在 mock 模式开启时注册这些路由；关闭时
 * 这些路径**根本不存在**，请求会拿到 404。所以这里把 404 与网络失败归为
 * 「不可用」：调用方据此整块收起 UI，页面上不留任何残留。
 *
 * 生产构建里 `MOCK_SWITCHER_ENABLED` 是 `false`（构建期内联的常量），两个
 * 请求函数会直接短路，不发出任何请求；mock 用户列表本身来自接口，从不进
 * 前端 bundle。
 */

/** 构建期常量：只有非生产构建才允许出现 mock 切换器。 */
export const MOCK_SWITCHER_ENABLED = process.env.NODE_ENV !== 'production'

/**
 * 切换器「已收起」的本地记忆键。
 *
 * 只存一个 UI 偏好（收起 / 展开），不存任何身份信息：当前身份始终以 cookie 与
 * `/api/mock/users` 为准。刷新页面后浮层不该又铺开盖住右下角的内容，所以这个
 * 偏好落在 localStorage 而不是组件 state 里。
 */
export const MOCK_SWITCHER_COLLAPSED_KEY = 'shenicest_mock_switcher_collapsed'

/** 读取收起偏好；存储不可用（隐私模式等）时按「展开」处理。 */
export function loadMockSwitcherCollapsed(
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): boolean {
  try {
    return storage.getItem(MOCK_SWITCHER_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

/** 记住收起偏好。写失败不影响切换，所以静默吞掉异常。 */
export function saveMockSwitcherCollapsed(
  collapsed: boolean,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = window.localStorage,
): void {
  try {
    if (collapsed) storage.setItem(MOCK_SWITCHER_COLLAPSED_KEY, '1')
    else storage.removeItem(MOCK_SWITCHER_COLLAPSED_KEY)
  } catch {
    // 记不住就记不住：下次刷新回到展开状态而已。
  }
}

/** `GET /api/mock/users` 里单个候选用户的摘要（后端契约，已冻结）。 */
export interface MockUserSummary {
  key: string
  label: string
  description: string
  userId: string
  email: string | null
  roles: number[]
  isOrganizer: boolean
  hasProfile: boolean
}

export interface MockUsersState {
  /** 当前 cookie 对应的 mock 用户 key；`null` 表示未登录。 */
  active: string | null
  users: MockUserSummary[]
}

/**
 * 拉取 mock 用户列表。
 *
 * 返回 `null` 表示「这台后端没有开 mock」——404、响应结构不对或网络异常都算。
 */
export async function fetchMockUsers(): Promise<MockUsersState | null> {
  if (!MOCK_SWITCHER_ENABLED) return null

  try {
    const res = await fetch('/api/mock/users', { credentials: 'same-origin' })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<MockUsersState> | null
    if (!data || !Array.isArray(data.users)) return null
    return { active: data.active ?? null, users: data.users }
  } catch {
    return null
  }
}

/**
 * 切换当前 mock 用户（`key === null` 表示退出登录，后端会清掉 cookie）。
 *
 * 三种结果要分开，因为「后端不可用」和「这次切换被拒」对 UI 的含义完全不同：
 *   · `{ status: 'ok' }` —— 切换成功，`active` 是新的选中项；
 *   · `{ status: 'unavailable' }` —— 404 / 网络失败：后端没开 mock，整个浮层该收起；
 *   · `{ status: 'rejected' }` —— 其他 4xx/5xx（如未知 key 的 400）：后端在，
 *     只是这次没切成。浮层保持可见，不能因为一次失败就让它凭空消失。
 */
export type MockSelectResult =
  | { status: 'ok'; active: string | null }
  | { status: 'unavailable' }
  | { status: 'rejected' }

export async function selectMockUser(key: string | null): Promise<MockSelectResult> {
  if (!MOCK_SWITCHER_ENABLED) return { status: 'unavailable' }

  try {
    const res = await fetch('/api/mock/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ key }),
    })
    if (res.status === 404) return { status: 'unavailable' }
    if (!res.ok) return { status: 'rejected' }
    const data = (await res.json()) as { active?: string | null } | null
    return { status: 'ok', active: data?.active ?? null }
  } catch {
    return { status: 'unavailable' }
  }
}
