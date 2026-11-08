'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  challengeResourceKindLabel,
  challengeResourceStatusLabel,
} from '@shenicest/shared'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/surface'
import { ResourceEditorDialog } from '@/components/organizer/challenges/resource-editor-dialog'
import {
  canEditChallenge,
  resourceQuantityLabel,
  resourceStatusOptions,
  type ChallengeDto,
  type ChallengeResourceDto,
} from '@/lib/organizer-challenges'
import { updateChallengeResource } from '@/lib/organizer-challenges-api'

/**
 * 资源兑现：按命题分组，逐条改状态。
 *
 * 口径（CHG-004）：只有「已提供 / 已使用」算已兑现，其余状态在公开页一律
 * 按「待确认」处理 —— 所以状态是**逐条人工维护**的，系统不做自动流转，
 * 这里也不显示「已兑现 x/y」这类汇总数（会让人以为系统在替他们推进）。
 *
 * 改状态立刻 `PATCH` 一条资源（不是整表），成功后 `router.refresh()`：
 * 服务端重新取命题，页面上的状态、审计与「能否编辑」都跟着更新。
 */
export function ResourceFulfillmentSection({ challenges }: { challenges: ChallengeDto[] }) {
  return (
    <section aria-labelledby="challenge-resources-title" className="mt-10">
      <div className="mb-4">
        <h2
          id="challenge-resources-title"
          className="flex flex-wrap items-baseline gap-3 text-h3 font-bold text-foreground"
        >
          资源兑现
          <span className="font-mono text-meta text-muted-foreground">
            {challenges.length} 个命题
          </span>
        </h2>
        <p className="mt-2 max-w-3xl text-body-sm leading-relaxed text-muted-foreground">
          按命题逐条跟踪企业承诺的资源。只有「已提供 / 已使用」在公开页算确定权益，
          其余状态按「待确认」处理；状态不自动流转，由主办方手动更新并写审计。
        </p>
      </div>

      {challenges.length === 0 ? (
        <EmptyState
          title="NO RESOURCES"
          description="还没有命题，也就没有资源清单。先在「命题库」里建一条命题。"
        />
      ) : (
        <ul className="grid gap-4">
          {challenges.map((challenge) => (
            <li key={challenge.id}>
              <ResourceCard challenge={challenge} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** 一个命题的资源卡片：标题 + 条数 + 「编辑资源」+ 资源行（或空态）。 */
function ResourceCard({ challenge }: { challenge: ChallengeDto }) {
  const [editing, setEditing] = useState(false)
  const locked = !canEditChallenge(challenge.status)

  return (
    <article className="ui-panel" aria-labelledby={`resource-card-${challenge.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`resource-card-${challenge.id}`} className="text-body-sm font-bold text-foreground">
            {challenge.title}
          </h3>
          <p className="mt-1 font-mono text-meta text-muted-foreground">
            {challenge.resources.length} 条资源
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setEditing(true)}
          disabled={locked}
          title={locked ? '已关闭或已归档的命题不可修改资源' : undefined}
          aria-label={`编辑资源 · ${challenge.title}`}
        >
          编辑资源
        </Button>
      </div>

      {challenge.resources.length === 0 ? (
        <p className="ui-note mt-4">
          {locked
            ? '这条命题还没有资源清单，且已锁定不可修改。'
            : '还没有资源清单。点「编辑资源」把企业承诺的数据、场地、渠道等逐条记下来。'}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="console-table" aria-label={`${challenge.title} 的资源清单`}>
            <thead>
              <tr>
                <th scope="col">类别</th>
                <th scope="col">资源</th>
                <th scope="col">数量 / 条件</th>
                <th scope="col">负责人</th>
                <th scope="col">状态</th>
              </tr>
            </thead>
            <tbody>
              {challenge.resources.map((resource) => (
                <ResourceRow
                  key={resource.id}
                  resource={resource}
                  locked={locked}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <ResourceEditorDialog
          challenge={challenge}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : null}
    </article>
  )
}

/**
 * 一条资源。
 *
 * 状态用原生 `<select>` + `ui-select`：六态的取值来自 shared 的
 * `CHALLENGE_RESOURCE_STATUSES`，选项文案来自 `..._LABELS`，不硬编码字符串。
 */
function ResourceRow({
  resource,
  locked,
}: {
  resource: ChallengeResourceDto
  locked: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const statusOptions = resourceStatusOptions()

  async function changeStatus(next: string) {
    if (next === resource.status) return
    setError(null)
    setPending(true)
    const { error: requestError } = await updateChallengeResource(resource.id, { status: next })
    setPending(false)
    if (requestError) {
      setError(requestError.body.error.message)
      return
    }
    router.refresh()
  }

  return (
    <tr data-resource-id={resource.id} data-status={resource.status}>
      <td className="whitespace-nowrap">
        <Chip tone="neutral" className="text-meta">
          {challengeResourceKindLabel(resource.kind)}
        </Chip>
      </td>
      <td className="min-w-48">
        <span className="block font-bold text-foreground">{resource.title}</span>
        {resource.conditions ? (
          <span className="mt-1 block text-meta text-muted-foreground">{resource.conditions}</span>
        ) : null}
      </td>
      <td className="min-w-40 text-muted-foreground">
        {resourceQuantityLabel(resource)}
      </td>
      <td className="min-w-32 text-muted-foreground">{resource.owner?.trim() || '—'}</td>
      <td className="min-w-36">
        <select
          value={resource.status}
          onChange={(event) => void changeStatus(event.target.value)}
          disabled={locked || pending}
          className="ui-select"
          aria-label={`${resource.title} 的兑现状态`}
          title={
            locked
              ? '已关闭或已归档的命题不可修改资源'
              : `当前：${challengeResourceStatusLabel(resource.status)}`
          }
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {pending ? <span className="ui-hint">保存中…</span> : null}
        {error ? (
          <span role="alert" className="ui-field-error">
            {error}
          </span>
        ) : null}
      </td>
    </tr>
  )
}
