import { Chip } from '@/components/ui/chip'
import { Eyebrow } from '@/components/ui/typography'
import {
  SEAT_LOCKED_NOTE,
  SELECTED_PROJECTS_NOTE,
  VERSION_FOOTNOTE,
  challengeProjectRows,
  challengeVersionRows,
  seatState,
  selectedProjectsLabel,
  type ChallengeDetailDto,
} from '@/lib/challenge-detail'

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" strokeLinecap="round" />
    </svg>
  )
}

/** 右栏「入座」卡：锁 + 403 文案。 */
export function ChallengeSeatCard({ isLoggedIn }: { isLoggedIn: boolean }) {
  const seat = seatState({ isLoggedIn })
  return (
    <section className="challenge-aside-card" aria-labelledby="challenge-seat-title">
      <div className="challenge-seat">
        <span className="challenge-seat__lock" aria-hidden>
          <LockIcon />
        </span>
        <div className="min-w-0">
          <h2 id="challenge-seat-title" className="challenge-aside-card__title">
            {seat.title}
          </h2>
          <p className="challenge-aside-card__note">
            403 · {seat.note || SEAT_LOCKED_NOTE}
          </p>
        </div>
      </div>
    </section>
  )
}

/** 右栏「选择本命题的项目」列表。 */
export function ChallengeSelectedProjects({
  challenge,
}: {
  challenge: ChallengeDetailDto
}) {
  const rows = challengeProjectRows(challenge.projects)
  return (
    <section className="challenge-aside-card" aria-labelledby="challenge-projects-title">
      <div className="challenge-aside-card__head">
        <h2 id="challenge-projects-title" className="challenge-aside-card__title">
          选择本命题的项目
        </h2>
        <span className="challenge-aside-card__count">
          {selectedProjectsLabel(challenge.selectedCount, challenge.capacity)}
        </span>
      </div>

      {rows.length ? (
        <ul className="challenge-project-list">
          {rows.map((project) => (
            <li key={project.seasonProjectId} className="challenge-project">
              <span className="challenge-project__name">{project.name}</span>
              <Chip tone="accent">{project.stageLabel}</Chip>
            </li>
          ))}
        </ul>
      ) : (
        <p className="challenge-aside-card__empty">还没有项目选择这个命题。</p>
      )}

      <p className="challenge-aside-card__foot">{SELECTED_PROJECTS_NOTE}</p>
    </section>
  )
}

/** 右栏「版本记录」。 */
export function ChallengeVersionHistory({
  versions,
}: {
  versions: ChallengeDetailDto['versions']
}) {
  const rows = challengeVersionRows(versions)
  return (
    <section className="challenge-aside-card" aria-labelledby="challenge-versions-title">
      <div className="challenge-aside-card__head">
        <h2 id="challenge-versions-title" className="challenge-aside-card__title">
          版本记录
        </h2>
      </div>

      {rows.length ? (
        <ol className="challenge-version-list">
          {rows.map((row) => (
            <li key={row.id} className="challenge-version">
              <span className="challenge-version__label">{row.versionLabel}</span>
              <div className="min-w-0">
                <p className="challenge-version__note">{row.note || '内容更新'}</p>
                <p className="challenge-version__date">{row.dateLabel}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="challenge-aside-card__empty">还没有版本记录。</p>
      )}

      <p className="challenge-aside-card__foot">{VERSION_FOOTNOTE}</p>
    </section>
  )
}

/** 右栏整体：入座 / 已选项目 / 版本记录。 */
export function ChallengeDetailAside({
  challenge,
  isLoggedIn,
}: {
  challenge: ChallengeDetailDto
  isLoggedIn: boolean
}) {
  return (
    <aside className="challenge-aside" aria-label="命题侧栏">
      <Eyebrow>CHALLENGE / SIDE</Eyebrow>
      <div className="challenge-aside__stack">
        <ChallengeSeatCard isLoggedIn={isLoggedIn} />
        <ChallengeSelectedProjects challenge={challenge} />
        <ChallengeVersionHistory versions={challenge.versions} />
      </div>
    </aside>
  )
}
