'use client'

import { ChallengeDialogShell } from '@/components/organizer/challenges/challenge-dialog-shell'
import { ChallengeDraftForm } from '@/components/organizer/challenges/challenge-draft-form'
import type { ChallengeDto } from '@/lib/organizer-challenges'

/**
 * 「新建命题草稿」/「编辑命题」弹窗。
 *
 * 表单本体在 `ChallengeDraftForm` 里（新建与编辑共用同一份字段与校验），
 * 这里只负责外壳与文案差异 —— 把弹窗和表单拆开，是为了让表单能脱离弹窗
 * 单独渲染（单测直接测表单，不用先点开弹窗）。
 *
 * 编辑模式有一句额外提醒：改**已发布**的命题会让版本号 +1（后端
 * `update` 里对 published 自增 version），这是选手能看到的「命题变了」信号。
 */
export function ChallengeDraftDialog({
  seasonId,
  seasonName,
  themes,
  mode,
  initial,
  onCancel,
  onSaved,
}: {
  seasonId: number
  seasonName: string
  themes: readonly string[]
  mode: 'create' | 'edit'
  initial?: ChallengeDto | null
  onCancel: () => void
  onSaved: () => void
}) {
  const editing = mode === 'edit' && Boolean(initial)
  return (
    <ChallengeDialogShell
      title={editing ? '编辑命题' : '新建命题草稿'}
      description={
        editing
          ? initial?.status === 'published'
            ? '这条命题已发布，保存修改会让版本号 +1，选手会看到命题内容变了。'
            : '修改后不会自动发布；五件套齐了才能点「发布」。'
          : '新命题存为草稿，不会直接出现在公开页；五件套可以之后补齐，发布时才校验。'
      }
      onCancel={onCancel}
    >
      <ChallengeDraftForm
        seasonId={seasonId}
        seasonName={seasonName}
        themes={themes}
        mode={mode}
        initial={initial}
        onCancel={onCancel}
        onSaved={onSaved}
      />
    </ChallengeDialogShell>
  )
}
