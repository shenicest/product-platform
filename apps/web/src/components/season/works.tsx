import { Chip } from '@/components/ui/chip'
import {
  challengeById,
  projectById,
  workStatusMeta,
  type WorkspaceWork,
} from '@/lib/season-workspace'

/**
 * 作品/进度列表。选手、主办方、评委三端共用同一套行结构，
 * 只是操作区不同（通过 `renderAction` 注入），避免三份样式各写一遍。
 */
export function WorkStatusChip({ work }: { work: WorkspaceWork }) {
  const meta = workStatusMeta(work.status)
  return (
    <Chip tone={meta.tone} dot>
      {meta.label}
    </Chip>
  )
}

function ScoreCell({ work }: { work: WorkspaceWork }) {
  if (work.score === null) {
    return <span className="workspace-muted">待评分</span>
  }
  return (
    <span className="workspace-score">
      +{work.score}
      <small>积分</small>
    </span>
  )
}

export function WorkReviews({ work }: { work: WorkspaceWork }) {
  if (work.reviews.length === 0) return null
  return (
    <ul className="work-reviews" aria-label={`${work.title} 的评分记录`}>
      {work.reviews.map((review) => (
        <li key={review.id} className="work-review">
          <span className="work-review__judge">{review.judgeName}</span>
          <span className="work-review__score">+{review.score}</span>
          <span className="work-review__reason">{review.reason}</span>
          <span className="work-review__time">{review.createdAt}</span>
        </li>
      ))}
    </ul>
  )
}

export function WorkList({
  works,
  showProject = false,
  renderAction,
  emptyTitle = '还没有作品',
  emptyDescription = '提交第一份进度或作品后，它会出现在这里。',
}: {
  works: readonly WorkspaceWork[]
  showProject?: boolean
  renderAction?: (work: WorkspaceWork) => React.ReactNode
  emptyTitle?: string
  emptyDescription?: string
}) {
  if (works.length === 0) {
    return (
      <div className="workspace-empty">
        <p className="mono text-brand-text">{emptyTitle}</p>
        <p>{emptyDescription}</p>
      </div>
    )
  }

  return (
    <ul className="work-list">
      {works.map((work) => {
        const project = projectById(work.projectId)
        const challenge = challengeById(work.challengeId)
        return (
          <li key={work.id} className="work-row" data-work-id={work.id}>
            <div className="work-row__main">
              <div className="work-row__head">
                <span className="work-row__type">{work.type}</span>
                <h4 className="work-row__title">{work.title}</h4>
                <WorkStatusChip work={work} />
                <ScoreCell work={work} />
              </div>

              <p className="work-row__summary">{work.summary}</p>

              <div className="work-row__meta">
                {showProject && project ? (
                  <span>项目 · {project.name}</span>
                ) : null}
                <span>命题 · {challenge?.title ?? '未标注命题'}</span>
                <span>v{work.version}</span>
                <span>{work.authorName}</span>
                {work.contributors && work.contributors.length > 0 ? (
                  <span>贡献者 · {work.contributors.join('、')}</span>
                ) : null}
                {work.milestone ? <span>里程碑 · {work.milestone}</span> : null}
                <span>{work.createdAt}</span>
                <span>{work.publicScope}</span>
                {work.privateNote ? <span>含私密证据</span> : null}
                {work.attachments && work.attachments.length > 0 ? (
                  <span>附件 · {work.attachments.join('、')}</span>
                ) : null}
                {work.requestReview === false ? <span>未申请评分</span> : null}
                {work.externalLink ? (
                  <a
                    href={work.externalLink}
                    target="_blank"
                    rel="noreferrer"
                    className="workspace-link"
                  >
                    外部链接
                  </a>
                ) : null}
              </div>

              {work.reviewNote ? (
                <p className="work-row__note" role="note">
                  {work.reviewNote}
                </p>
              ) : null}

              <WorkReviews work={work} />
            </div>

            {renderAction ? (
              <div className="work-row__action">{renderAction(work)}</div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
