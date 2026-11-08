'use client'

import {
  SEASON_REQUIRED_RULE_CARD_KEYS,
  SEASON_REQUIRED_RULE_CARD_LABELS,
} from '@shenicest/shared'
import { Chip } from '@/components/ui/chip'
import { seasonStatusMeta, seasonTypeLabel } from '@/lib/boomland'
import type { SeasonManageDetail } from '@/lib/organizer'
import type { RuleCardDraftItem } from '@/lib/organizer-rules'

/**
 * 「预览 · 赛季信息」：公开页看到的赛季信息卡。
 *
 * 八行口径**取自规则卡草稿里对应必要条目的 value**，而不是再算一遍：
 * 这样主办方改完（保存前）就能看到公开页最终长什么样，也不会出现
 * 「预览自己算一份、公开页读另一份」的漂移。行标题同样来自 shared 的
 * `SEASON_REQUIRED_RULE_CARD_LABELS`，前端不硬编码这八条文案。
 *
 * 赛季名称 / 编号 / 类型 / 主办方组织 / 选手名额来自 `detail`（赛季行本身）。
 *
 * 视觉沿用现有体系：`ui-panel` 作卡片外壳、`InfoRow` 式的「标签 — 值」
 * 两列布局、`Chip` 作状态标记。
 */
export function SeasonInfoPreview({
  detail,
  items,
}: {
  detail: SeasonManageDetail
  items: RuleCardDraftItem[]
}) {
  const status = seasonStatusMeta(detail.status)
  const organizerNames = detail.organizerOrgs.map((org) => org.name)

  return (
    <div className="ui-panel grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="accent" className="font-mono">
              {detail.code}
            </Chip>
            <Chip tone={status.tone}>{status.label}</Chip>
          </div>
          <h3 className="mt-2 text-label font-bold text-foreground">{detail.name}</h3>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {seasonTypeLabel(detail.type)} · {organizerNames.length > 0 ? organizerNames.join('、') : '主办方待定'}
            {' · '}
            {detail.participantCapacity === null ? '名额不限' : `名额 ${detail.participantCapacity}`}
          </p>
        </div>
      </div>

      <dl className="grid gap-0">
        {SEASON_REQUIRED_RULE_CARD_KEYS.map((key) => {
          const item = items.find((candidate) => candidate.key === key)
          return (
            <div
              key={key}
              className="grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-3 border-b border-border-soft py-3 last:border-b-0"
            >
              <dt className="text-body-sm text-muted-foreground">{SEASON_REQUIRED_RULE_CARD_LABELS[key]}</dt>
              <dd className="min-w-0 text-body-sm text-foreground">
                {item?.value.trim() ? (
                  item.value.trim()
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>

      <p className="ui-hint">
        以上内容由赛季配置生成，公开页原样展示；可选条目在规则卡里另行展示。
      </p>
    </div>
  )
}
