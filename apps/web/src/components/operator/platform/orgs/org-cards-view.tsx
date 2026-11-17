import Link from 'next/link'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/surface'
import { formatDate } from '@/lib/boomland'
import {
  formatScheduleRange,
  memberCountLabel,
  platformSeasonStatusMeta,
  type PlatformOrgCard,
} from '@/lib/platform-console'
import { CreateOrgButton } from './create-org-button'
import { OrgMemberAddButton } from './org-member-add-button'
import { OrgMemberRemoveButton } from './org-member-remove-button'

/**
 * 「主办方组织与成员」tab。
 *
 * 一个组织一张卡：成员、主办的赛季都在卡里。三件事必须放在同一个视野里，
 * 因为「成员只能管被指定的赛季」这条规则只有在能同时看到成员和赛季时才是
 * 可验证的 —— 分开两屏，管理员加完成员就走了，没人会发现该组织其实一个赛季
 * 都没被指定。
 */
export function OrganizerOrgsView({
  cards,
  isOperator,
  failed,
}: {
  cards: PlatformOrgCard[]
  isOperator: boolean
  failed: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono">{cards.length} 个主办方组织</p>
          <p className="page-lead max-w-3xl">
            「主办方」与「赛季运营主管单位」是同一个概念、权限一致，以组织为单位。一个赛季可以指定一个或多个主办方组织，成员只在被指定的赛季内拥有主办方权限。
          </p>
        </div>
        {isOperator ? <CreateOrgButton /> : null}
      </div>

      {failed ? (
        <p className="ui-note ui-note--danger" role="alert">
          组织列表读取失败，请刷新重试。
        </p>
      ) : null}

      {!isOperator ? (
        <p className="ui-note ui-note--accent" role="note">
          你以主办方成员身份查看：只能看到自己所属的组织与成员，新建组织、加减成员都只有平台管理员可以执行。
        </p>
      ) : null}

      {cards.length === 0 ? (
        <EmptyState
          title="NO ORGANIZER ORG"
          description={
            isOperator
              ? '还没有任何主办方组织。先新建一个，再把成员加进来，赛季才能指定它。'
              : '你还不属于任何主办方组织，暂时没有可查看的内容。'
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cards.map((card) => (
            <OrgCard key={card.org.id} card={card} />
          ))}
        </div>
      )}
    </div>
  )
}

function OrgCard({ card }: { card: PlatformOrgCard }) {
  const { org, members, seasons, canManageMembers } = card
  const headingId = `org-${org.id}-title`

  return (
    <section className="ui-panel" aria-labelledby={headingId} data-org-id={org.id}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-h3 font-bold text-foreground">
            {org.name}
          </h2>
          <p className="mono mt-1">{memberCountLabel(members.length)}</p>
        </div>
        {canManageMembers ? (
          <OrgMemberAddButton orgId={org.id} orgName={org.name} />
        ) : null}
      </header>

      <div className="mt-5">
        <p className="ui-panel__label">成员</p>
        {members.length === 0 ? (
          <p className="ui-hint">还没有成员。没有成员的组织无法支撑赛季发布（发布门槛要求至少一个组织有成员）。</p>
        ) : (
          <ul className="mt-2">
            {members.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-3 border-b border-border-soft py-2 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="ui-avatar ui-avatar--sm" aria-hidden>
                    {(member.name ?? '?').slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-body-sm text-foreground">
                      {member.name ?? '未知用户'}
                    </p>
                    <p className="mono truncate">
                      ID {member.userId} · 加入于 {formatDate(member.joinedAt)}
                    </p>
                  </div>
                </div>
                {canManageMembers ? (
                  <OrgMemberRemoveButton
                    orgId={org.id}
                    orgName={org.name}
                    userId={member.userId}
                    memberName={member.name}
                    isLastMember={members.length === 1}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5">
        <p className="ui-panel__label">主办的赛季</p>
        {seasons.length === 0 ? (
          <p className="ui-hint">还没有指定给该组织的赛季。</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {seasons.map((season) => {
              const status = platformSeasonStatusMeta(season)
              return (
                <li key={season.id} className="flex flex-wrap items-center gap-2">
                  <Chip tone="accent" className="font-mono">
                    {season.code}
                  </Chip>
                  <Link
                    href={`/operator/boomland/seasons/${season.id}`}
                    className="text-body-sm text-foreground hover:text-brand-text"
                  >
                    {season.name}
                  </Link>
                  <Chip tone={status.tone}>{status.label}</Chip>
                  <span className="mono">{formatScheduleRange(season.schedule)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="ui-hint mt-5">
        成员权限按赛季生效：该组织没被指定的赛季，成员点进去也会被拒绝（403）。
      </p>
    </section>
  )
}
