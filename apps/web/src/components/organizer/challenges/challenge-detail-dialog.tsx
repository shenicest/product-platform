'use client'

import { ChallengeDialogShell } from '@/components/organizer/challenges/challenge-dialog-shell'
import { ChallengeDetailForm } from '@/components/organizer/challenges/challenge-detail-form'
import { challengeTitleLabel, type ChallengeDto } from '@/lib/organizer-challenges'

/**
 * 「编辑详情」弹窗：命题卡内容 / 评分与奖励 / 公开与权益。
 *
 * 与 `ChallengeDraftDialog` 分开是刻意的：草稿弹窗管的是「这条命题是什么」
 * （标题 / 类型 / 主题 / 容量 / 五件套），详情弹窗管的是「这条命题写清楚了吗」
 * （正文 / 权重 / 权益）。两批字段的校验口径不同（详情没有任何必填项），
 * 塞进同一个弹窗只会让两边都变长。
 *
 * 编辑**已发布**的命题会让版本号 +1（后端在内容更新时自增），所以这里对已发布
 * 的命题多一句提醒，并把「变更说明」指出来 —— 那是选手能看到的变更记录。
 */
export function ChallengeDetailDialog({
  challenge,
  onCancel,
  onSaved,
}: {
  challenge: ChallengeDto
  onCancel: () => void
  onSaved: () => void
}) {
  const published = challenge.status === 'published'
  return (
    <ChallengeDialogShell
      title={`编辑详情 · ${challengeTitleLabel(challenge.title)}`}
      description={
        published
          ? '这条命题已发布，保存详情会让版本号 +1，并在版本记录里留下一条变更说明。'
          : '详情字段都不是发布必填项（发布只看五件套），可以先填一半再回来补。'
      }
      onCancel={onCancel}
    >
      <ChallengeDetailForm challenge={challenge} onCancel={onCancel} onSaved={onSaved} />
    </ChallengeDialogShell>
  )
}
