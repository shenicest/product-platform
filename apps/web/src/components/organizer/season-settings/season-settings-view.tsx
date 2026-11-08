'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnnouncementCategory, SeasonStatus, type SeasonRules } from '@shenicest/shared'
import { Button } from '@/components/ui/button'
import { FieldError, FormField, SelectInput, TextArea, TextInput } from '@/components/submit/form-fields'
import type { SeasonAnnouncement } from '@/lib/boomland'
import { announcementCategoryLabel, formatDateTime } from '@/lib/boomland'
import type { OrganizerOrg, SeasonManageDetail, SeasonReadiness } from '@/lib/organizer'
import type { SeasonSettingsDetail } from '@/lib/organizer-settings'
import {
  canApproveSeason,
  canCancelSeason,
  canCreateAnnouncement,
  canEditSeasonCore,
  canEditSeasonOrganizers,
  canEditSeasonRuleCard,
  canEditSeasonRules,
  canEditSeasonSchedule,
  canResumeSeason,
  canStartSeason,
  canSubmitSeason,
  canSuspendSeason,
  isPendingApproval,
  submitActionLabel,
  summarizeReadiness,
} from '@/lib/organizer-settings'
import {
  approveSeason,
  cancelSeason,
  createSeasonAnnouncement,
  rejectSeason,
  resumeSeason,
  startSeason,
  submitSeason,
  suspendSeason,
  updateSeasonRuleCard,
  updateSeasonRules,
  updateSeasonThemes,
} from '@/lib/organizer-settings-api'
import {
  toRuleCardDraft,
  ruleCardDraftEqual,
  toRuleCardPayload,
  validateRuleCardDraft,
  type RuleCardDraftItem,
} from '@/lib/organizer-rules'
import {
  toThemeDraft,
  toThemesPayload,
  themeDraftEqual,
  validateThemeDraft,
  type ThemeDraftItem,
} from '@/lib/organizer-themes'
import { RuleCardEditor } from '@/components/organizer/season-settings/rule-card-editor'
import { SeasonThemesEditor } from '@/components/organizer/season-settings/season-themes-editor'
import { SeasonInfoPreview } from '@/components/organizer/season-settings/rule-card-preview'
import { SeasonRulesDialog } from '@/components/organizer/season-settings/season-rules-dialog'
import { SeasonCoreDialog } from '@/components/organizer/season-settings/season-core-dialog'
import { SeasonScheduleDialog } from '@/components/organizer/season-settings/season-schedule-dialog'
import {
  AnnouncementsSection,
  ReadinessSection,
  RulesSummaryCard,
  ScheduleSection,
  SeasonSummaryCard,
} from '@/components/organizer/season-settings/season-settings-display'

/**
 * 赛季设置 tab 的客户端视图。
 *
 * 服务端页面负责取数（detail / readiness / announcements / 组织下拉），这里只做
 * 交互：状态操作按钮、四个弹窗、规则卡草稿的本地编辑与保存。
 *
 * 一条贯穿全文的规则：**每次写操作成功后都 `router.refresh()`**，让服务端
 * 重新取 detail / readiness，页面不会停在过期数据上；失败一律把后端
 * `error.message` 原样摆到 `role="alert"` 里，不吞错误。
 */
