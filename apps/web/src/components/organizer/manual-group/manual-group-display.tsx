import { SeasonParticipantStatus } from '@shenicest/shared'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'
import {
  contactSummary,
  formatMonthDayTime,
  participantInitial,
  recorderOf,
  wechatStatusMeta,
  type SeasonParticipant,
} from '@/lib/organizer-manual-group'
import { cn } from '@/lib/utils'

/**
 * 人工拉群 tab 的**纯展示**件。
 *
 * 全部无状态、无副作用：只吃 props、只吐 DOM。操作按钮由客户端视图
 * （`manual-group-view.tsx`）传进来，所以这些组件既能被 Server Component
 * 直接渲染，也能被客户端视图复用，而不用背 `'use client'` 的包裹。
 *
 * 视觉沿用现有体系：`ui-panel` 作卡片外壳、`console-table` 作表格、
 * `ui-chip` 作状态标记、`eyebrow` / `mono` 作小标与元信息。
 */

// ---------------------------------------------------------------------------
// 页头
// ---------------------------------------------------------------------------

/** 页面顶部 eyebrow：本 tab 的身份说明。 */
export function ManualGroupHeader({ code }: { code: string }) {
  return (
    <div className="mb-6">
      <Eyebrow tone="accent">MANUAL GROUP INVITE</Eyebrow>
      <p className="mt-2 font-mono text-meta text-muted-foreground">{code}</p>
    </div>
  )
}

/**
 * 顶部说明。
 *
 * 这句话是这一页最重要的业务前提：**拉群是人工动作，平台只记录状态**。
 * 不写清楚，主办方会以为点一下按钮微信群里就会多一个人。
 *
 * 用一行普通说明文字而不是彩色 callout：它常驻在表头之上，每天都要看，
 * 做成警示条会一直抢走表格的注意力；真正需要强调的时刻（状态变更成功 / 失败）
 * 由下面的 `role="status"` / `role="alert"` 承担。
 */
export function ManualGroupNotice() {
  return (
    <p className="ui-hint">
      <span className="font-bold text-foreground">拉群是人工动作：</span>
      主办方在微信里邀请，平台只记录状态与记录人，不自动发送邀请。
    </p>
  )
}

// ---------------------------------------------------------------------------
// 选手头像 + 姓名
// ---------------------------------------------------------------------------

/**
 * 选手身份单元格：头像 + 昵称 + 姓氏小徽。
 *
 * 头像取 `applicant.avatarUrl`，缺资料时退回首字（与 `.ui-avatar` 的默认观感一致）。
 * 昵称为 null 时显示 userId —— 共享 users 表里没有这一行，但选手确实存在，
 * 不能显示空白。
 */
export function ParticipantIdentity({ participant }: { participant: SeasonParticipant }) {
  const { applicant } = participant
  const name = applicant.name?.trim() || applicant.userId

  return (
    <div className="flex items-center gap-3">
      <span className="ui-avatar" aria-hidden>
        {applicant.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 头像来自外部共享表，尺寸固定，不需要 next/image 的优化管线
          <img src={applicant.avatarUrl} alt="" loading="lazy" />
        ) : (
          participantInitial(applicant)
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-bold text-foreground">{name}</span>
        {applicant.name ? (
          <span className="mono block text-meta text-muted-foreground">{applicant.userId}</span>
        ) : null}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 表格
// ---------------------------------------------------------------------------

export type ParticipantRowActions = (participant: SeasonParticipant) => React.ReactNode

/**
 * 选手表格。
 *
 * 列与截图一致：选手 / 赛季标识 / 通过时间 / 联系方式 / 微信群 / 记录人 / 操作。
 * 「通过时间」取报名审核时间 `reviewedAt`（不是选手行创建时间）—— 那是主办方
 * 真正做决定的那一刻。
 *
 * 已退出赛季的选手整行降低对比度并在姓名旁标注：他们不该再被拉群，
 * 但历史记录仍然要看得见。
 */
export function ParticipantsTable({
  participants,
  seasonCode,
  renderActions,
}: {
  participants: SeasonParticipant[]
  seasonCode: string
  renderActions: ParticipantRowActions
}) {
  if (participants.length === 0) {
    return (
      <EmptyState
        title="NO PARTICIPANTS"
        description="这个赛季还没有通过审核的选手。先在「报名审核」里接受报名，选手会自动出现在这里。"
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="console-table">
        <thead>
          <tr>
            <th scope="col">选手</th>
            <th scope="col">赛季标识</th>
            <th scope="col">通过时间</th>
            <th scope="col">联系方式</th>
            <th scope="col">微信群</th>
            <th scope="col">记录人</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((participant) => (
            <ParticipantRow
              key={participant.id}
              participant={participant}
              seasonCode={seasonCode}
              actions={renderActions(participant)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ParticipantRow({
  participant,
  seasonCode,
  actions,
}: {
  participant: SeasonParticipant
  seasonCode: string
  actions: React.ReactNode
}) {
  const withdrawn = participant.status !== SeasonParticipantStatus.Active
  const status = wechatStatusMeta(participant.wechatStatus)
  const recorder = recorderOf(participant)

  return (
    <tr data-wechat-status={participant.wechatStatus} className={cn(withdrawn && 'opacity-60')}>
      <td>
        <ParticipantIdentity participant={participant} />
        {withdrawn ? (
          <p className="mt-1 text-meta text-muted-foreground">已退出赛季</p>
        ) : null}
      </td>
      <td className="whitespace-nowrap text-muted-foreground">
        <span className="mono">{seasonCode}</span> 选手
      </td>
      <td className="whitespace-nowrap text-muted-foreground">
        {formatMonthDayTime(participant.reviewedAt)}
      </td>
      <td className="whitespace-nowrap">
        <span className="mono text-body-sm">{contactSummary(participant.contact)}</span>
      </td>
      <td>
        <Chip tone={status.tone} dot aria-label={`微信群状态：${status.label}`}>
          {status.label}
        </Chip>
      </td>
      <td>
        {recorder ? (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="ui-avatar ui-avatar--sm" aria-hidden>
              {recorder.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- 同上：外部头像，尺寸固定
                <img src={recorder.avatarUrl} alt="" loading="lazy" />
              ) : (
                recorder.name.slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-body-sm">{recorder.name}</span>
              {/* 时间不折行：折成「10月22日 / 14:14」会把整行撑高，而这一格只是
                  记录人的附属信息。 */}
              <span className="mono block text-meta text-muted-foreground">
                {formatMonthDayTime(recorder.at)}
              </span>
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="whitespace-nowrap">{actions}</td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// 空态 / 错误态
// ---------------------------------------------------------------------------

/** 没选中具体赛季：这一页是赛季维度的，选一个才能列人。 */
export function NoSeasonSelected() {
  return (
    <EmptyState
      title="SELECT A SEASON"
      description="人工拉群按赛季组织。在顶部的赛季选择器里选一个赛季，就能看到这一季的选手名单与微信群状态。"
    />
  )
}

/** 无权限（403）：说明为什么看不到，并给出退回总览的入口。 */
export function ManualGroupForbidden({ action }: { action?: React.ReactNode }) {
  return (
    <EmptyState
      title="FORBIDDEN"
      description="你不是这个赛季的主办方，无法查看选手名单与微信群状态。切换赛季或联系平台管理员。"
      action={action}
    />
  )
}

/** 读取失败（非 403）。 */
export function ManualGroupLoadFailed({ message }: { message?: string }) {
  return (
    <EmptyState
      title="LOAD FAILED"
      description={message || '读取选手名单失败，请稍后刷新重试。'}
    />
  )
}
