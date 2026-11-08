import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'
import { workbenchTabBySlug } from '@/lib/me'

/**
 * 个人中心里本批**未实现**的 tab 的占位内容。
 *
 * 为什么不留空、也不隐藏这些 tab：隐藏会让用户以为个人中心只有「报名」和
 * 「组队」两屏，而产品里明明有 9 个入口；留一个说明「这一屏后面有什么」
 * 的占位，比一个点进去 404 的入口诚实得多。
 *
 * 每屏的说明文案写的是**这一屏将来会放什么**，不是「敬请期待」这种空话 ——
 * 用户读完能知道自己的东西会不会出现在这里。
 */
const PLACEHOLDER_COPY: Record<string, { lead: string; hint: string }> = {
  workbench: {
    lead: '这里会汇总你的赛季进展：报名与微信群状态、组队状态、项目与下一里程碑、待评分作品、积分与预计奖金、结果核验与奖励状态。',
    hint: '赛季开始后逐步开放。',
  },
  announcements: {
    lead: '这里会显示你参加的赛季发布的公告：赛程变更、规则变更与一般通知。',
    hint: '赛季公告目前仍可在赛季详情页查看。',
  },
  projects: {
    lead: '这里会列出你参与的赛季项目：主命题、核心成员、当前阶段与逐季战果。',
    hint: '在「组队」里发起项目后，赛季项目会出现在这里。',
  },
  works: {
    lead: '这里会列出你发布过的作品与赛季作品：赛季标识、评分状态与公开范围。',
    hint: '作品发布与评分尚未开放。',
  },
  following: {
    lead: '这里会显示你关注的创始人与项目动态。关注只影响你本人可见的内容，不产生任何数值。',
    hint: '现有的关注列表在「我的关注」页。',
  },
  growth: {
    lead: '这里会显示你的个人成长值与 Boom 值：长期保留、不随赛季清零。',
    hint: '成长值随赛季贡献累计后开放。',
  },
  rewards: {
    lead: '这里会显示你的赛季奖励：预计、已核定与已发放分开列出，并可查看发放记录。',
    hint: '奖励在赛季结算后产生。',
  },
}

export function WorkbenchPlaceholder({ slug }: { slug: string }) {
  const tab = workbenchTabBySlug(slug)
  const copy = PLACEHOLDER_COPY[slug]

  return (
    <div>
      <Eyebrow>{tab ? `ME / ${tab.slug.toUpperCase()}` : 'ME'}</Eyebrow>
      <h2 className="page-title mt-3">{tab?.label ?? '个人中心'}</h2>
      <p className="page-lead">{copy?.lead ?? '这一屏还在建设中。'}</p>

      <div className="mt-8">
        <EmptyState
          title="COMING SOON"
          description={copy?.hint ?? '该功能尚未开放。'}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/me/applications" variant="secondary">
                我的报名
              </ButtonLink>
              <ButtonLink href="/me/team" variant="ghost">
                去组队
              </ButtonLink>
            </div>
          }
        />
      </div>
    </div>
  )
}