export function SeasonSettingsView({
  detail,
  readiness,
  announcements,
  organizerOrgs,
  isOperator,
}: {
  detail: SeasonSettingsDetail
  readiness: SeasonReadiness | null
  announcements: SeasonAnnouncement[]
  organizerOrgs: OrganizerOrg[]
  isOperator: boolean
}) {
  const router = useRouter()

  const [dialog, setDialog] = useState<'core' | 'schedule' | 'rules' | 'reject' | 'cancel' | 'announcement' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const readinessSummary = useMemo(() => summarizeReadiness(readiness), [readiness])
  const ready = readinessSummary.total === 0 ? true : readinessSummary.ready

  // ---- 规则卡草稿 -----------------------------------------------------------
  // 草稿由 `RuleCardSection` 自己持有；这里只算「服务端已保存版本」，
  // 并把它序列化成 key —— 保存成功触发 router.refresh() 后 detail 变了，
  // key 跟着变，子树重挂载，草稿自动对齐到新数据（比在 effect 里 setState 干净）。
  const savedRuleCard = useMemo(() => toRuleCardDraft(detail.ruleCard), [detail.ruleCard])
  const ruleCardKey = useMemo(
    () => savedRuleCard.map((item) => `${item.key}\u0000${item.label}\u0000${item.value}\u0000${item.visible ? 1 : 0}`).join('\u0001'),
    [savedRuleCard],
  )
  const canEditCard = canEditSeasonRuleCard(detail.status)

  // ---- 赛季主题草稿 ---------------------------------------------------------
  // 与规则卡同一套「已保存版本序列化 key」的做法：保存成功 router.refresh()
  // 后 detail.themes 变了，key 跟着变，`SeasonThemesWorkspace` 重挂载，
  // 草稿自动对齐到服务端归一化后的结果（trim / 去重都在后端做）。
  const savedThemes = useMemo(() => toThemeDraft(detail.themes), [detail.themes])
  const themesKey = useMemo(
    () => savedThemes.map((item) => item.theme).join('\u0001'),
    [savedThemes],
  )
  // 主题与规则卡同状态口径（后端 `updateThemes` 与 `updateRuleCard` 一致）。
  const canEditThemes = canEditSeasonRuleCard(detail.status)

  const status = detail.status
  const approvedAt = detail.timestamps.approvedAt
  const pendingApproval = isPendingApproval(status, approvedAt)

  /** 统一的写操作执行器：pending 标记 + 错误落位 + 成功后刷新。 */
  async function runAction(
    key: string,
    action: () => Promise<{ data: unknown; error: { body: { error: { message: string } } } | null }>,
    onSuccess?: () => void,
  ) {
    setActionError(null)
    setPendingAction(key)
    const { error } = await action()
    setPendingAction(null)
    if (error) {
      setActionError(error.body.error.message)
      return false
    }
    onSuccess?.()
    router.refresh()
    return true
  }

  // ---- 类型化规则保存 -------------------------------------------------------
  async function saveRules(rules: SeasonRules) {
    const { error } = await updateSeasonRules(detail.id, { rules })
    if (error) return { ok: false, message: error.body.error.message }
    setDialog(null)
    router.refresh()
    return { ok: true }
  }

  const actionBusy = pendingAction !== null

  return (
    <div className="grid gap-0">
      <StatusNotice detail={detail} pendingApproval={pendingApproval} />

      {/* 概要卡 + 规则卡：窄屏单列，宽屏两列。 */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SeasonSummaryCard
          detail={detail}
          actions={
            <>
              {canEditSeasonCore(status) ? (
                <Button variant="secondary" size="sm" onClick={() => setDialog('core')} disabled={actionBusy}>
                  编辑赛季信息
                </Button>
              ) : canEditSeasonOrganizers(status, isOperator) ? (
                <Button variant="secondary" size="sm" onClick={() => setDialog('core')} disabled={actionBusy}>
                  调整主办方组织
                </Button>
              ) : null}

              {canSubmitSeason(status) ? (
                <Button
                  size="sm"
                  onClick={() => runAction('submit', () => submitSeason(detail.id))}
                  disabled={actionBusy || !ready}
                  aria-describedby={!ready ? 'submit-blocked-hint' : undefined}
                >
                  {pendingAction === 'submit' ? '提交中…' : submitActionLabel(isOperator)}
                </Button>
              ) : null}

              {canApproveSeason(status, approvedAt, isOperator) ? (
                <Button
                  size="sm"
                  onClick={() => runAction('approve', () => approveSeason(detail.id))}
                  disabled={actionBusy || !ready}
                >
                  {pendingAction === 'approve' ? '批准中…' : '批准'}
                </Button>
              ) : null}

              {canApproveSeason(status, approvedAt, isOperator) ? (
                <Button variant="secondary" size="sm" onClick={() => setDialog('reject')} disabled={actionBusy}>
                  驳回
                </Button>
              ) : null}

              {canStartSeason(status, approvedAt) ? (
                <Button
                  size="sm"
                  onClick={() => runAction('start', () => startSeason(detail.id))}
                  disabled={actionBusy}
                >
                  {pendingAction === 'start' ? '开赛中…' : '开赛'}
                </Button>
              ) : null}

              {canSuspendSeason(status) ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => runAction('suspend', () => suspendSeason(detail.id))}
                  disabled={actionBusy}
                >
                  暂停
                </Button>
              ) : null}

              {canResumeSeason(status) ? (
                <Button
                  size="sm"
                  onClick={() => runAction('resume', () => resumeSeason(detail.id))}
                  disabled={actionBusy}
                >
                  恢复
                </Button>
              ) : null}

              {canCancelSeason(status, detail.timestamps.statusBeforeSuspend) ? (
                <Button variant="ghost" size="sm" onClick={() => setDialog('cancel')} disabled={actionBusy}>
                  取消赛季
                </Button>
              ) : null}
            </>
          }
        />

        <RulesSummaryCard
          detail={detail}
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDialog('rules')}
              disabled={actionBusy || !canEditSeasonRules(status)}
              title={canEditSeasonRules(status) ? undefined : '开赛后不能修改类型化规则'}
              aria-describedby={canEditSeasonRules(status) ? undefined : 'rules-locked-hint'}
            >
              修改规则
            </Button>
          }
        />
      </div>

      {!ready ? (
        <p id="submit-blocked-hint" className="ui-hint mt-3">
          发布门槛还有 {readinessSummary.missing.length} 项未通过，提交与批准暂不可用。
        </p>
      ) : null}

      {!canEditSeasonRules(status) ? (
        <p id="rules-locked-hint" className="ui-hint mt-2">
          开赛后不能修改类型化规则。
        </p>
      ) : null}

      {actionError ? (
        <p role="alert" className="ui-field-error mt-3">
          {actionError}
        </p>
      ) : null}

      {pendingApproval ? (
        <p className="ui-note ui-note--warning mt-4">
          已提交，等待平台管理员批准；批准后赛季才会出现在大厅与火热赛季。
        </p>
      ) : null}

      {detail.rejection ? (
        <p className="ui-note ui-note--danger mt-4">
          上次提交被驳回（{formatDateTime(detail.rejection.at)}）：{detail.rejection.reason}
        </p>
      ) : null}

      <ReadinessSection
        readiness={readiness}
        summary={readinessSummary}
        seasonId={detail.id}
      />

      <ScheduleSection
        schedule={detail.schedule}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDialog('schedule')}
            disabled={actionBusy || !canEditSeasonSchedule(status)}
            title={canEditSeasonSchedule(status) ? undefined : '当前状态不能修改赛程'}
          >
            改赛程
          </Button>
        }
      />

      {/* ---- 规则卡编辑 + 预览（共享同一份草稿） --------------------------- */}
      <RuleCardWorkspace
        key={ruleCardKey}
        seasonId={detail.id}
        detail={detail}
        savedItems={savedRuleCard}
        canEdit={canEditCard}
      />

      {/* ---- 赛季主题（独立区块，规则卡之后） ----------------------------- */}
      <SeasonThemesWorkspace
        key={themesKey}
        seasonId={detail.id}
        savedThemes={savedThemes}
        canEdit={canEditThemes}
      />

      <AnnouncementsSection
        announcements={announcements}
        actions={
          canCreateAnnouncement(status, approvedAt) ? (
            <Button variant="secondary" size="sm" onClick={() => setDialog('announcement')} disabled={actionBusy}>
              发布公告
            </Button>
          ) : null
        }
      />

      {/* ---- 弹窗 ---------------------------------------------------------- */}
      {dialog === 'core' ? (
        <SeasonCoreDialog
          detail={detail}
          organizerOrgs={organizerOrgs}
          canEditCore={canEditSeasonCore(status)}
          canEditOrganizers={canEditSeasonOrganizers(status, isOperator)}
          onCancel={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            router.refresh()
          }}
        />
      ) : null}

      {dialog === 'schedule' ? (
        <SeasonScheduleDialog
          seasonId={detail.id}
          schedule={detail.schedule}
          onCancel={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            router.refresh()
          }}
        />
      ) : null}

      {dialog === 'rules' ? (
        <SeasonRulesDialog
          rules={detail.rules}
          onCancel={() => setDialog(null)}
          onSave={saveRules}
        />
      ) : null}

      {dialog === 'reject' ? (
        <ReasonDialog
          title="驳回赛季"
          description="驳回后赛季回到草稿，主办方可以修改后重新提交。"
          submitLabel="驳回"
          onCancel={() => setDialog(null)}
          onSubmit={async (reason) => {
            const ok = await runAction('reject', () => rejectSeason(detail.id, reason))
            if (ok) setDialog(null)
            return ok
          }}
        />
      ) : null}

      {dialog === 'cancel' ? (
        <ReasonDialog
          title="取消赛季"
          description="取消后赛季不可恢复，也不可再修改。请填写取消原因，会记录在审计里。"
          submitLabel="确认取消"
          danger
          onCancel={() => setDialog(null)}
          onSubmit={async (reason) => {
            const ok = await runAction('cancel', () => cancelSeason(detail.id, reason))
            if (ok) setDialog(null)
            return ok
          }}
        />
      ) : null}

      {dialog === 'announcement' ? (
        <AnnouncementDialog
          seasonId={detail.id}
          onCancel={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 规则卡：编辑 + 预览
// ---------------------------------------------------------------------------

/**
 * 规则卡的编辑与预览共用一份草稿。
 *
 * 为什么单独抽一个组件而不是把 state 提到页面级：
 *   · 草稿只在「规则卡 + 预览」这两块里流动，跟状态操作按钮无关；
 *   · 保存成功后 `router.refresh()` 会让服务端返回新的 `detail.ruleCard`，
 *     父级用「已保存内容的序列化 key」重挂载本组件，草稿自动回到新数据 ——
 *     比在 effect 里 setState 更直接，也避开 react-hooks/set-state-in-effect。
 *
 * 编辑器自己渲染列表与新增/删除/排序（契约见 `rule-card-editor.tsx`）；
 * 这里只负责「保存规则卡 / 重置」两个按钮、错误与成功提示。
 */
function RuleCardWorkspace({
  seasonId,
  detail,
  savedItems,
  canEdit,
}: {
  seasonId: number
  detail: SeasonManageDetail
  savedItems: RuleCardDraftItem[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [items, setItems] = useState<RuleCardDraftItem[]>(savedItems)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const dirty = !ruleCardDraftEqual(items, savedItems)

  async function save() {
    setError(null)
    setNotice(null)
    const errors = validateRuleCardDraft(items)
    if (Object.keys(errors).length > 0) {
      setError(errors.items ?? Object.values(errors)[0] ?? '规则卡校验未通过')
      return
    }
    setPending(true)
    const { error: requestError } = await updateSeasonRuleCard(seasonId, {
      items: toRuleCardPayload(items),
    })
    setPending(false)
    if (requestError) {
      setError(requestError.body.error.message)
      return
    }
    setNotice('规则卡已保存')
    router.refresh()
  }

  function reset() {
    setItems(savedItems)
    setError(null)
    setNotice(null)
  }

  return (
    <>
      <section aria-labelledby="season-rule-card-title" className="mt-10">
        <div className="mb-4">
          <h2
            id="season-rule-card-title"
            className="flex flex-wrap items-baseline gap-3 text-h3 font-bold text-foreground"
          >
            规则卡
            <span className="font-mono text-meta text-muted-foreground">{items.length} 条</span>
          </h2>
          <p className="mt-2 max-w-3xl text-body-sm leading-relaxed text-muted-foreground">
            按条目配置和渲染：必要条目由赛季配置生成，不能手写也不能隐藏；可选条目可增删改和排序，条数不固定。发布后修改会生成规则版本并发布公告。
          </p>
        </div>

        <div className="ui-panel">
          <RuleCardEditor
            items={items}
            onChange={setItems}
            disabled={!canEdit || pending}
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={!canEdit || pending || !dirty}>
              {pending ? '保存中…' : '保存规则卡'}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={!dirty || pending}>
              重置
            </Button>
            <span className="ui-hint">{dirty ? '有未保存的改动' : '与已保存版本一致'}</span>
          </div>

          <div className="mt-3 grid gap-2">
            <FieldError>{error}</FieldError>
            {notice ? (
              <p role="status" className="text-body-sm text-brand-text">
                {notice}
              </p>
            ) : null}
            {!canEdit ? <p className="ui-hint">当前状态不能修改规则卡。</p> : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="season-rule-card-preview-title" className="mt-10">
        <div className="mb-4">
          <h2 id="season-rule-card-preview-title" className="text-h3 font-bold text-foreground">
            预览 · 赛季信息
          </h2>
          <p className="mt-2 max-w-3xl text-body-sm leading-relaxed text-muted-foreground">
            公开页看到的赛季信息：八行内容取自规则卡草稿里对应的必要条目，改完不必先保存就能看到最终效果。
          </p>
        </div>
        <SeasonInfoPreview detail={detail} items={items} />
      </section>
    </>
  )
}

// ---------------------------------------------------------------------------
// 赛季主题：独立区块
// ---------------------------------------------------------------------------

/**
 * 「赛季主题」区块：编辑 + 保存。
 *
 * 为什么单独成一个 `<section aria-labelledby>`，而不是塞进概要卡或规则卡：
 *   · 主题是**另一个数据源**（`seasons.themes`，`PUT /seasons/:id/themes`），
 *     保存失败/成功要各自说清楚，混在规则卡里会让人分不清哪块没存上；
 *   · 命题表单的「赛季主题」下拉直接吃这份数据，未来还会加更多消费方，
 *     给它一个稳定的区块标题（以及可深链的语义位置）更划算。
 *
 * 为什么「编辑赛季信息」弹窗里**保留**主题编辑（而不是删掉）：
 *   · 那个弹窗的字段是「赛季身份」，主题与名称/介绍同屏填写最顺手；删掉它会变成
 *     一次功能回退 —— 建赛季时填过主题的人，之后改名字时会发现主题不见了；
 *   · 两个入口指向同一份数据、同一条 `PUT`，不会产生不一致的数据，只是保存路径不同。
 *     真正需要的是「说清楚去哪改顺序」，所以我在弹窗的主题 hint 里指向了本区块
 *     （见 `season-core-dialog.tsx` 的 hint 文案）。
 *     代价是两处 UI 需要一起演进；换来的是「建赛季顺手填」和「开赛后单独维护」
 *     两种场景都不用绕路。
 *
 * 草稿对齐沿用 `RuleCardWorkspace` 的 key 重挂载做法：保存成功 `router.refresh()`
 * 后服务端返回归一化过的 `themes`，父级用它的序列化 key 重挂载本组件，
 * 草稿自动回到新数据 —— 比在 effect 里 setState 干净。
 */
function SeasonThemesWorkspace({
  seasonId,
  savedThemes,
  canEdit,
}: {
  seasonId: number
  savedThemes: ThemeDraftItem[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [items, setItems] = useState<ThemeDraftItem[]>(savedThemes)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const dirty = !themeDraftEqual(items, savedThemes)

  async function save() {
    setError(null)
    setNotice(null)
    const errors = validateThemeDraft(items)
    if (Object.keys(errors).length > 0) {
      setError(errors.items ?? Object.values(errors)[0] ?? '赛季主题校验未通过')
      return
    }
    setPending(true)
    const { error: requestError } = await updateSeasonThemes(seasonId, {
      themes: toThemesPayload(items),
    })
    setPending(false)
    if (requestError) {
      setError(requestError.body.error.message)
      return
    }
    setNotice('赛季主题已保存')
    router.refresh()
  }

  function reset() {
    setItems(savedThemes)
    setError(null)
    setNotice(null)
  }

  return (
    <section aria-labelledby="season-themes-title" className="mt-10">
      <div className="mb-4">
        <h2
          id="season-themes-title"
          className="flex flex-wrap items-baseline gap-3 text-h3 font-bold text-foreground"
        >
          赛季主题
          <span className="font-mono text-meta text-muted-foreground">{items.length} 个</span>
        </h2>
        <p className="mt-2 max-w-3xl text-body-sm leading-relaxed text-muted-foreground">
          赛季对外展示的方向列表：报名者从中选择自己的方向，命题也可以标注属于其中一个主题。
          顺序即展示顺序，拖动把手或用 Alt+↑ / Alt+↓ 调整；发布后修改会生成规则版本并发布公告。
        </p>
      </div>

      <div className="ui-panel">
        <SeasonThemesEditor items={items} onChange={setItems} disabled={!canEdit || pending} />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={!canEdit || pending || !dirty}>
            {pending ? '保存中…' : '保存主题'}
          </Button>
          <Button variant="ghost" onClick={reset} disabled={!dirty || pending}>
            重置
          </Button>
          {/* 文案与规则卡刻意区分开：两块并列在同一屏，读屏与测试都要能分清
              是哪一块「有未保存的改动」。 */}
          <span className="ui-hint">
            {dirty ? '主题有未保存的改动' : '主题与已保存版本一致'}
          </span>
        </div>

        <div className="mt-3 grid gap-2">
          <FieldError>{error}</FieldError>
          {notice ? (
            <p role="status" className="text-body-sm text-brand-text">
              {notice}
            </p>
          ) : null}
          {!canEdit ? (
            <p className="ui-hint">
              当前赛季状态不能修改赛季主题（只有草稿、即将开始、进行中与已暂停可改，已取消的赛季全部锁定）。
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 顶部状态提示
// ---------------------------------------------------------------------------

/**
 * 状态横幅。
 *
 * - 草稿：说明它不进入大厅、火热赛季、命题库与搜索；
 * - 已取消：把取消原因摆出来（这是主办方最需要看到的）；
 * - 其它：不占位置，由概要卡的状态 chip 表达。
 */
function StatusNotice({
  detail,
  pendingApproval,
}: {
  detail: SeasonManageDetail
  pendingApproval: boolean
}) {
  if (detail.status === SeasonStatus.Cancelled) {
    return (
      <div className="ui-note ui-note--danger">
        <div>
          <p className="font-bold">已取消</p>
          <p className="mt-1">
            {detail.timestamps.cancelReason
              ? `取消原因：${detail.timestamps.cancelReason}`
              : '这个赛季已取消，不可恢复。'}
          </p>
        </div>
      </div>
    )
  }

  if (detail.status === SeasonStatus.Draft) {
    return (
      <div className="ui-note ui-note--accent">
        <div>
          <p className="font-bold">草稿 · 未公开</p>
          <p className="mt-1">草稿不进入大厅、火热赛季、命题库与搜索。</p>
        </div>
      </div>
    )
  }

  if (pendingApproval) {
    return (
      <div className="ui-note ui-note--warning">
        <div>
          <p className="font-bold">待批准</p>
          <p className="mt-1">已提交，等待平台管理员批准；批准前不会公开。</p>
        </div>
      </div>
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// 通用弹窗外壳
// ---------------------------------------------------------------------------

/** 与 `organizer-header.tsx` 一致的弹窗外壳：遮罩 + ui-panel + Esc 关闭。 */
function DialogShell({
  title,
  description,
  onCancel,
  children,
}: {
  title: string
  description?: string
  onCancel: () => void
  children: React.ReactNode
}) {
  const uid = useId()
  const titleId = `${uid}-title`
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="ui-panel my-8 w-full max-w-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-h3 font-bold text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="mt-2 text-body-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onCancel}
            className="ui-btn ui-btn--ghost ui-btn--small"
            aria-label="关闭"
          >
            关闭
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** 填原因的操作弹窗（驳回 / 取消共用）。 */
function ReasonDialog({
  title,
  description,
  submitLabel,
  danger = false,
  onCancel,
  onSubmit,
}: {
  title: string
  description: string
  submitLabel: string
  danger?: boolean
  onCancel: () => void
  onSubmit: (reason: string) => Promise<boolean>
}) {
  const uid = useId()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const trimmed = reason.trim()
    if (trimmed.length < 2) {
      setError('请填写至少 2 个字符的原因')
      return
    }
    setPending(true)
    const ok = await onSubmit(trimmed)
    setPending(false)
    if (!ok) setError('操作失败，请查看页面上的错误提示')
  }

  return (
    <DialogShell title={title} description={description} onCancel={onCancel}>
      <form onSubmit={onSubmitForm} className="grid gap-4" noValidate aria-label={title}>
        <FormField
          label="原因"
          htmlFor={`${uid}-reason`}
          required
          hint="至少 2 个字符，会写进审计日志"
          error={error ?? undefined}
        >
          <TextArea
            id={`${uid}-reason`}
            name="reason"
            value={reason}
            onChange={setReason}
            rows={3}
            maxLength={2000}
          />
        </FormField>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant={danger ? 'secondary' : 'primary'} disabled={pending}>
            {pending ? '处理中…' : submitLabel}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            取消
          </Button>
        </div>
      </form>
    </DialogShell>
  )
}

/** 发布公告：标题 + 内容 + 分类。 */
function AnnouncementDialog({
  seasonId,
  onCancel,
  onSaved,
}: {
  seasonId: number
  onCancel: () => void
  onSaved: () => void
}) {
  const uid = useId()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<string>(AnnouncementCategory.General)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const categoryOptions = useMemo(
    () =>
      Object.values(AnnouncementCategory).map((value) => ({
        value,
        label: announcementCategoryLabel(value),
      })),
    [],
  )

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const next: Record<string, string> = {}
    if (title.trim().length < 2) next.title = '标题至少 2 个字符'
    else if (title.trim().length > 255) next.title = '标题最多 255 个字符'
    if (!content.trim()) next.content = '请填写公告内容'
    else if (content.trim().length > 5000) next.content = '公告内容最多 5000 个字符'
    setErrors(next)
    if (Object.keys(next).length > 0) {
      setFormError('请先修正标红的字段')
      return
    }

    setPending(true)
    const { error } = await createSeasonAnnouncement(seasonId, {
      title: title.trim(),
      content: content.trim(),
      category: category as AnnouncementCategory,
    })
    setPending(false)
    if (error) {
      setFormError(error.body.error.message)
      return
    }
    onSaved()
  }

  return (
    <DialogShell
      title="发布公告"
      description="公告会展示在赛季公开页；已批准的赛季才能发。"
      onCancel={onCancel}
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate aria-label="发布公告表单">
        <FormField label="标题" htmlFor={`${uid}-title`} required error={errors.title}>
          <TextInput
            id={`${uid}-title`}
            name="title"
            value={title}
            onChange={setTitle}
            maxLength={255}
          />
        </FormField>
        <FormField label="分类" htmlFor={`${uid}-category`}>
          <SelectInput
            id={`${uid}-category`}
            name="category"
            value={category}
            onChange={setCategory}
            options={categoryOptions}
          />
        </FormField>
        <FormField label="内容" htmlFor={`${uid}-content`} required error={errors.content}>
          <TextArea
            id={`${uid}-content`}
            name="content"
            value={content}
            onChange={setContent}
            rows={5}
            maxLength={5000}
          />
        </FormField>

        <FieldError>{formError}</FieldError>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? '发布中…' : '发布'}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            取消
          </Button>
        </div>
      </form>
    </DialogShell>
  )
}
