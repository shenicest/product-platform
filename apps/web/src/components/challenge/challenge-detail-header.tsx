'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Chip } from '@/components/ui/chip'
import { Button } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/typography'
import { useOptionalAuth } from '@/components/auth-provider'
import { challengeStatusMeta } from '@/lib/boomland'
import { followChallenge, unfollowChallenge } from '@/lib/challenge-detail-api'
import {
  followErrorMessage,
  followLabel,
  fivePieceLabel,
  seasonLabel,
  versionLabel,
  type ChallengeDetailDto,
} from '@/lib/challenge-detail'

/**
 * 命题详情页页头。
 *
 * 排布对齐截图：左侧是「命题名 + 简介 + 一排元信息 chip」，右侧只有关注按钮。
 * 关注按钮是这里唯一的交互，所以整个页头做成 Client Component —— 把按钮单独
 * 抽成客户端组件、页头保持服务端渲染也是对的，但那样 `followCount` 的变化要
 * 跨组件传，页头本来就要显示计数，反而多一层。
 *
 * 未登录点击 → 跳 `/login`（带 `returnTo`，登录后回到这条命题）；
 * 已登录 → POST / DELETE，成功后**就地**改文案与计数，不刷新整页
 * （刷新会让用户丢掉当前 tab）；失败时把后端 message 显示在 `role="alert"` 里。
 */
export function ChallengeDetailHeader({
  challenge,
}: {
  challenge: ChallengeDetailDto
}) {
  const router = useRouter()
  const auth = useOptionalAuth()
  const [followed, setFollowed] = useState(challenge.followed)
  const [followCount, setFollowCount] = useState(challenge.followCount)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const status = challengeStatusMeta(challenge.status)
  const fivePiece = fivePieceLabel(challenge)
  const follow = followLabel(followed)
  // 简介是契约 §1.1 的 `summary`；后端还没上线这一列时退回「真实问题」——
  // 标题下面空一块比换一句更准确的话更糟。
  const summary = challenge.summary ?? challenge.realProblem

  const handleFollow = async () => {
    if (!auth?.user) {
      router.push(`/login?returnTo=${encodeURIComponent(`/challenges/${challenge.id}`)}`)
      return
    }
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { data, error: apiError } = followed
        ? await unfollowChallenge(challenge.id)
        : await followChallenge(challenge.id)
      if (apiError || !data) {
        setError(followErrorMessage(apiError))
        return
      }
      setFollowed(data.followed)
      setFollowCount(data.followCount)
    } catch (cause) {
      setError(followErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <header className="challenge-header">
      <div className="challenge-header__main">
        <Eyebrow tone="accent">CHALLENGE / 命题</Eyebrow>
        <h1 className="challenge-header__title">{challenge.title || '未命名命题'}</h1>
        {summary ? (
          <p className="challenge-header__summary">{summary}</p>
        ) : null}

        <div className="challenge-header__meta">
          <Chip tone={status.tone}>{status.label}</Chip>
          <Chip>{versionLabel(challenge.version)}</Chip>
          <Chip>{seasonLabel(challenge.season)}</Chip>
          {challenge.theme ? <Chip tone="accent">{challenge.theme}</Chip> : null}
          <Chip tone={fivePiece.tone} title={fivePiece.title}>
            {fivePiece.label}
          </Chip>
        </div>

        {error ? (
          <p role="alert" className="challenge-header__error">
            {error}
          </p>
        ) : null}
      </div>

      <div className="challenge-header__actions">
        <Button
          variant={followed ? 'tertiary' : 'secondary'}
          size="sm"
          aria-pressed={followed}
          aria-label={follow.aria}
          disabled={busy}
          onClick={handleFollow}
        >
          {follow.text}
          {followCount > 0 ? (
            <span className="challenge-header__follow-count">{followCount}</span>
          ) : null}
        </Button>
      </div>
    </header>
  )
}
