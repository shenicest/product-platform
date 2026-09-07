'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  acceptHackathonConnection,
  acceptTalentConnection,
  getConnections,
  ignoreHackathonConnection,
  ignoreTalentConnection,
} from '@/lib/client-api'
import { connectionItemStatusLabel, connectionSourceLabel, type ConnectionItem } from '@/lib/connections'
import { ConnectionRequestStatus } from '@shenicest/shared'

// Unified connections record panel (ticket 07). Contacts live only in
// component memory; they are never written to URL, localStorage, or analytics.
type SourceFilter = 'all' | 'talent' | 'hackathon'
const SOURCE_FILTERS: SourceFilter[] = ['all', 'talent', 'hackathon']
const SOURCE_FILTER_LABELS: Record<SourceFilter, string> = {
  all: '全部',
  talent: '人才',
  hackathon: '黑客松',
}
type View = 'received' | 'sent'
const VIEW_LABELS: Record<View, string> = {
  received: '收到的申请',
  sent: '我发起的',
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
  const router = useRouter()

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
    <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">CONNECTIONS / NETWORK</p>
          <h1 className="mt-3 text-4xl font-black">连接记录</h1>
        </div>
        <Link href="/hackathon/projects" className="btn-hard btn-ghost">
          去发现黑客松项目
        </Link>
      </div>
      <div className="mt-8 flex flex-wrap gap-2 border-b border-border pb-3">
        {(['received', 'sent'] as View[]).map((value) => (
          <button key={value} className={`chip-hard ${view === value ? 'chip-active' : ''}`} onClick={() => setView(value)}>
            {VIEW_LABELS[value]}
          </button>
        ))}
        <span className="mx-2 self-center text-border" aria-hidden>
          |
        </span>
        {SOURCE_FILTERS.map((value) => (
          <button key={value} className={`chip-hard ${source === value ? 'chip-active' : ''}`} onClick={() => setSource(value)}>
            {SOURCE_FILTER_LABELS[value]}
          </button>
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
          <div className="border border-dashed border-border py-20 text-center text-muted-foreground">这里还没有连接记录</div>
        )}
      </div>
      {actionError && <p className="mt-4 text-sm text-destructive">{actionError}</p>}
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
      className={`border bg-card p-5 ${highlighted ? 'border-2 border-primary' : 'border-border'}`}
      data-hackathon-request={connection.source === 'hackathon' ? connection.id : undefined}
    >
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="font-bold">
            <span className="chip-hard mr-2 align-middle">{connectionSourceLabel(connection.source)}</span>
            {identityName(party)}
          </p>
          <p className="mt-1 font-mono text-xs text-primary">
            {party.hasPublishedTalentProfile ? '公开人才档案' : '该用户暂未公开介绍'}
          </p>
        </div>
        <span className="chip-hard">{connectionItemStatusLabel(connection.status, view === 'sent')}</span>
      </div>
      {connection.source === 'hackathon' && connection.target.type === 'hackathon_project' && (
        <p className="mt-4 border-l-2 border-primary pl-3 text-sm">
          项目：
          {connection.target.unavailable || !connection.target.url ? (
            <span>{connection.target.name || '项目当前不可用'}</span>
          ) : (
            <Link href={connection.target.url} className="text-primary underline">
              {connection.target.name}
            </Link>
          )}
        </p>
      )}
      <p className="mt-4 text-sm text-muted-foreground">{connection.purpose}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm">{connection.message}</p>
      {/* Contacts render only for Accepted requests viewed by a party — other
          states never receive contact payloads, so nothing can leak. */}
      {accepted && connection.contacts ? (
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">我的联系方式</p>
          <ContactRows contacts={connection.contacts.mine} />
          <p className="mt-3 font-mono text-[10px] uppercase text-muted-foreground">对方联系方式</p>
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
            <button className="btn-hard btn-primary" onClick={onAcceptStart}>
              接受
            </button>
            <button
              className="btn-hard btn-ghost"
              onClick={async () => {
                const result =
                  connection.source === 'hackathon'
                    ? await ignoreHackathonConnection(connection.id)
                    : await ignoreTalentConnection(connection.id)
                if (result.error) onError(result.error.body.error.message)
                else onDone()
              }}
            >
              忽略
            </button>
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
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  return (
    <div className="mt-4 border border-primary/50 p-4">
      <p className="text-sm">接受后双方才能查看授权联系方式。</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          placeholder="微信"
          value={wechat}
          aria-label="微信"
          onChange={(event) => setWechat(event.target.value)}
          className="border border-input bg-background px-3 py-2"
        />
        <input
          placeholder="邮箱"
          aria-label="邮箱"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="border border-input bg-background px-3 py-2"
        />
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          className="btn-hard btn-primary"
          disabled={saving}
          onClick={async () => {
            if (!wechat.trim() && !email.trim()) {
              setError('至少提供微信或邮箱')
              return
            }
            setSaving(true)
            const contact = { wechat: wechat.trim() || undefined, email: email.trim() || undefined }
            const result =
              connection.source === 'hackathon'
                ? await acceptHackathonConnection(connection.id, contact)
                : await acceptTalentConnection(connection.id, contact)
            setSaving(false)
            if (result.error) setError(result.error.body.error.message)
            else onDone()
          }}
        >
          {saving ? '处理中...' : '接受连接'}
        </button>
        <button className="btn-hard btn-ghost" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  )
}

function ContactRows({ contacts }: { contacts: { wechat: string | null; email: string | null } }) {
  return (
    <>
      {contacts.wechat && (
        <button className="block font-mono text-xs text-primary" onClick={() => navigator.clipboard.writeText(contacts.wechat!)}>
          微信：{contacts.wechat} · 复制
        </button>
      )}
      {contacts.email && (
        <button className="block font-mono text-xs text-primary" onClick={() => navigator.clipboard.writeText(contacts.email!)}>
          邮箱：{contacts.email} · 复制
        </button>
      )}
    </>
  )
}
