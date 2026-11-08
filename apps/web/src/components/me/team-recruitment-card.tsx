'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  RecruitmentApplicationStatus,
  RecruitmentCardStatus,
} from '@shenicest/shared'
import { Button, ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { TeamRecruitmentDialog } from '@/components/me/team-recruitment-dialog'
import {
  listCardApplications,
  updateRecruitmentApplication,
  updateRecruitmentCard,
} from '@/lib/team-api'
import {
  formatDeadlineLabel,
  recruitmentApplicationMeta,
  recruitmentCardStatusMeta,
  relativeTime,
} from '@/lib/team'
import type {
  ProjectOption,
  RecruitmentApplicationDto,
  RecruitmentCardDto,
} from '@/lib/team'
import { publicProfileHref } from '@/lib/me'

/**
 * 「招募卡与申请」卡（占两列宽）—— 组队 tab 的第 4 张卡。
 *
 * 三块内容：
 *   1. 我发布的招募卡（没有时给一句空态 + 发布入口）；
 *   2. 我收到的申请（发起人处理：接受 / 婉拒）；
 *   3. 我发出的申请（只读：项目名 + 状态 + 相对时间 + 口径说明）。
 *
 * 收到的申请不在首屏聚合里（契约 §2.1 只给 `recruitmentCard`），所以这一块
 * 在客户端按需拉取 `GET /recruitment-cards/:id/applications`。首屏不拉的理由：
 * 没有招募卡的人占多数，为少数人多付一次请求不划算。
 */
export function TeamRecruitmentCard({
  seasonId,
  seasonCode,
  card,
  myApplications,
  projects,
  defaultProjectId,
}: {
  seasonId: number
  seasonCode: string
  card: RecruitmentCardDto | null
  myApplications: RecruitmentApplicationDto[]
  projects: readonly ProjectOption[]
  defaultProjectId: number | null
}) {
  const router = useRouter()
  // 收到的申请按 `cardId` 一起存：换卡（重新发布）后旧的列表自动作废，
  // 不需要在 effect 里 setState 把它清空 —— 在 effect 里同步 setState 会
  // 触发级联渲染（react-hooks/set-state-in-effect）。
  const [received, setReceived] = useState<{
    cardId: number
    items: RecruitmentApplicationDto[]
  } | null>(null)
  const [loadError, setLoadError] = useState<{ cardId: number; message: string } | null>(
    null,
  )
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [cardPending, setCardPending] = useState(false)

  const cardId = card?.id ?? null
  const receivedItems = received && received.cardId === cardId ? received.items : null
  const receivedError = loadError && loadError.cardId === cardId ? loadError.message : null
  const loading = cardId !== null && receivedItems === null && receivedError === null

  useEffect(() => {
    if (cardId === null) return
    // 只在异步回调里 setState：effect 的职责是「发起请求 + 取消订阅」。
    let cancelled = false
    void listCardApplications(cardId).then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        setLoadError({
          cardId,
          message: error.body.error.message || '读取申请失败，请稍后重试',
        })
        return
      }
      setLoadError(null)
      setReceived({ cardId, items: data?.items ?? [] })
    })
    return () => {
      cancelled = true
    }
  }, [cardId])

  async function decide(
    applicationId: number,
    status:
      | typeof RecruitmentApplicationStatus.Accepted
      | typeof RecruitmentApplicationStatus.Declined,
  ) {
    setPendingId(applicationId)
    setActionError(null)
    const { error } = await updateRecruitmentApplication(applicationId, { status })
    setPendingId(null)
    if (error) {
      setActionError(error.body.error.message || '处理失败，请稍后重试')
      return
    }
    // 局部更新状态，再刷新服务端数据：卡上的 `applicationCount` 等聚合值
    // 由 RSC 重算，不需要在这里自己维护一份计数。
    setReceived((current) =>
      current && current.cardId === cardId
        ? {
            cardId: current.cardId,
            items: current.items.map((item) =>
              item.id === applicationId ? { ...item, status } : item,
            ),
          }
        : current,
    )
    router.refresh()
  }

  async function toggleCard() {
    if (!card) return
    setCardPending(true)
    setActionError(null)
    const nextStatus =
      card.status === RecruitmentCardStatus.Open
        ? RecruitmentCardStatus.Closed
        : RecruitmentCardStatus.Open
    const { error } = await updateRecruitmentCard(card.id, { status: nextStatus })
    setCardPending(false)
    if (error) {
      setActionError(error.body.error.message || '操作失败，请稍后重试')
      return
    }
    router.refresh()
  }

  const cardMeta = card ? recruitmentCardStatusMeta(card.status) : null

  return (
    <article className="ui-card ui-card--static lg:col-span-2">
      <div className="card-body">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="card-title">招募卡与申请</h2>
            <Chip tone="accent" aria-label="P1 能力">
              P1
            </Chip>
          </div>
          <TeamRecruitmentDialog
            seasonId={seasonId}
            projects={projects}
            defaultProjectId={defaultProjectId}
            label={card ? '重新发布招募卡' : '发布招募卡'}
          />
        </div>

        {/* 1. 我的招募卡 */}
        {card ? (
          <section className="ui-panel mt-4 grid gap-3" aria-label="我的招募卡">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="m-0 text-body-sm font-bold text-foreground">
                  {card.projectName}
                </h3>
                {cardMeta ? (
                  <Chip tone={cardMeta.tone} dot>
                    {cardMeta.label}
                  </Chip>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCard}
                disabled={cardPending}
              >
                {cardPending
                  ? '处理中…'
                  : card.status === RecruitmentCardStatus.Open
                    ? '关闭招募'
                    : '重新打开'}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {card.roles.map((role) => (
                <Chip key={role} tone="accent">
                  {role}
                </Chip>
              ))}
              {card.skills.map((skill) => (
                <Chip key={skill}>{skill}</Chip>
              ))}
            </div>

            <p className="card-text">{card.description}</p>

            <p className="ui-hint m-0">
              截止 {formatDeadlineLabel(card.deadline)} · 收到 {card.applicationCount} 份申请
            </p>

            <div>
              <h4 className="ui-label m-0">收到的申请</h4>
              {loading ? (
                <p className="ui-hint m-0 mt-2">读取申请中…</p>
              ) : receivedError ? (
                <p role="alert" className="ui-field-error mt-2">
                  {receivedError}
                </p>
              ) : (receivedItems ?? []).length === 0 ? (
                <p className="ui-hint m-0 mt-2">还没有人申请。</p>
              ) : (
                <ul className="m-0 mt-2 grid list-none gap-2 p-0">
                  {(receivedItems ?? []).map((application) => {
                    const meta = recruitmentApplicationMeta(application.status)
                    return (
                      <li
                        key={application.id}
                        className="rounded-md border border-border p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <a
                            href={publicProfileHref(application.applicantUserId)}
                            className="text-body-sm font-bold text-foreground no-underline hover:text-brand-text"
                          >
                            {application.applicant.name ??
                              `用户 #${application.applicantUserId}`}
                          </a>
                          <div className="flex flex-wrap items-center gap-2">
                            <Chip tone={meta.tone}>{meta.label}</Chip>
                            <span className="font-mono text-meta text-muted-foreground">
                              {relativeTime(application.createdAt)}
                            </span>
                          </div>
                        </div>
                        <p className="card-text mt-1">{application.message}</p>
                        {application.status === RecruitmentApplicationStatus.Pending ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                decide(application.id, RecruitmentApplicationStatus.Accepted)
                              }
                              disabled={pendingId === application.id}
                            >
                              {pendingId === application.id ? '处理中…' : '接受'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                decide(application.id, RecruitmentApplicationStatus.Declined)
                              }
                              disabled={pendingId === application.id}
                            >
                              婉拒
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>
        ) : (
          <p className="card-text mt-4">你还没有发布招募卡。</p>
        )}

        {/* 2. 我发出的申请 */}
        <section className="mt-6 grid gap-2" aria-label="我发出的申请">
          <h3 className="m-0 text-body-sm font-bold text-foreground">我发出的申请</h3>
          {myApplications.length === 0 ? (
            <p className="ui-hint m-0">
              还没有向别人的招募卡申请过。去共鸣之地看看 {seasonCode} 的招募卡。
            </p>
          ) : (
            <ul className="m-0 grid list-none gap-2 p-0">
              {myApplications.map((application) => {
                const meta = recruitmentApplicationMeta(application.status)
                return (
                  <li
                    key={application.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <span className="text-body-sm text-foreground">
                      {application.card.projectName}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone={meta.tone}>{meta.label}</Chip>
                      <span className="font-mono text-meta text-muted-foreground">
                        {relativeTime(application.createdAt)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <p className="ui-hint m-0">
            接受申请不等于登记为赛季核心成员：项目在进行中的赛季、对方又是本季未组队选手时，
            按组队规则登记并等对方确认；否则成为长期成员。
          </p>

          <div>
            <ButtonLink href="/talents" variant="ghost" size="sm">
              去共鸣之地看招募卡
            </ButtonLink>
          </div>
        </section>

        {actionError ? (
          <p role="alert" className="ui-field-error">
            {actionError}
          </p>
        ) : null}
      </div>
    </article>
  )
}
