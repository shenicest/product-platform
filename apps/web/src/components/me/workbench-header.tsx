import { Chip } from '@/components/ui/chip'
import { ButtonLink } from '@/components/ui/button'
import { seasonStatusMeta } from '@/lib/boomland'
import { publicProfileHref, userGroupLabel } from '@/lib/me'
import type { WorkbenchHeader as WorkbenchHeaderData } from '@/server/me'

/**
 * 个人中心页头。
 *
 * 布局按设计稿：左侧大圆头像，右侧从上到下是昵称 / 一句话简介 /
 * 用户组与参赛赛季胶囊行，最右侧「公开主页」按钮。
 *
 * 这一层是**纯展示**（Server Component）：所有数据由 layout 取好后传入，
 * 没有交互状态，所以不需要 `'use client'`。
 *
 * 头像尺寸用 Tailwind 工具类（`size-14`）覆盖 `.ui-avatar` 的 36px 默认值 ——
 * 工具类在 `@layer utilities`，晚于 `components` 层，所以不需要 `!important`。
 */
export function WorkbenchHeader({ data }: { data: WorkbenchHeaderData }) {
  const displayName = data.nickname?.trim() || data.email || `用户 #${data.userId}`
  const initial = displayName.slice(0, 1)

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        <span className="ui-avatar size-14 text-lg" aria-hidden>
          {data.avatarUrl ? (
            // 头像来自共享 users 表的外链，用原生 img 而不是 next/image：
            // 域名不在 next.config 的 images 白名单里，走优化器会 400。
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.avatarUrl} alt="" />
          ) : (
            initial
          )}
        </span>

        <div className="min-w-0">
          <h1 className="m-0 text-[clamp(24px,3vw,32px)] leading-[1.15] font-bold text-foreground">
            {displayName}
          </h1>
          <p className="mt-1.5 text-body-sm text-muted-foreground">
            {data.activeSeasons.length > 0
              ? `正在参加 ${data.activeSeasons.map((season) => season.name).join('、')}`
              : '还没有进行中的参赛赛季'}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip>{userGroupLabel(data.roles)}</Chip>
            {data.activeSeasons.map((season) => {
              const meta = seasonStatusMeta(season.status)
              return (
                <Chip key={season.id} tone={meta.tone} dot>
                  {season.code} · {meta.label}
                </Chip>
              )
            })}
          </div>
        </div>
      </div>

      <ButtonLink href={publicProfileHref(data.userId)} variant="secondary" size="sm">
        公开主页
      </ButtonLink>
    </header>
  )
}
