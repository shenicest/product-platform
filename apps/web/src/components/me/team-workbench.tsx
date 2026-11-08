import { TeamProjectCard } from '@/components/me/team-project-card'
import { TeamWithdrawCard } from '@/components/me/team-withdraw-card'
import { TeamFindTeammatesCard } from '@/components/me/team-find-teammates-card'
import { TeamRecruitmentCard } from '@/components/me/team-recruitment-card'
import { TeamRulesCard } from '@/components/me/team-rules-card'
import { resolveMaxChallenges, type TeamWorkbenchDto } from '@/lib/team'
import type { ProjectOption, TeamChallengeDto } from '@/lib/team'

/**
 * 组队 tab 的 5 张卡（3 列网格）。
 *
 * 这一层是 Server Component：只做「把数据分给谁」的编排，没有任何交互状态。
 * 需要交互的四张卡（发起项目、退出确认、发布招募卡、处理申请）内部各自
 * 标 `'use client'`，其余保持 Server —— 首屏因此不会把整页打进客户端 bundle。
 *
 * 网格：宽屏 3 列（`.card-grid`），招募卡占两列（`lg:col-span-2`），
 * 于是第一行是 项目 / 退出 / 找队友，第二行是 招募卡（2 列）+ 组队规则。
 */
export function TeamWorkbench({
  data,
  challenges,
  bringableProjects,
}: {
  data: TeamWorkbenchDto
  /** 本赛季全部命题（含参考资料），用于发起项目弹窗。 */
  challenges: readonly TeamChallengeDto[]
  /** 我在产品共生里已有的项目，用于「带入已有项目」。 */
  bringableProjects: readonly ProjectOption[]
}) {
  const { season, participant, project, recruitmentCard, myApplications, stats, rules } = data
  const maxChallenges = resolveMaxChallenges(rules)

  // 发布招募卡的项目下拉：组队页只认识「我自己的赛季项目」。
  const myProjectOptions: ProjectOption[] = project
    ? [{ id: project.id, name: project.name, code: project.projectId }]
    : []

  return (
    <div className="card-grid">
      <TeamProjectCard
        seasonId={season.id}
        seasonCode={season.code}
        seasonThemes={season.themes}
        project={project}
        challenges={challenges}
        projects={bringableProjects}
        maxChallengesPerProject={maxChallenges}
      />

      <TeamWithdrawCard
        seasonId={season.id}
        seasonCode={season.code}
        userId={participant?.userId ?? ''}
        canWithdraw={participant?.canWithdraw ?? false}
        deadlinePassed={rules.deadlinePassed}
      />

      <TeamFindTeammatesCard
        seasonCode={season.code}
        unassignedParticipantCount={stats.unassignedParticipantCount}
        openRecruitmentCardCount={stats.openRecruitmentCardCount}
      />

      <TeamRecruitmentCard
        seasonId={season.id}
        seasonCode={season.code}
        card={recruitmentCard}
        myApplications={myApplications}
        projects={myProjectOptions}
        defaultProjectId={project?.id ?? null}
      />

      <TeamRulesCard rules={rules} />
    </div>
  )
}
