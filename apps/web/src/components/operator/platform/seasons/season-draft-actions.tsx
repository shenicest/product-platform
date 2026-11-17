'use client'

import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SeasonDraftDialog } from '@/components/organizer/season-draft-dialog'
import { getSeasonManageDetail } from '@/lib/organizer-api'
import {
  draftFromPreviousSeason,
  emptySeasonDraft,
  suggestSeasonCode,
  type OrganizerOrg,
  type SeasonDraftValues,
} from '@/lib/organizer'
import type { PlatformSeasonRow } from '@/lib/platform-console'

/**
 * 「发起赛季草稿 / 复制上季」两个入口。
 *
 * 复用主办方后台的 `SeasonDraftDialog`（同一张表单、同一套校验、同一个
 * `POST /seasons`），只把「新建成功后落到哪一屏」改成平台后台的预览页：
 * 管理员建完一份草稿，接下来要做的是补齐内容再提交待批，留在平台后台里最顺。
 *
 * 两个按钮都只会新增草稿。后端 `POST /seasons` 固定写 `draft`，不会顺带把任何
 * 赛季推进到发布状态 —— 所以主办方组织成员也能用（发起草稿本来就是他们的权限）。
 */
export function SeasonDraftActions({
  organizerOrgs,
  seasons,
}: {
  organizerOrgs: OrganizerOrg[]
  seasons: PlatformSeasonRow[]
}) {
  const [dialog, setDialog] = useState<'create' | 'copy' | null>(null)
  const [draft, setDraft] = useState<SeasonDraftValues | null>(null)
  const [sourceSeasonName, setSourceSeasonName] = useState<string | undefined>(undefined)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  // 「上一个赛季」= 最近更新的那个（后端管理列表按 updatedAt 倒序）。
  const sourceSeason = seasons[0]

  const closeDialog = useCallback(() => {
    setDialog(null)
    setDraft(null)
    triggerRef.current?.focus()
  }, [])

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
      // 编号全局唯一：按「原编号 + 下一个后缀」给个建议值，用户仍可改。
      code: suggestSeasonCode(data.code, seasons.map((season) => season.code)),
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button ref={triggerRef} onClick={openCreate} disabled={Boolean(dialog)}>
          发起赛季草稿
        </Button>
        <Button
          variant="secondary"
          onClick={openCopy}
          disabled={Boolean(dialog) || seasons.length === 0}
          aria-describedby={seasons.length === 0 ? 'platform-copy-season-hint' : undefined}
        >
          复制上季
        </Button>
      </div>
      {seasons.length === 0 ? (
        <span id="platform-copy-season-hint" className="ui-hint">
          还没有可复制的赛季
        </span>
      ) : null}
      {sourceError ? (
        <p role="alert" className="ui-field-error">
          {sourceError}
        </p>
      ) : null}

      {dialog ? (
        <SeasonDraftDialog
          mode={dialog}
          draft={draft}
          organizerOrgs={organizerOrgs}
          sourceSeasonName={sourceSeasonName}
          onDraftChange={setDraft}
          onClose={closeDialog}
          returnFocusRef={triggerRef}
          redirectAfterCreate={(seasonId) => `/operator/boomland/seasons/${seasonId}`}
        />
      ) : null}
    </div>
  )
}
