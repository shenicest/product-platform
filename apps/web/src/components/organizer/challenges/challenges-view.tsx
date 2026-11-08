'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChallengeDraftDialog } from '@/components/organizer/challenges/challenge-draft-dialog'
import {
  ChallengeLibrarySection,
  CooperationSection,
} from '@/components/organizer/challenges/challenges-display'
import { CooperationEditorDialog } from '@/components/organizer/challenges/cooperation-editor-dialog'
import { ResourceFulfillmentSection } from '@/components/organizer/challenges/resource-fulfillment'
import {
  CHALLENGE_ROW_ACTION_LABELS,
  challengeRowActions,
  publishBlockedReason,
  type ChallengeDto,
  type ChallengeRowActionKey,
  type EnterpriseCooperationDto,
} from '@/lib/organizer-challenges'
import {
  archiveChallenge,
  closeChallenge,
  markChallengeReference,
  publishChallenge,
} from '@/lib/organizer-challenges-api'

/**
 * 命题与资源 tab 的客户端视图。
 *
 * 服务端页面负责取数（命题库 + 企业合作配置），这里只做交互：
 *   · 命题库行内动作（发布 / 转参考资料 / 编辑 / 关闭 / 归档）与草稿弹窗；
 *   · 资源兑现（逐条改状态、整表编辑）由 `ResourceFulfillmentSection` 自理；
 *   · 企业合作配置的整表编辑弹窗。
 *
 * 一条贯穿全文的规则：**每次写操作成功后都 `router.refresh()`**，让服务端重新
 * 取命题（含 `resources` 与派生字段），页面不会停在过期数据上；失败一律把后端
 * `error.message` 原样摆到 `role="alert"` 里，不吞错误。
 */
export function ChallengesView({
  seasonId,
  seasonName,
  themes,
  organizerNames,
  challenges,
  cooperations,
}: {
  seasonId: number
  seasonName: string
  /** 本赛季主题；命题草稿弹窗的「赛季主题」下拉数据源。 */
  themes: string[]
  /** 赛季主办方组织名；命题表格「企业」列显示它（契约 §3.1，不伪造企业归属）。 */
  organizerNames: string[]
  challenges: ChallengeDto[]
  cooperations: EnterpriseCooperationDto[]
}) {
  const router = useRouter()

  const [dialog, setDialog] = useState<'create' | { edit: ChallengeDto } | 'cooperations' | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const busy = pendingAction !== null

  /**
   * 统一的命题动作执行器。
   *
   * `key` 用 `命题 id:动作`，只禁用被点的那一个按钮 —— 整表一起禁用会让
   * 「刚发布完、还想给下一条点归档」变成两次等待。
   */
  async function runAction(
    challenge: ChallengeDto,
    action: ChallengeRowActionKey,
    run: () => Promise<{ error: { body: { error: { message: string } } } | null }>,
  ) {
    setActionError(null)
    setNotice(null)
    setPendingAction(`${challenge.id}:${action}`)
    const { error } = await run()
    setPendingAction(null)
    if (error) {
      setActionError(error.body.error.message)
      return
    }
    setNotice(`「${challenge.title}」已${CHALLENGE_ROW_ACTION_LABELS[action]}`)
    router.refresh()
  }

  return (
    <div className="grid gap-0">
      {actionError ? (
        <p role="alert" className="ui-field-error mb-4">
          {actionError}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="ui-note ui-note--success mb-4">
          {notice}
        </p>
      ) : null}

      <ChallengeLibrarySection
        items={challenges}
        organizerNames={organizerNames}
        actions={
          <Button onClick={() => setDialog('create')} disabled={busy}>
            新建命题草稿
          </Button>
        }
        renderActions={(challenge) => (
          <RowActions
            challenge={challenge}
            pendingAction={pendingAction}
            disabled={busy}
            onEdit={() => setDialog({ edit: challenge })}
            onAction={(action, run) => void runAction(challenge, action, run)}
          />
        )}
      />

      <ResourceFulfillmentSection challenges={challenges} />

      <CooperationSection
        items={cooperations}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDialog('cooperations')}
            disabled={busy}
            aria-label="编辑企业合作配置"
          >
            编辑
          </Button>
        }
      />

      {dialog === 'create' ? (
        <ChallengeDraftDialog
          seasonId={seasonId}
          seasonName={seasonName}
          themes={themes}
          mode="create"
          onCancel={() => setDialog(null)}
          onSaved={() => setDialog(null)}
        />
      ) : null}

      {dialog !== null && typeof dialog === 'object' ? (
        <ChallengeDraftDialog
          seasonId={seasonId}
          seasonName={seasonName}
          themes={themes}
          mode="edit"
          initial={dialog.edit}
          onCancel={() => setDialog(null)}
          onSaved={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'cooperations' ? (
        <CooperationEditorDialog
          seasonId={seasonId}
          items={cooperations}
          onCancel={() => setDialog(null)}
          onSaved={() => setDialog(null)}
        />
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 行内动作
// ---------------------------------------------------------------------------

/**
 * 一行内的命题动作。
 *
 * 动作集合来自纯函数 `challengeRowActions`（可单测），这里只负责摆位置、
 * 禁用态与「发布」的额外门槛：五件套不完整时发布按钮置灰，并把缺什么写进
 * `title` —— 与后端 `CHALLENGE_INCOMPLETE` 是同一个口径。
 *
 * 不适用的动作**不渲染**（而不是渲染成禁用）：一个永远点不动的「归档」
 * 只会让人反复去点。
 */
function RowActions({
  challenge,
  pendingAction,
  disabled,
  onEdit,
  onAction,
}: {
  challenge: ChallengeDto
  pendingAction: string | null
  disabled: boolean
  onEdit: () => void
  onAction: (
    action: ChallengeRowActionKey,
    run: () => Promise<{ error: { body: { error: { message: string } } } | null }>,
  ) => void
}) {
  const actions = challengeRowActions(challenge.status)
  if (actions.length === 0) {
    return <span className="text-meta text-muted-foreground">已归档</span>
  }

  const blockedReason = publishBlockedReason(challenge)

  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5">
      {actions.map((action) => {
        const pending = pendingAction === `${challenge.id}:${action}`
        const label = CHALLENGE_ROW_ACTION_LABELS[action]

        if (action === 'edit') {
          return (
            <Button
              key={action}
              variant="secondary"
              size="sm"
              onClick={onEdit}
              disabled={disabled}
              aria-label={`编辑 ${challenge.title}`}
            >
              编辑
            </Button>
          )
        }

        // 发布：五件套不完整时置灰，title 里说明还缺哪些字段。
        const publishBlocked = action === 'publish' && Boolean(blockedReason)
        return (
          <Button
            key={action}
            variant={action === 'publish' ? 'primary' : 'ghost'}
            size="sm"
            disabled={disabled || pending || publishBlocked}
            title={publishBlocked ? blockedReason : undefined}
            aria-label={`${label} ${challenge.title}`}
            onClick={() =>
              onAction(action, () => {
                if (action === 'publish') return publishChallenge(challenge.id)
                if (action === 'reference') return markChallengeReference(challenge.id)
                if (action === 'close') return closeChallenge(challenge.id)
                return archiveChallenge(challenge.id)
              })
            }
          >
            {pending ? `${label}中…` : label}
          </Button>
        )
      })}
    </span>
  )
}
