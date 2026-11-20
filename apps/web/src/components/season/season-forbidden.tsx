import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/surface'

/**
 * 赛季角色入口的 403 面板。
 *
 * 权限判定在服务端页面完成（`lib/season-access.ts` + `getSessionUser` /
 * `getWorkbenchHeader`）；这里只负责把「为什么进不来」和下一步说清楚，
 * 不再重复判断，避免守卫规则出现第二份。
 *
 * 不包 `<main>`：`/me` 的 layout 已经有 main，评委台 / 企业命题台的页面
 * 自己决定外层结构。
 */
export function SeasonForbidden({
  description,
  title = 'FORBIDDEN',
  actionHref = '/seasons',
  actionLabel = '去看看火热赛季',
}: {
  description: string
  title?: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <section className="section section--flush">
      <div className="shell shell--narrow py-16">
        <EmptyState
          title={title}
          description={description}
          action={
            <ButtonLink href={actionHref} variant="secondary">
              {actionLabel}
            </ButtonLink>
          }
        />
      </div>
    </section>
  )
}
