'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CATEGORIES } from '@shenicest/shared'
import { cn, projectIdLabel } from '@/lib/utils'
import { Pagination } from '@/components/pagination'
import type { OperatorProposal } from '@/server/operator'
import {
  OPERATOR_PAGE_SIZE,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
  STAGE_LABELS,
  type OperatorProposalListParams,
} from '@/lib/operator-filters'

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'chip-hard cursor-pointer transition-colors',
        active
          ? 'chip-active'
          : 'hover:border-primary/60 hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function ProposalRow({ proposal }: { proposal: OperatorProposal }) {
  return (
    <Link
      href={`/operator/proposals/${proposal.id}`}
      className="group flex flex-col gap-3 border border-border bg-card p-4 transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--secondary)] sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-primary">
            #{proposal.id}
          </span>
          <span
            className={cn(
              'inline-flex items-center px-2 py-1 font-mono text-[10px] tracking-[0.08em]',
              PROPOSAL_STATUS_COLORS[proposal.status] ?? 'bg-muted text-muted-foreground'
            )}
          >
            {PROPOSAL_STATUS_LABELS[proposal.status] ?? '未知'}
          </span>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          项目 {projectIdLabel(proposal.projectId)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">
          {new Date(proposal.createdAt).toLocaleString('zh-CN')}
        </span>
      </div>
    </Link>
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
    <div className="space-y-6">
      <div className="mb-6">
        <p className="eyebrow">PROPOSAL QUEUE</p>
        <h2 className="mt-2 text-[clamp(24px,3vw,32px)] font-bold leading-[1.15]">
          提案审核
        </h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          共 {total} 个待审核提案
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
          STAGE:
        </span>
        <Chip
          active={stage === undefined}
          onClick={() =>
            navigate((params) => {
              params.delete('stage')
            })
          }
        >
          全部
        </Chip>
        {Object.entries(STAGE_LABELS).map(([value, label]) => (
          <Chip
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
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
          CATEGORY:
        </span>
        <Chip
          active={category === undefined}
          onClick={() =>
            navigate((params) => {
              params.delete('category')
            })
          }
        >
          全部
        </Chip>
        {CATEGORIES.map((cat) => (
          <Chip
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
          </Chip>
        ))}
      </div>

      {initialProposals.length === 0 ? (
        <div className="border border-dashed border-border py-24 text-center">
          <p className="font-mono text-xs tracking-[0.12em] text-primary">
            NO PROPOSALS
          </p>
          <p className="mt-3 text-base text-muted-foreground">
            暂无待审核的提案
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
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
