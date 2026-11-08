'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { SeasonDraftForm } from '@/components/organizer/season-draft-form'
import { SeasonPicker } from '@/components/organizer/season-picker'
import { getSeasonManageDetail } from '@/lib/organizer-api'
import { seasonStatusMeta } from '@/lib/boomland'
import {
  draftFromPreviousSeason,
  emptySeasonDraft,
  suggestSeasonCode,
  toSeasonPickerOptions,
  type OrganizerOrg,
  type PickableSeason,
  type SeasonDraftValues,
} from '@/lib/organizer'

/**
 * 选择器需要的最小赛季字段；由路由段 layout 从服务端取好后传进来。
 * 定义在 `lib/organizer.ts`（纯类型，方便单测与选择器共用）。
 */
export type { PickableSeason } from '@/lib/organizer'

/**
 * 主办方后台 Header：赛季选择器 + 两个按钮。
 *
 * 两个按钮的语义：
 *   · 发起赛季草稿 —— 打开空白表单，覆盖 `seasons` 表的全部业务字段；
 *   · 复制上季 —— 取“上一个赛季”（选择器里选中的那个；没选中时取列表里
 *     最近更新的赛季）作为模板，把同一张表单预填好。
 *
 * 两者都只走 `POST /seasons`：后端固定把新行写成 draft，既不改动源赛季，
 * 也不会顺带把任何赛季推进到发布状态。
 */
export function OrganizerHeader({
  seasons,
  organizerOrgs,
  seasonId,
  tab,
}: {
  seasons: PickableSeason[]
  organizerOrgs: OrganizerOrg[]
  seasonId: number | null
  tab: string
}) {
  const options = toSeasonPickerOptions(seasons)
  const [currentSeasonId, setCurrentSeasonId] = useState(seasonId)

  const [dialog, setDialog] = useState<'create' | 'copy' | null>(null)
  const [draft, setDraft] = useState<SeasonDraftValues | null>(null)
  const [sourceSeasonName, setSourceSeasonName] = useState<string | undefined>(undefined)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  // “上一个赛季”：优先用选择器里选中的那个，否则用列表里最近更新的赛季。
  // 列表为空时没有可复制的对象。
  const sourceSeason = (currentSeasonId !== null
    ? seasons.find((season) => season.id === currentSeasonId)
    : undefined) ?? seasons[0]
  // 当前选中的赛季（用于选择器旁的状态标记）；没选中具体赛季时没有。
  const currentSeason = currentSeasonId !== null
    ? seasons.find((season) => season.id === currentSeasonId)
    : undefined

  const closeDialog = useCallback(() => {
    setDialog(null)
    setDraft(null)
    triggerRef.current?.focus()
  }, [])

  // Esc 关闭；打开时把焦点移进弹窗。
  useEffect(() => {
    if (!dialog) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDialog()
    }
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dialog, closeDialog])

  function openCreate() {
    setSourceError(null)
    setSourceSeasonName(undefined)
    setDraft(emptySeasonDraft({ organizerOrgOptions: organizerOrgs.map((org) => org.id) }))
    setDialog('create')
  }

  async function openCopy() {
    setSourceError(null)
    if (!sourceSeason) {
      setSourceError('还没有可复制的赛季，先发起一个赛季草稿。')
      return
    }
    setDialog('copy')
    setDraft(null)
    const { data, error } = await getSeasonManageDetail(sourceSeason.id)
    if (error || !data) {
      setDialog(null)
      setSourceError(error?.body.error.message ?? '读取上一个赛季失败，请稍后重试。')
      return
    }
    const copied = draftFromPreviousSeason(data)
    setSourceSeasonName(data.name)
    setDraft({
      ...copied,
      // 编号已被占用，按“原编号 + 下一个后缀”给一个建议值，用户仍可改。
      code: suggestSeasonCode(data.code, seasons.map((season) => season.code)),
    })
  }

  return (
    <div className="grid gap-4 border-b border-border pb-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 sm:max-w-md">
          <SeasonPicker
            options={options}
            seasonId={seasonId}
            tab={tab}
            onSeasonChange={setCurrentSeasonId}
          />
        </div>

        {currentSeason ? <SeasonStatusChip season={currentSeason} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button ref={triggerRef} onClick={openCreate} disabled={Boolean(dialog)}>
            发起赛季草稿
          </Button>
          <Button
            variant="secondary"
            onClick={openCopy}
            disabled={Boolean(dialog) || seasons.length === 0}
            aria-describedby={seasons.length === 0 ? 'copy-season-hint' : undefined}
          >
            复制上季
          </Button>
          {seasons.length === 0 ? (
            <span id="copy-season-hint" className="ui-hint">
              还没有可复制的赛季
            </span>
          ) : null}
        </div>
      </div>

      <p className="ui-hint">
        两个入口都只会新增一份草稿，不会改变任何赛季的发布状态。
        {sourceSeason ? `「复制上季」以「${sourceSeason.name}」为模板。` : null}
      </p>

      {sourceError ? (
        <p role="alert" className="ui-field-error">
          {sourceError}
        </p>
      ) : null}

      {dialog ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="season-draft-dialog-title"
        >
          <div className="ui-panel my-8 w-full max-w-3xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="season-draft-dialog-title" className="text-h3 font-bold text-foreground">
                  {dialog === 'create' ? '发起赛季草稿' : '复制上季'}
                </h2>
                <p className="mt-2 text-body-sm text-muted-foreground">
                  {dialog === 'create'
                    ? '填写赛季的基础信息、赛程与规则。'
                    : sourceSeasonName
                      ? `已按「${sourceSeasonName}」预填，请确认编号与赛程。`
                      : '正在读取上一个赛季…'}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={closeDialog}
                className="ui-btn ui-btn--ghost ui-btn--small"
                aria-label="关闭"
              >
                关闭
              </button>
            </div>

            {draft ? (
              <SeasonDraftForm
                key={dialog + sourceSeasonName}
                value={draft}
                onChange={setDraft}
                organizerOrgOptions={organizerOrgs}
                mode={dialog}
                sourceSeasonName={sourceSeasonName}
                onCancel={closeDialog}
              />
            ) : (
              <p className="ui-hint" aria-live="polite">
                正在读取上一个赛季…
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * 选择器旁的当前赛季状态胶囊。
 *
 * 选项文本里已经带了状态，但下拉框收起后只剩一行文字；这里用一个带色胶囊
 * 把状态再强调一次（草稿灰、待批琥珀、进行中绿……），与公开页的
 * `SeasonStatusBadge` 同一套色板。待批准不是独立 status，所以先判
 * `upcoming + approvedAt 为空`。
 */
function SeasonStatusChip({ season }: { season: PickableSeason }) {
  const pending = season.status === 'upcoming' && !season.approvedAt
  const meta = pending
    ? { label: '待批准', tone: 'warning' as const }
    : seasonStatusMeta(season.status)
  return (
    <div className="flex items-end pb-1">
      <Chip tone={meta.tone} dot aria-label={`当前赛季状态：${meta.label}`}>
        {meta.label}
      </Chip>
    </div>
  )
}
