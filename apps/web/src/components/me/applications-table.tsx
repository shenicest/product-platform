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
} from '@/lib/me-applications'
import type { MySeasonApplication } from '@/lib/boomland'

/**
 * 「我提交过的报名」表格。
 *
 * 纯展示的 Server Component：数据由页面取好后传入，行映射全部在
 * `lib/me-applications.ts` 里完成（可单测）。唯一需要交互的撤回按钮
 * 是一个独立的 Client Component。
 *
 * 列严格按设计稿的 7 列：赛季 / 提交时间 / 审核状态 / 审核说明 /
 * 微信群 / 赛季标识 / 条款版本。撤回入口挂在「审核状态」格里，
 * 因为「现在还能不能撤回」本来就是审核状态的一部分，不该多开一列。
 *
 * 宽表在窄屏会横向溢出，所以外层套 `.overflow-x-auto`，
 * 与主办方后台的报名队列同一套做法。
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
        <table className="console-table" aria-label="我提交过的赛季报名">
          <caption className="sr-only">
            我提交过的赛季报名：赛季、提交时间、审核状态、审核说明、微信群、赛季标识与条款版本。
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
                  <span className="flex flex-col items-start gap-2">
                    <ApplicationStatusBadge status={row.status} />
                    {row.canWithdraw ? (
                      <WithdrawApplicationButton
                        applicationId={row.applicationId}
                        seasonName={row.seasonName}
                      />
                    ) : null}
                  </span>
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
