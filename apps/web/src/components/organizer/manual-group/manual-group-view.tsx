'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/submit/form-fields'
import {
  ManualGroupNotice,
  ParticipantsTable,
} from '@/components/organizer/manual-group/manual-group-display'
import { updateParticipantWechat } from '@/lib/organizer-manual-group-api'
import {
  countWechatStatuses,
  participantLockReason,
  wechatActionsFor,
  type SeasonParticipant,
  type WechatCounts,
} from '@/lib/organizer-manual-group'

/**
 * 人工拉群 tab 的客户端视图。
 *
 * 服务端页面负责取数（赛季详情 + 选手名单），这里只做交互：
 * 每一行的微信状态流转按钮。
 *
 * 三条贯穿全文的规则：
 *   1. **局部更新优先**：`PATCH` 成功返回的就是更新后的整行，直接替换本地那一行，
 *      表格立刻变样；同时 `router.refresh()` 让服务端重新取数，保证记录人昵称、
 *      计数这类派生数据也跟着对齐。
 *   2. **失败不吞**：后端 `error.message` 原样摆到 `role="alert"` 里。状态机冲突
 *      （409 `WECHAT_STATUS_INVALID`）与「选手已退出」（409 `PARTICIPANT_WITHDRAW_LOCKED`）
 *      都会走到这里，用户看到的是后端那句话，不是我们编的。
 *   3. **一行一次请求**：pending 记的是「哪一行的哪个目标状态」，点 A 行时 B 行的按钮
 *      不会一起转圈；但**全表的按钮都会禁用**，避免连点把状态机推到意想不到的地方。
 *
 * 为什么外面还要包一层 `ManualGroupBoard` + 序列化 key：
 * `router.refresh()` 之后服务端会送来新名单。如果本地 state 与它一致，就不该重挂载
 * （否则用户刚点的行会闪一下）；如果**不一致**（别的同事刚改过某人），就必须以服务端
 * 为准。用「名单内容的序列化 key」当判据，比在 effect 里比对再 setState 干净，
 * 也避开 react-hooks/set-state-in-effect。
 */
export function ManualGroupView({
  seasonId,
  seasonCode,
  participants,
}: {
  seasonId: number
  seasonCode: string
  participants: SeasonParticipant[]
}) {
  const boardKey = useMemo(
    () =>
      participants
        .map((row) => `${row.userId}\u0000${row.wechatStatus}\u0000${row.status}\u0000${row.wechatInvitedAt ?? ''}`)
        .join('\u0001'),
    [participants],
  )

  return (
    <ManualGroupBoard
      key={boardKey}
      seasonId={seasonId}
      seasonCode={seasonCode}
      initialParticipants={participants}
    />
  )
}

function ManualGroupBoard({
  seasonId,
  seasonCode,
  initialParticipants,
}: {
  seasonId: number
  seasonCode: string
  initialParticipants: SeasonParticipant[]
}) {
  const router = useRouter()
  const [participants, setParticipants] = useState(initialParticipants)
  // pending 记到「哪一行的哪个目标状态」：只给真正被点的那颗按钮转圈，
  // 同一行的另一颗（比如「标记邀请失败」）保持原文案，用户不会以为两个都在跑。
  const [pending, setPending] = useState<{ userId: string; target: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const counts = useMemo(() => countWechatStatuses(participants), [participants])

  async function advance(participant: SeasonParticipant, target: string, successMessage: string) {
    setError(null)
    setNotice(null)
    setPending({ userId: participant.userId, target })
    const { data, error: requestError } = await updateParticipantWechat(
      seasonId,
      participant.userId,
      target,
    )
    setPending(null)

    if (requestError) {
      setError(requestError.body.error.message)
      return
    }
    if (data) {
      setParticipants((current) =>
        current.map((row) => (row.userId === data.userId ? data : row)),
      )
    }
    setNotice(successMessage)
    router.refresh()
  }

  return (
    <div className="grid gap-6">
      <ManualGroupNotice />

      <div className="grid gap-2">
        <FieldError>{error}</FieldError>
        {notice ? (
          <p role="status" className="text-body-sm text-brand-text">
            {notice}
          </p>
        ) : null}
      </div>

      <section className="ui-panel" aria-labelledby="manual-group-list-title">
        <div className="mb-4 grid gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="manual-group-list-title" className="text-h3 font-bold text-foreground">
              选手名单
              <span className="ml-3 font-mono text-meta text-muted-foreground">
                {participants.length} 人
              </span>
            </h2>
            <p className="font-mono text-meta text-muted-foreground">{wechatCountLabel(counts)}</p>
          </div>
          <p className="ui-hint">状态变更会写入审计日志，记录操作人与时间。</p>
        </div>

        <ParticipantsTable
          participants={participants}
          seasonCode={seasonCode}
          renderActions={(participant) => (
            <RowActions
              participant={participant}
              pendingTarget={
                pending?.userId === participant.userId ? pending.target : null
              }
              disabled={pending !== null}
              onAdvance={advance}
            />
          )}
        />
      </section>
    </div>
  )
}

/**
 * 一行状态摘要：`未邀请 3 · 已邀请 1 · 已加入 8 · 邀请失败 0`。
 *
 * 只列有值的项？不 —— 主办方最关心的是「还剩几个没进群」，0 也要显示，
 * 否则他会怀疑是没统计到。四个状态全列，顺序与状态机一致。
 */
function wechatCountLabel(counts: WechatCounts): string {
  return `未邀请 ${counts.notInvited} · 已邀请 ${counts.invited} · 已加入 ${counts.joined} · 邀请失败 ${counts.failed}`
}

/**
 * 一行的操作按钮。
 *
 * 动作列表来自纯函数 `wechatActionsFor`（已加入 / 已退出 → 空数组），
 * 这里只负责渲染与禁用态：任何一个请求在飞时，全表的按钮都禁用，
 * 避免连点把状态机推到意想不到的地方。
 */
function RowActions({
  participant,
  pendingTarget,
  disabled,
  onAdvance,
}: {
  participant: SeasonParticipant
  pendingTarget: string | null
  disabled: boolean
  onAdvance: (
    participant: SeasonParticipant,
    target: string,
    successMessage: string,
  ) => Promise<void>
}) {
  const actions = wechatActionsFor(participant)
  if (actions.length === 0) {
    // 已加入 / 已退出：没有可做的动作。给一个短说明而不是空白，
    // 否则会被读成「按钮没渲染出来」。
    return <span className="text-meta text-muted-foreground">{participantLockReason(participant)}</span>
  }

  return (
    // 不折行：已邀请那一行有两颗按钮，折起来会把整行撑高、和相邻行错位。
    // 表格本来就允许横向滚动（`overflow-x-auto`），宁可让表格宽一点。
    <div className="flex flex-nowrap items-center gap-2">
      {actions.map((action) => {
        const busy = pendingTarget === action.target
        return (
          <Button
            key={action.target}
            variant={action.variant}
            size="sm"
            disabled={disabled}
            aria-busy={busy || undefined}
            className="whitespace-nowrap"
            onClick={() => onAdvance(participant, action.target, action.successMessage)}
          >
            {busy ? '处理中…' : action.label}
          </Button>
        )
      })}
    </div>
  )
}
