'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOptionalAuth } from '@/components/auth-provider'
import { useOptionalUserInteraction } from '@/components/user-interaction-provider'
import { HeartIcon } from '@/components/ui/heart-icon'

/**
 * 点赞按钮 —— 设计稿 `.icon-button[data-save]` 的逐值翻译。
 *
 * 形态上有三件事必须照做，否则就不是设计稿的样子：
 *   1. 它是**圆形描边图标按钮**（38px、1px 描边、白底），不是文字按钮；
 *   2. **不显示点赞数** —— 数字只在需要"看数据"的地方出现，卡片上不占位；
 *   3. 已点赞时底色转花瓣粉、描边转粉、图标实心（由 `.ui-icon-btn`
 *      的 `[aria-pressed='true']` 规则统一承担，组件不写死颜色）。
 *
 * 位置由使用方决定：卡片里放在标题右侧（见 project-card.tsx）。
 *
 * 状态与请求仍走 UserInteractionProvider 的乐观更新；
 * 未登录时跳登录并把这次点击记在 sessionStorage 里，登录后自动补上。
 */
export function LikeButton({
  projectId,
  likeCount,
}: {
  projectId: number
  likeCount: number
}) {
  const router = useRouter()
  const auth = useOptionalAuth()
  const interaction = useOptionalUserInteraction()
  const user = auth?.user
  const [busy, setBusy] = useState(false)
  useEffect(
    () => interaction?.registerLikeCount(projectId, likeCount),
    [interaction, likeCount, projectId],
  )
  const isLiked = interaction?.liked.has(projectId) ?? false

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!user) {
      window.sessionStorage.setItem('shenicest_pending_like', String(projectId))
      router.push('/login')
      return
    }
    if (busy) return
    setBusy(true)
    try {
      if (!interaction) return
      if (isLiked) await interaction.unlike(projectId)
      else await interaction.like(projectId)
    } catch {
      /* provider 负责回滚 */
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="ui-icon-btn"
      aria-label={isLiked ? '取消喜欢' : '喜欢项目'}
      aria-pressed={isLiked}
      disabled={busy}
      onClick={handleClick}
    >
      {/* 爱心即状态：空心 = 未喜欢，实心 = 已喜欢。
          颜色全由 .ui-icon-btn 的语义 token 给出，图标只消费 currentColor。 */}
      <HeartIcon filled={isLiked} />
    </button>
  )
}
