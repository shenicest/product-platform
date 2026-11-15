import Link from 'next/link'
import { WechatStatus } from '@shenicest/shared'
import { ApplicationStatusBadge } from '@/components/boomland/application-status-badge'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/surface'
import { ButtonLink } from '@/components/ui/button'
import { WithdrawApplicationButton } from '@/components/me/withdraw-application-button'
import {
  APPLICATIONS_FOOTNOTE,
  MY_APPLICATION_COLUMNS,
  myApplicationRows,
  type MyApplicationRow,
} from '@/lib/me-applications'
import type { MySeasonApplication } from '@/lib/boomland'

/**
 * 「我提交过的报名」表格。
 *
 * 纯展示的 Server Component：数据由页面取好后传入，行映射全部在
 * `lib/me-applications.ts` 里完成（可单测）。操作列里只有「撤回报名」
 * 需要交互，是一个独立的 Client Component；「重新报名」是去报名表单的
 * 普通链接，不必背 `'use client'`。
 *
 * 列严格按设计稿的 7 列（赛季 / 提交时间 / 审核状态 / 审核说明 / 微信群 /
 * 赛季标识 / 条款版本），再单独加一列「操作」放撤回与重新报名入口。
 *
 * 为什么操作单独一列：挂在「审核状态」格里时，状态胶囊和按钮上下堆叠，
 * 窄屏下按钮会被挤到胶囊下面一行，读起来像「这条报名多了一行」；单独一列
 * 还能按内容收缩（`w-px`），不参与表格的等分拉伸。
 *
 * 宽表在窄屏会横向溢出，所以外层套 `.overflow-x-auto`，并用
 * `console-table--sticky-actions-page` 把操作列冻结在右侧 —— 滚动看中间的
 * 审核说明时，「撤回报名 / 重新报名」始终在手边。
 */
export function ApplicationsTable({ items }: { items: MySeasonApplication[] }) {
  const rows = myApplicationRows(items)

  if (rows.length === 0) {
    return (
      <EmptyState
        title="NO APPLICATION"
        description="你还没有报名任何赛季。"
        action={
          <ButtonLink href="/seasons" variant="secondary">
            去看看火热赛季 <span className="ui-btn__arrow" aria-hidden>→</span>
          </ButtonLink>
        }
      />
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table
          className="console-table console-table--sticky-actions console-table--sticky-actions-page"
          aria-label="我提交过的赛季报名"
        >
          <caption className="sr-only">
            我提交过的赛季报名：赛季、提交时间、审核状态、审核说明、微信群、赛季标识、条款版本与操作。
          </caption>
          <thead>
            <tr>
              {MY_APPLICATION_COLUMNS.map((column) => (
                <th key={column.key} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.applicationId} data-application-id={row.applicationId}>
                <td className="min-w-44">
                  <Link
                    href={row.seasonHref}
                    className="font-bold text-foreground transition-colors hover:text-brand-text"
                  >
                    {row.seasonName}
                  </Link>
                </td>

                <td className="whitespace-nowrap font-mono text-meta text-muted-foreground">
                  {row.submittedAt}
                </td>

                <td className="min-w-32">
                  <ApplicationStatusBadge status={row.status} />
                </td>

                <td className="min-w-44 max-w-72 text-muted-foreground">
                  {row.reviewNote}
                </td>

                <td className="whitespace-nowrap">
                  {row.wechatStatus ? (
                    <Chip
                      tone={
                        row.wechatStatus === WechatStatus.Joined ? 'success' : 'neutral'
                      }
                    >
                      {row.wechat}
                    </Chip>
                  ) : (
                    <span className="text-muted-foreground">{row.wechat}</span>
                  )}
                </td>

                <td className="font-mono text-meta text-muted-foreground">
                  {row.seasonCode}
                </td>

                <td className="whitespace-nowrap font-mono text-meta text-muted-foreground">
                  {row.agreementVersion}
                </td>

                {/* 操作列按内容收缩，不参与表格的等分拉伸；没有任何动作时给
                    破折号，而不是留一个空单元格。 */}
                <td className="w-px whitespace-nowrap">
                  <ApplicationRowAction row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-meta leading-[1.9] text-muted-foreground">
        {APPLICATIONS_FOOTNOTE}
      </p>
    </div>
  )
}

/**
 * 操作列的四种形态，按「现在能不能做」排序：
 *   1. 审核中 → 撤回报名（两步确认，Client Component）；
 *   2. 已撤回且报名窗口开放 → 重新报名（回报名表单，提交后复用同一条记录）；
 *   3. 已撤回但窗口关了 / 赛季暂停或取消 → 一句原因，不给点了也报不上的假按钮；
 *   4. 其余（已通过 / 未通过）→ 破折号。
 *
 * 「重新报名」用 `aria-label` 带上赛季名：一屏里可能同时有好几条已撤回的
 * 报名，读屏用户得能分清点的是哪一场。
 */
function ApplicationRowAction({ row }: { row: MyApplicationRow }) {
  if (row.canWithdraw) {
    return (
      <WithdrawApplicationButton
        applicationId={row.applicationId}
        seasonName={row.seasonName}
      />
    )
  }

  if (row.reapplyHref) {
    return (
      <ButtonLink
        href={row.reapplyHref}
        variant="secondary"
        size="sm"
        aria-label={`重新报名 ${row.seasonName}`}
      >
        重新报名
      </ButtonLink>
    )
  }

  if (row.reapplyBlockedReason) {
    return (
      <span className="text-meta text-muted-foreground">{row.reapplyBlockedReason}</span>
    )
  }

  return <span className="text-muted-foreground">—</span>
}
