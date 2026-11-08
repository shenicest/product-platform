'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  OrganizerActionIcon,
  type OrganizerActionIconName,
} from '@/components/organizer/action-icon'
import { ChallengeDraftDialog } from '@/components/organizer/challenges/challenge-draft-dialog'
import { ChallengeDetailDialog } from '@/components/organizer/challenges/challenge-detail-dialog'
import {
  ChallengeLibrarySection,
  ChallengeProjectSection,
  ChallengeVersionSection,
  CooperationSection,
} from '@/components/organizer/challenges/challenges-display'
import { CooperationEditorDialog } from '@/components/organizer/challenges/cooperation-editor-dialog'
import { ResourceFulfillmentSection } from '@/components/organizer/challenges/resource-fulfillment'
import {
  CHALLENGE_ROW_ACTION_LABELS,
  canEditChallenge,
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
import { cn } from '@/lib/utils'

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

  const [dialog, setDialog] = useState<
    'create' | { edit: ChallengeDto } | { detail: ChallengeDto } | 'cooperations' | null
  >(null)
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
    // `min-w-0`：本组件是 `grid` 容器，grid item 的 `min-width` 默认 `auto`
    // 会取表格的 min-content 宽度，把 `overflow-x-auto` 架空、整张表顶破
    // `.shell--narrow`。归零最小宽度，滚动才真的发生在表格容器里。
    <div className="grid min-w-0 gap-0">
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
            onDetail={() => setDialog({ detail: challenge })}
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

      {/* 版本记录与「选择本命题的项目」都是纯展示（数据由命题库那一次请求带回）。 */}
      <ChallengeVersionSection items={challenges} />
      <ChallengeProjectSection items={challenges} />

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

      {dialog !== null && typeof dialog === 'object' && 'edit' in dialog ? (
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

      {dialog !== null && typeof dialog === 'object' && 'detail' in dialog ? (
        <ChallengeDetailDialog
          challenge={dialog.detail}
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
 *
 * **为什么是图标**：命题库有八列，操作列最多五个动作。文字按钮时「转参考资料」
 * 一颗就 90px 宽，五个并排 400px，把「命题标题」「企业」这类内容列挤成一行
 * 两三个字；图标按钮每个 32px，五个 180px 就够，加上冻结列还能横向滚动。
 * 语义不丢：`aria-label` 与原来的文字按钮完全一致（`发布` / `转参考资料` /
 * `编辑` / `编辑详情` / `关闭` / `归档` + 命题标题），`title` 带命题标题与进行中说明。
 *
 * 「编辑详情」与「编辑」是两个入口，不是重复：
 *   · `编辑`（铅笔）→ 命题草稿弹窗：标题 / 类型 / 主题 / 容量 / 五件套；
 *   · `编辑详情`（文档）→ 详情弹窗：命题卡正文 / 五维权重 / 七项权益 + 变更说明。
 * 详情字段没有必填项、校验口径也不同，合成一个弹窗只会让两边都变长。
 */
function RowActions({
  challenge,
  pendingAction,
  disabled,
  onEdit,
  onDetail,
  onAction,
}: {
  challenge: ChallengeDto
  pendingAction: string | null
  disabled: boolean
  onEdit: () => void
  onDetail: () => void
  onAction: (
    action: ChallengeRowActionKey,
    run: () => Promise<{ error: { body: { error: { message: string } } } | null }>,
  ) => void
}) {
  const actions = challengeRowActions(challenge.status)
  const editable = canEditChallenge(challenge.status)
  if (actions.length === 0) {
    // 已归档是终态，不是动作：保持纯文字说明。
    return <span className="text-meta text-muted-foreground">已归档</span>
  }

  const blockedReason = publishBlockedReason(challenge)

  return (
    <span className="flex flex-nowrap items-center justify-end gap-1.5">
      {/* 详情入口只在可编辑状态下出现：已关闭 / 已归档的命题后端会拒 PATCH。 */}
      {editable ? (
        <button
          type="button"
          className="ui-icon-btn ui-icon-btn--sm"
          onClick={onDetail}
          disabled={disabled}
          aria-label={`编辑详情 ${challenge.title}`}
          title={`编辑详情 ${challenge.title}（命题卡内容 / 评分与奖励 / 公开与权益）`}
        >
          <OrganizerActionIcon name="detail" />
        </button>
      ) : null}
      {actions.map((action) => {
        const pending = pendingAction === `${challenge.id}:${action}`
        const label = CHALLENGE_ROW_ACTION_LABELS[action]

        if (action === 'edit') {
          return (
            <button
              key={action}
              type="button"
              className="ui-icon-btn ui-icon-btn--sm"
              onClick={onEdit}
              disabled={disabled}
              aria-label={`编辑 ${challenge.title}`}
              title={`编辑 ${challenge.title}`}
            >
              <OrganizerActionIcon name="edit" />
            </button>
          )
        }

        // 发布：五件套不完整时置灰，title 里说明还缺哪些字段。
        const publishBlocked = action === 'publish' && Boolean(blockedReason)
        return (
          <button
            key={action}
            type="button"
            className={cn('ui-icon-btn ui-icon-btn--sm', ICON_TONE[action])}
            disabled={disabled || pending || publishBlocked}
            aria-label={`${label} ${challenge.title}`}
            aria-busy={pending || undefined}
            title={
              publishBlocked
                ? blockedReason ?? undefined
                : pending
                  ? `${label}中…（${challenge.title}）`
                  : `${label} ${challenge.title}`
            }
            onClick={() =>
              onAction(action, () => {
                if (action === 'publish') return publishChallenge(challenge.id)
                if (action === 'reference') return markChallengeReference(challenge.id)
                if (action === 'close') return closeChallenge(challenge.id)
                return archiveChallenge(challenge.id)
              })
            }
          >
            {pending ? (
              <span aria-hidden className="text-meta">
                …
              </span>
            ) : (
              <OrganizerActionIcon name={CHALLENGE_ACTION_ICON[action]} />
            )}
          </button>
        )
      })}
    </span>
  )
}

/** 动作 → 图标按钮配色。发布是主操作（实心品牌底），归档不可逆，用危险色。 */
const ICON_TONE: Record<ChallengeRowActionKey, string> = {
  publish: 'ui-icon-btn--brand-solid',
  reference: 'ui-icon-btn--warning',
  edit: '',
  close: 'ui-icon-btn--warning',
  archive: 'ui-icon-btn--danger',
}

/** 动作 → 图标形状（`edit` 在分支里单独渲染，这里只是补齐类型）。 */
const CHALLENGE_ACTION_ICON: Record<ChallengeRowActionKey, OrganizerActionIconName> = {
  publish: 'publish',
  reference: 'reference',
  edit: 'edit',
  close: 'close',
  archive: 'archive',
}
