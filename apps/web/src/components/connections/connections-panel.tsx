'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  acceptHackathonConnection,
  acceptProjectConnection,
  acceptTalentConnection,
  getConnections,
  ignoreHackathonConnection,
  ignoreProjectConnection,
  ignoreTalentConnection,
} from '@/lib/client-api'
import { connectionItemStatusLabel, connectionSourceLabel, type ConnectionItem } from '@/lib/connections'
import { ConnectionRequestStatus } from '@shenicest/shared'
import { Button } from '@/components/ui/button'
import { Chip, ChipButton, type ChipTone } from '@/components/ui/chip'
import { Eyebrow } from '@/components/ui/typography'

// Unified connections record panel (ticket 07). Contacts live only in
// component memory; they are never written to URL, localStorage, or analytics.
type SourceFilter = 'all' | 'talent' | 'hackathon' | 'project'
const SOURCE_FILTERS: SourceFilter[] = ['all', 'talent', 'hackathon', 'project']
const SOURCE_FILTER_LABELS: Record<SourceFilter, string> = {
  all: '全部',
  talent: '人才',
  hackathon: '黑客松',
  project: '项目',
}
type View = 'received' | 'sent'
const VIEW_LABELS: Record<View, string> = {
  received: '收到的申请',
  sent: '我发起的',
}

/** 来源 → 语义色；只走 Chip 的 tone。 */
const SOURCE_TONE: Record<ConnectionItem['source'], ChipTone> = {
  talent: 'sky',
  hackathon: 'accent',
  project: 'success',
}

const identityName = (party: ConnectionItem['sender']) => party.nickname || '平台用户'

