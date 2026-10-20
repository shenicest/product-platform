'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CATEGORIES, ProposalStatus } from '@shenicest/shared'
import { projectIdLabel } from '@/lib/utils'
import { Pagination } from '@/components/pagination'
import { Chip, ChipButton, type ChipTone } from '@/components/ui/chip'
import { Card, EmptyState } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'
import type { OperatorProposal } from '@/server/operator'
import {
  OPERATOR_PAGE_SIZE,
  PROPOSAL_STATUS_LABELS,
  STAGE_LABELS,
  type OperatorProposalListParams,
} from '@/lib/operator-filters'

/** 提案状态 → 标签色调（只映射语义，不写颜色）。 */
const PROPOSAL_STATUS_TONES: Record<number, ChipTone> = {
  [ProposalStatus.Pending]: 'warning',
  [ProposalStatus.Approved]: 'success',
  [ProposalStatus.Rejected]: 'neutral',
  [ProposalStatus.RevisionRequired]: 'warning',
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <ChipButton tone={active ? 'accent' : 'neutral'} aria-pressed={active} onClick={onClick}>
      {children}
    </ChipButton>
  )
}

function ProposalRow({ proposal }: { proposal: OperatorProposal }) {
  return (
    <Card className="group">
      <Link
        href={`/operator/proposals/${proposal.id}`}
        className="flex flex-col gap-3 p-4 outline-none sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="card-id">#{proposal.id}</span>
            <Chip tone={PROPOSAL_STATUS_TONES[proposal.status] ?? 'neutral'} dot>
              {PROPOSAL_STATUS_LABELS[proposal.status] ?? '未知'}
            </Chip>
          </div>
          <p className="mono">项目 {projectIdLabel(proposal.projectId)}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="mono">
            {new Date(proposal.createdAt).toLocaleString('zh-CN')}
          </span>
        </div>
      </Link>
    </Card>
  )
}

export function OperatorProposalsClient({
  initialProposals,
  total,
  params,
}: {
  initialProposals: OperatorProposal[]
  total: number
  params: OperatorProposalListParams
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { stage, category } = params
  const page = params.page
  const totalPages = Math.max(1, Math.ceil(total / OPERATOR_PAGE_SIZE))

  function navigate(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('page')
    mutate(next)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Eyebrow>PROPOSAL QUEUE</Eyebrow>
        <h2 className="mt-2 text-[clamp(24px,3vw,32px)] leading-[1.15] font-bold">
          提案审核
        </h2>
        <p className="mono mt-1">共 {total} 个待审核提案</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mono">STAGE:</span>
        <FilterChip
          active={stage === undefined}
          onClick={() =>
            navigate((params) => {
              params.delete('stage')
            })
          }
        >
          全部
        </FilterChip>
        {Object.entries(STAGE_LABELS).map(([value, label]) => (
          <FilterChip
            key={value}
            active={stage === Number(value)}
            onClick={() =>
              navigate((params) => {
                if (stage === Number(value)) params.delete('stage')
                else params.set('stage', value)
              })
            }
          >
            {label}
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mono">CATEGORY:</span>
        <FilterChip
          active={category === undefined}
          onClick={() =>
            navigate((params) => {
              params.delete('category')
            })
          }
        >
          全部
        </FilterChip>
        {CATEGORIES.map((cat) => (
          <FilterChip
            key={cat}
            active={category === cat}
            onClick={() =>
              navigate((params) => {
                if (category === cat) params.delete('category')
                else params.set('category', cat)
              })
            }
          >
            {cat}
          </FilterChip>
        ))}
      </div>

      {initialProposals.length === 0 ? (
        <EmptyState title="NO PROPOSALS" description="暂无待审核的提案" />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {initialProposals.map((proposal) => (
              <ProposalRow key={proposal.id} proposal={proposal} />
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            searchParams={Object.fromEntries(searchParams.entries())}
            basePath="/operator/proposals"
          />
        </>
      )}
    </div>
  )
}
