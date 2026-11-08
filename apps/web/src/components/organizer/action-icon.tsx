import { cn } from '@/lib/utils'

/**
 * 主办方后台行内动作的通用图标。
 *
 * 约定与 `review-action-icon.tsx` / `components/ui/heart-icon.tsx` 一致：
 * 24×24 网格、`fill-none` + `stroke-current`、圆角连接，颜色完全交给父级
 * （图标不认识皮肤，也不读状态）。
 *
 * 为什么操作列用图标：这几张表都是宽表，操作列一旦用中文按钮就会把
 * 「技能与经历」「命题标题」这类真正需要宽度的内容列挤扁；图标按钮每个
 * 32px，四个并排 140px 就够。语义不丢 —— 每个按钮的 `aria-label` 与
 * `title` 都带完整文字，键盘与读屏用户拿到的是文字，视觉用户拿到的是形状。
 *
 * 形状选择（尽量做到「不悬停也能分辨」）：
 *   · edit      → 铅笔：通用编辑；
 *   · delete    → 垃圾桶：删除；
 *   · show      → 睁眼：让隐藏项重新可见；
 *   · hide      → 闭眼（带斜杠）：隐藏；
 *   · invite    → 人 + 加号：发出邀请；
 *   · joined    → 勾 + 圆：标记为已完成状态；
 *   · failed    → 叉 + 圆：标记失败；
 *   · retry     → 环形箭头：重新邀请；
 *   · publish   → 上箭头 + 托盘：发布（与「归档」的下箭头托盘区分）；
 *   · reference → 书签：转参考资料；
 *   · close     → 锁：关闭（锁住后续变更）；
 *   · archive   → 归档盒。
 */
export type OrganizerActionIconName =
  | 'edit'
  | 'delete'
  | 'show'
  | 'hide'
  | 'invite'
  | 'joined'
  | 'failed'
  | 'retry'
  | 'publish'
  | 'reference'
  | 'close'
  | 'archive'

export function OrganizerActionIcon({
  name,
  className,
}: {
  name: OrganizerActionIconName
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      className={cn('block shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'edit' ? (
        <>
          <path d="M4 20h4.5L19 9.5a2.12 2.12 0 0 0-3-3L5.5 17v3z" />
          <path d="M14.5 6.5 17.5 9.5" />
        </>
      ) : name === 'delete' ? (
        <>
          <path d="M4.5 6.5h15" />
          <path d="M9.5 6.5V4.75A1.25 1.25 0 0 1 10.75 3.5h2.5A1.25 1.25 0 0 1 14.5 4.75V6.5" />
          <path d="M6.5 6.5l.9 12.1A1.75 1.75 0 0 0 9.15 20.3h5.7a1.75 1.75 0 0 0 1.75-1.7l.9-12.1" />
          <path d="M10.25 10.5v6M13.75 10.5v6" />
        </>
      ) : name === 'show' ? (
        <>
          <path d="M2.5 12S6 6.25 12 6.25 21.5 12 21.5 12 18 17.75 12 17.75 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="2.75" />
        </>
      ) : name === 'hide' ? (
        <>
          <path d="M3.5 3.5l17 17" />
          <path d="M9.6 5.9A9.9 9.9 0 0 1 12 5.65c6 0 9.5 6.35 9.5 6.35a17.4 17.4 0 0 1-3.35 4.15" />
          <path d="M6.3 7.55A17.6 17.6 0 0 0 2.5 12s3.5 6.35 9.5 6.35a9.7 9.7 0 0 0 3.9-.8" />
          <path d="M10.05 10.05a2.75 2.75 0 0 0 3.9 3.9" />
        </>
      ) : name === 'invite' ? (
        <>
          <circle cx="9.5" cy="8" r="3.5" />
          <path d="M3.5 20.25c0-3.2 2.7-5.25 6-5.25s6 2.05 6 5.25" />
          <path d="M17.75 7v6M14.75 10h6" />
        </>
      ) : name === 'joined' ? (
        <>
          <circle cx="12" cy="12" r="8.25" />
          <path d="M8.25 12.25 11 15l4.75-5.25" />
        </>
      ) : name === 'failed' ? (
        <>
          <circle cx="12" cy="12" r="8.25" />
          <path d="M9.25 9.25l5.5 5.5M14.75 9.25l-5.5 5.5" />
        </>
      ) : name === 'retry' ? (
        <>
          <path d="M20 12a8 8 0 1 1-2.6-5.9" />
          <path d="M20.25 4.5v4.25h-4.25" />
        </>
      ) : name === 'publish' ? (
        <>
          <path d="M12 15.5V4.25" />
          <path d="M8 8.25 12 4.25l4 4" />
          <path d="M4.5 15.5v2.75A1.75 1.75 0 0 0 6.25 20h11.5a1.75 1.75 0 0 0 1.75-1.75V15.5" />
        </>
      ) : name === 'reference' ? (
        <path d="M6.5 3.75h11a.75.75 0 0 1 .75.75v15.25L12 16l-6.25 3.75V4.5a.75.75 0 0 1 .75-.75z" />
      ) : name === 'close' ? (
        <>
          <rect x="4.75" y="10.5" width="14.5" height="9.75" rx="2" />
          <path d="M8.25 10.5V7.75a3.75 3.75 0 0 1 7.5 0v2.75" />
        </>
      ) : (
        <>
          <rect x="3.75" y="4.5" width="16.5" height="4.25" rx="1.25" />
          <path d="M5.5 8.75v9.5A1.75 1.75 0 0 0 7.25 20h9.5a1.75 1.75 0 0 0 1.75-1.75v-9.5" />
          <path d="M10 12.5h4" />
        </>
      )}
    </svg>
  )
}