export function ConnectionsPanel({
  initial,
  userId,
}: {
  initial: { data: ConnectionItem[]; pendingReceived: number };
  userId: string;
}) {
  const [data, setData] = useState(initial.data)
  const [view, setView] = useState<View>('received')
  const [source, setSource] = useState<SourceFilter>('all')
  const [accepting, setAccepting] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  async function refresh() {
    const result = await getConnections()
    if (result.data) {
      setData(result.data.data)
      setActionError('')
      // The nav / user-menu badges re-read pendingReceived on this event.
      window.dispatchEvent(new Event('connections-refresh'))
    }
  }

  // Mail return flow (PRD 12.3): /connections?request=<id> only scrolls to
  // and highlights the matching hackathon card — it is not an access token,
  // the server-side authorization stays the gate.
  const requestParam = useSearchParams().get('request')
  const highlightedRequestId = requestParam && /^\d+$/.test(requestParam) ? Number(requestParam) : null
  useEffect(() => {
    if (highlightedRequestId === null) return
    const target = document.querySelector(`[data-hackathon-request="${highlightedRequestId}"]`)
    target?.scrollIntoView({ block: 'center' })
  }, [highlightedRequestId, data.length, view, source])

  const filtered = data
    .toSorted((a, b) => {
      const pendingA = a.status === ConnectionRequestStatus.Pending && a.receiverUserId === userId
      const pendingB = b.status === ConnectionRequestStatus.Pending && b.receiverUserId === userId
      return Number(pendingB) - Number(pendingA) || (a.createdAt < b.createdAt ? 1 : -1)
    })
    .filter((item) => (source === 'all' ? true : item.source === source))
    .filter((item) => (view === 'received' ? item.receiverUserId === userId : item.senderUserId === userId))

  return (
    <section className="shell shell--narrow py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>CONNECTIONS / NETWORK</Eyebrow>
          <h1 className="mt-3 text-[clamp(2rem,3.4vw,2.75rem)] font-black leading-tight tracking-[-0.03em] text-foreground">
            连接记录
          </h1>
        </div>
        <p className="section-head__aside">
          PENDING: <b className="font-digits text-lg font-normal text-brand-text">{initial.pendingReceived}</b>
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-2 border-b border-border pb-3" role="group" aria-label="连接筛选">
        {(['received', 'sent'] as View[]).map((value) => (
          <ChipButton
            key={value}
            aria-pressed={view === value}
            onClick={() => setView(value)}
            tone={view === value ? 'accent' : 'neutral'}
          >
            {VIEW_LABELS[value]}
          </ChipButton>
        ))}
        <span className="mx-2 self-center text-border" aria-hidden>
          |
        </span>
        {SOURCE_FILTERS.map((value) => (
          <ChipButton
            key={value}
            aria-pressed={source === value}
            onClick={() => setSource(value)}
            tone={source === value ? 'accent' : 'neutral'}
          >
            {SOURCE_FILTER_LABELS[value]}
          </ChipButton>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {filtered.length ? (
          filtered.map((connection) => (
            <ConnectionCard
              key={`${connection.source}-${connection.id}`}
              connection={connection}
              view={view}
              highlighted={connection.source === 'hackathon' && connection.id === highlightedRequestId}
              accepting={accepting === `${connection.source}:${connection.id}`}
              onAcceptStart={() => setAccepting(`${connection.source}:${connection.id}`)}
              onAcceptCancel={() => setAccepting(null)}
              onDone={refresh}
              onError={setActionError}
            />
          ))
        ) : (
          <div className="ui-empty">这里还没有连接记录</div>
        )}
      </div>
      {actionError && <p className="ui-note ui-note--danger mt-4" role="alert">{actionError}</p>}
    </section>
  )
}

function ConnectionCard({
  connection,
  view,
  highlighted,
  accepting,
  onAcceptStart,
  onAcceptCancel,
  onDone,
  onError,
}: {
  connection: ConnectionItem
  view: View
  highlighted: boolean
  accepting: boolean
  onAcceptStart: () => void
  onAcceptCancel: () => void
  onDone: () => void
  onError: (message: string) => void
}) {
  const party = view === 'received' ? connection.sender : connection.receiver
  const accepted = connection.status === ConnectionRequestStatus.Accepted
  return (
    <article
      className={
        highlighted
          ? 'rounded-xl border-2 border-primary bg-card p-5 shadow-sm'
          : 'rounded-xl border border-border bg-card p-5 shadow-sm'
      }
      data-hackathon-request={connection.source === 'hackathon' ? connection.id : undefined}
    >
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-bold text-foreground">
            <Chip tone={SOURCE_TONE[connection.source]}>{connectionSourceLabel(connection.source)}</Chip>
            {connection.source === 'talent' ? identityName(party) : null}
          </p>
          {connection.source === 'talent' && (
            <p className="mt-1 font-mono text-meta tracking-[0.1em] text-brand-text">
              {party.hasPublishedTalentProfile ? '公开人才档案' : '该用户暂未公开介绍'}
            </p>
          )}
        </div>
        <Chip tone={accepted ? 'success' : 'neutral'}>
          {connectionItemStatusLabel(connection.status, view === 'sent')}
        </Chip>
      </div>
      {(connection.source === 'hackathon' || connection.source === 'project') &&
      (connection.target.type === 'hackathon_project' || connection.target.type === 'project') && (
        <p className="mt-4 border-l-2 border-brand-line pl-3 text-body-sm text-foreground">
          项目：
          {connection.target.unavailable || !connection.target.url ? (
            <span>{connection.target.name || '项目当前不可用'}</span>
          ) : (
            <Link href={connection.target.url} className="text-brand-text underline underline-offset-2">
              {connection.target.name}
            </Link>
          )}
        </p>
      )}

      <p className="mt-4 text-body-sm text-muted-foreground">{connection.purpose}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-body-sm text-foreground">{connection.message}</p>

      {/* Contacts render only for Accepted requests viewed by a party — other
          states never receive contact payloads, so nothing can leak. */}
      {accepted && connection.contacts ? (
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          <p className="eyebrow">我的联系方式</p>
          <ContactRows contacts={connection.contacts.mine} />
          <p className="eyebrow mt-3">对方联系方式</p>
          <ContactRows contacts={connection.contacts.other} />
        </div>
      ) : null}

      {view === 'received' && connection.status === ConnectionRequestStatus.Pending ? (
        accepting ? (
          <ContactAuthorizeForm
            connection={connection}
            onDone={() => {
              onAcceptCancel()
              onDone()
            }}
            onCancel={onAcceptCancel}
          />
        ) : (
          <div className="mt-4 flex gap-2">
            <Button variant="primary" size="sm" onClick={onAcceptStart}>
              接受
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const result =
                  connection.source === 'hackathon'
                    ? await ignoreHackathonConnection(connection.id)
                    : connection.source === 'project'
                      ? await ignoreProjectConnection(connection.id)
                      : await ignoreTalentConnection(connection.id)
                if (result.error) onError(result.error.body.error.message)
                else onDone()
              }}
            >
              忽略
            </Button>
          </div>
        )
      ) : null}
    </article>
  )
}

// Shared contact authorization form for both sources; the accept endpoint
// decides success, then the panel refetches the (sorted) aggregate.
function ContactAuthorizeForm({
  connection,
  onDone,
  onCancel,
}: {
  connection: ConnectionItem;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [wechat, setWechat] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const isProject = connection.source === 'project'
  return (
    <div className="mt-4 rounded-lg border border-brand-line bg-brand-wash p-4">
      <p className="text-body-sm text-foreground">接受后双方才能查看授权联系方式。</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          placeholder="微信"
          value={wechat}
          aria-label="微信"
          onChange={(event) => setWechat(event.target.value)}
          className="ui-input"
        />
        {isProject && (
          <input
            type="tel"
            placeholder="手机号"
            value={phone}
            aria-label="手机号"
            onChange={(event) => setPhone(event.target.value)}
            className="border border-input bg-background px-3 py-2"
          />
        )}
        <input
          placeholder="邮箱"
          value={email}
          aria-label="邮箱"
          onChange={(event) => setEmail(event.target.value)}
          className="ui-input"
        />
      </div>
      {error && <p className="mt-2 text-body-sm text-danger-text" role="alert">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={saving}
          onClick={async () => {
            if (!wechat.trim() && !email.trim() && !(isProject && phone.trim())) {
              setError(isProject ? '请至少填写微信、手机号或邮箱中的一项' : '至少提供微信或邮箱')
              return
            }
            if (isProject && phone.trim() && !/^[+\d][\d\s()-]*$/.test(phone.trim())) {
              setError('手机号格式不正确')
              return
            }
            setSaving(true)
            const contact = { wechat: wechat.trim() || undefined, email: email.trim() || undefined }
            const result =
              connection.source === 'hackathon'
                ? await acceptHackathonConnection(connection.id, contact)
                : connection.source === 'project'
                  ? await acceptProjectConnection(connection.id, {
                      ...contact,
                      phone: phone.trim() || undefined,
                    })
                  : await acceptTalentConnection(connection.id, contact)
            setSaving(false)
            if (result.error) setError(result.error.body.error.message)
            else onDone()
          }}
        >
          {saving ? '处理中...' : '接受连接'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  )
}

function ContactRows({ contacts }: { contacts: { wechat: string | null; phone?: string | null; email: string | null } }) {
  return (
    <>
      {contacts.wechat && (
        <button className="block font-mono text-meta tracking-[0.1em] text-brand-text" onClick={() => navigator.clipboard.writeText(contacts.wechat!)}>
          微信：{contacts.wechat} · 复制
        </button>
      )}
      {contacts.phone && (
        <button className="block font-mono text-xs text-primary" onClick={() => navigator.clipboard.writeText(contacts.phone!)}>
          手机号：{contacts.phone} · 复制
        </button>
      )}
      {contacts.email && (
        <button className="block font-mono text-meta tracking-[0.1em] text-brand-text" onClick={() => navigator.clipboard.writeText(contacts.email!)}>
          邮箱：{contacts.email} · 复制
        </button>
      )}
    </>
  )
}
