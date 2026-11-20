'use client'

import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Eyebrow } from '@/components/ui/typography'
import {
  MY_USER_ID,
  challengeById,
  formatReward,
} from '@/lib/season-workspace'
import { useDemoState } from '@/lib/season-demo-store'

/** 个人中心「项目」tab：展示我发起或参与的项目，而不是全站项目列表。 */
export function MyProjects() {
  const demo = useDemoState()
  const myProjects = demo.projects.filter(
    (project) => project.ownerId === MY_USER_ID || project.members.includes('张一'),
  )
  return (
    <div className="workspace-page">
      <header className="workspace-head">
        <div>
          <Eyebrow>MY PROJECTS / 我的项目</Eyebrow>
          <h2 className="workspace-title">我参与的赛季项目</h2>
          <p className="workspace-lead">
            项目是赛季里的长期主体。每个项目最多选择 3 个平行命题，积分记在项目上，不按命题分账。
          </p>
        </div>
        <div className="workspace-head__meta">
          <ButtonLink href="/me/workbench" variant="primary">
            进入参赛台
          </ButtonLink>
          <ButtonLink href="/me/team" variant="secondary">
            组队管理
          </ButtonLink>
        </div>
      </header>

      <div className="workspace-project-grid">
        {myProjects.map((project) => (
          <article key={project.id} className="ui-panel workspace-project-card">
            <header className="workspace-project-card__head">
              <div>
                <span className="workspace-label">
                  {project.code} · {project.ownerId === MY_USER_ID ? '我发起' : '我参与'}
                </span>
                <h3>{project.name}</h3>
              </div>
              <Chip tone="success">{project.stage}</Chip>
            </header>

            <p className="workspace-project-card__summary">{project.summary}</p>

            <div className="workspace-chips">
              {project.challengeIds.map((challengeId) => {
                const challenge = challengeById(challengeId)
                return challenge ? (
                  <Chip key={challengeId}>{challenge.title}</Chip>
                ) : null
              })}
            </div>

            <dl className="workspace-project-card__facts">
              <div>
                <dt>核心成员</dt>
                <dd>{project.members.join(' · ')}</dd>
              </div>
              <div>
                <dt>作品 / 进度</dt>
                <dd>{demo.works.filter((work) => work.projectId === project.id).length} 份</dd>
              </div>
              <div>
                <dt>当前积分</dt>
                <dd>{project.score}</dd>
              </div>
              <div>
                <dt>预计奖金</dt>
                <dd>{formatReward(project.expectedReward)}</dd>
              </div>
            </dl>

            <div className="workspace-project-card__foot">
              <span className="workspace-muted">最近更新 {project.latestUpdate}</span>
              <Link href="/me/workbench" className="workspace-link">
                查看进度 <span aria-hidden>→</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
