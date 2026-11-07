'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ApplicationStatusBadge } from '@/components/boomland/application-status-badge'
import { SeasonStatusBadge } from '@/components/boomland/season-status-badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { withdrawSeasonApplication } from '@/lib/boomland-api'
import {
  formatDateTime,
  participantLabel,
  wechatStatusLabel,
  type MySeasonApplication,
} from '@/lib/boomland'

const WITHDRAWABLE = new Set(['submitted', 'pending', 'waitlisted'])

function ApplicationCard({ item }: { item: MySeasonApplication }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { application, season, wechatStatus } = item
  const canWithdraw = WITHDRAWABLE.has(application.status)

  async function onWithdraw() {
    setPending(true)
    setError(null)
    const { error: apiError } = await withdrawSeasonApplication(application.id)
    setPending(false)
    if (apiError) {
      setError(apiError.body.error.message || '撤回失败，请稍后重试')
      return
    }
    setConfirming(false)
    router.refresh()
  }

  return (
    <article className="ui-card ui-card--static">
      <div className="card-body">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <SeasonStatusBadge status={season.status} />
            <ApplicationStatusBadge status={application.status} />
            {wechatStatus ? (
              <Chip tone={wechatStatus === 'joined' ? 'success' : 'neutral'}>
                微信群 · {wechatStatusLabel(wechatStatus)}
              </Chip>
            ) : null}
          </div>
          <span className="font-mono text-meta text-muted-foreground">
            {formatDateTime(application.createdAt)}
          </span>
        </div>

        <h3 className="card-title mt-2">
          <Link href={`/seasons?season=${season.id}`} className="transition-colors hover:text-brand-text">
            {season.name}
          </Link>
        </h3>
        <p className="card-text">
          报名方向：{application.themes.join('、') || '—'} · {participantLabel(season)}
        </p>

        {application.reviewReason ? (
          <p className="mt-2 rounded-md border border-dashed border-border px-3 py-2 text-body-sm text-muted-foreground">
            审核备注：{application.reviewReason}
          </p>
        ) : null}
      </div>

      <footer className="card-footer">
        <ButtonLink href={`/seasons?season=${season.id}`} variant="ghost" size="sm">
          查看赛季
        </ButtonLink>
        {canWithdraw ? (
          confirming ? (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onWithdraw} disabled={pending}>
                {pending ? '撤回中…' : '确认撤回'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
                取消
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
              撤回报名
            </Button>
          )
        ) : null}
      </footer>

      {error ? (
        <p role="alert" className="ui-field-error px-5 pb-4">
          {error}
        </p>
      ) : null}
    </article>
  )
}

export function MyApplicationsList({ items }: { items: MySeasonApplication[] }) {
  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <ApplicationCard key={item.application.id} item={item} />
      ))}
    </div>
  )
}
