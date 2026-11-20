'use client'

import { useId, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Eyebrow } from '@/components/ui/typography'
import { FormField, SelectInput, TextArea, TextInput } from '@/components/submit/form-fields'
import { WORKSPACE_SEASON } from '@/lib/season-workspace'
import {
  auditEntry,
  demoId,
  setDemoState,
  useDemoState,
} from '@/lib/season-demo-store'

const JUDGE_OPTIONS = [
  { value: '评审甲', label: '评审甲（108）' },
  { value: '评审乙', label: '评审乙（109）' },
  { value: '评审丙', label: '评审丙（新增候选人）' },
]

const JUDGE_USER_IDS: Record<string, string> = {
  评审甲: '108',
  评审乙: '109',
}

const SCOPE_OPTIONS = [
  { value: 'all', label: '全部项目' },
  { value: 'enterprise', label: '本企业命题（曜石储能）' },
]

type AllocateForm = { judgeName: string; scope: string; amount: string }
type AddPointsForm = { amount: string }

const EMPTY_ALLOCATE: AllocateForm = {
  judgeName: JUDGE_OPTIONS[0].value,
  scope: 'all',
  amount: '50',
}

/**
 * 主办方「评委与积分池」。
 *
 * 这是权限矩阵里「配置评委、分配与回收积分」「追加积分池」两条的落地页。
 * 只允许主办方进入（由 `/organizer` layout 守卫）；企业没有这个入口，
 * 只能在企业命题台推荐候选人。
 */
export function ScoringConsole() {
  const demo = useDemoState()
  const [notice, setNotice] = useState<string | null>(null)
  const [allocateOpen, setAllocateOpen] = useState(false)
  const [allocate, setAllocate] = useState<AllocateForm>(EMPTY_ALLOCATE)
  const [allocateError, setAllocateError] = useState<string | null>(null)
  const [addPointsOpen, setAddPointsOpen] = useState(false)
  const [addPoints, setAddPoints] = useState<AddPointsForm>({ amount: '100' })
  const [addPointsError, setAddPointsError] = useState<string | null>(null)
  const [reclaimId, setReclaimId] = useState<string | null>(null)
  const [reclaimReason, setReclaimReason] = useState('')

  const unallocated = demo.pointPool.totalPoints - demo.pointPool.allocatedPoints
  const reclaimTarget = demo.allocations.find((item) => item.id === reclaimId) ?? null

  // 企业推荐且已被主办方确认的候选人，直接进入分配下拉；否则推荐流程
  // 到「确认授权」就断了，主办方还得手填一个新名字。
  const judgeOptions = useMemo(() => {
    const recommended = demo.judgeRecommendations
      .filter((item) => item.status === 'accepted')
      .map((item) => ({ value: item.name, label: `${item.name}（企业推荐）` }))
    const seen = new Set(JUDGE_OPTIONS.map((option) => option.value))
    return [
      ...JUDGE_OPTIONS,
      ...recommended.filter((option) => !seen.has(option.value)),
    ]
  }, [demo.judgeRecommendations])

  const submitAllocate = (event: React.FormEvent) => {
    event.preventDefault()
    const amount = Number(allocate.amount)
    if (!Number.isInteger(amount) || amount <= 0) {
      setAllocateError('分配额度请填写正整数。')
      return
    }
    if (amount > unallocated) {
      setAllocateError(`超出未分配额度：当前只剩 ${unallocated} 分。`)
      return
    }
    const scopeLabel =
      SCOPE_OPTIONS.find((option) => option.value === allocate.scope)?.label ?? '全部项目'
    setDemoState((current) => {
      const existing = current.allocations.find(
        (item) => item.judgeName === allocate.judgeName && item.status === 'active',
      )
      const nextAllocations = existing
        ? current.allocations.map((item) =>
            item.id === existing.id
              ? {
                  ...item,
                  amount: item.amount + amount,
                  scope: allocate.scope as 'all' | 'enterprise',
                  scopeLabel,
                }
              : item,
          )
        : [
            {
              id: demoId('allocation'),
              judgeName: allocate.judgeName,
              judgeUserId: JUDGE_USER_IDS[allocate.judgeName] ?? 'new',
              scope: allocate.scope as 'all' | 'enterprise',
              scopeLabel,
              amount,
              usedAmount: 0,
              status: 'active' as const,
              dailyQuota: false,
              createdAt: '刚刚',
            },
            ...current.allocations,
          ]
      return {
        ...current,
        allocations: nextAllocations,
        pointPool: {
          ...current.pointPool,
          allocatedPoints: current.pointPool.allocatedPoints + amount,
          updatedAt: '刚刚',
        },
        audit: [
          auditEntry(
            existing ? 'point_pool.allocated_more' : 'point_pool.allocated',
            allocate.judgeName,
            `${existing ? '追加' : '分配'} ${amount} 分，作用范围：${scopeLabel}`,
          ),
          ...current.audit,
        ],
      }
    })
    setAllocateOpen(false)
    setAllocate(EMPTY_ALLOCATE)
    setAllocateError(null)
    setNotice(`已向 ${allocate.judgeName} 分配 ${amount} 分。`)
  }

  const submitAddPoints = (event: React.FormEvent) => {
    event.preventDefault()
    const amount = Number(addPoints.amount)
    if (!Number.isInteger(amount) || amount <= 0) {
      setAddPointsError('追加积分请填写正整数。')
      return
    }
    setDemoState((current) => ({
      ...current,
      pointPool: {
        ...current.pointPool,
        totalPoints: current.pointPool.totalPoints + amount,
        updatedAt: '刚刚',
      },
      audit: [
        auditEntry('point_pool.added', '赛季积分池', `追加 ${amount} 分`),
        ...current.audit,
      ],
    }))
    setAddPointsOpen(false)
    setAddPoints({ amount: '100' })
    setAddPointsError(null)
    setNotice(`已向积分池追加 ${amount} 分。`)
  }

  const submitReclaim = () => {
    if (!reclaimTarget) return
    const remaining = reclaimTarget.amount - reclaimTarget.usedAmount
    if (remaining <= 0) {
      setNotice('该评委已没有未用额度可回收。')
      return
    }
    if (reclaimReason.trim().length < 4) {
      setNotice('请填写回收原因（至少 4 个字）。')
      return
    }
    setDemoState((current) => ({
      ...current,
      allocations: current.allocations.map((item) =>
        item.id === reclaimTarget.id ? { ...item, status: 'reclaimed' } : item,
      ),
      pointPool: {
        ...current.pointPool,
        allocatedPoints: current.pointPool.allocatedPoints - remaining,
        updatedAt: '刚刚',
      },
      audit: [
        auditEntry(
          'point_pool.reclaimed',
          reclaimTarget.judgeName,
          `回收未用 ${remaining} 分：${reclaimReason.trim()}`,
        ),
        ...current.audit,
      ],
    }))
    setNotice(`已回收 ${reclaimTarget.judgeName} 的未用额度 ${remaining} 分。`)
    setReclaimId(null)
    setReclaimReason('')
  }

  return (
    <div className="workspace-page">
      <header className="workspace-head">
        <div>
          <Eyebrow>JUDGES & POINTS / 评委与积分池</Eyebrow>
          <h2 className="workspace-title">评委配置与积分分配</h2>
          <p className="workspace-lead">
            积分池决定本赛季能评出多少分；预算决定能兑多少钱，两者独立。评委只能在作用范围和分配余额内评分。
          </p>
        </div>
        <div className="workspace-head__meta">
          <Chip tone="accent" dot>
            主办方视图
          </Chip>
          <Chip>{WORKSPACE_SEASON.name}</Chip>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setAddPointsOpen(true)}>
              追加积分池
            </Button>
            <Button size="sm" onClick={() => setAllocateOpen(true)}>
              分配积分
            </Button>
          </div>
        </div>
      </header>

      {notice ? (
        <p className="workspace-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="workspace-metrics">
        <article className="ui-metric">
          <span className="ui-metric__label">积分池总量</span>
          <strong className="ui-metric__value font-mono">{demo.pointPool.totalPoints}</strong>
          <p className="ui-metric__hint">更新于 {demo.pointPool.updatedAt}</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">已分配</span>
          <strong className="ui-metric__value font-mono">{demo.pointPool.allocatedPoints}</strong>
          <p className="ui-metric__hint">给本赛季所有评委</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">已使用</span>
          <strong className="ui-metric__value font-mono">{demo.pointPool.usedPoints}</strong>
          <p className="ui-metric__hint">含待复核评分占用的额度</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">未分配</span>
          <strong className="ui-metric__value font-mono">{unallocated}</strong>
          <p className="ui-metric__hint">进入结算时自动回收未用分配</p>
        </article>
      </div>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>ALLOCATIONS / 评委分配</Eyebrow>
            <h3>额度、作用范围与余额</h3>
          </div>
          <span className="workspace-muted">同一评委同时只有一条生效授权</span>
        </header>

        <div className="overflow-x-auto">
          <table className="console-table" aria-label="评委积分分配">
            <thead>
              <tr>
                <th scope="col">评委</th>
                <th scope="col">作用范围</th>
                <th scope="col" className="text-right">已分配</th>
                <th scope="col" className="text-right">已使用</th>
                <th scope="col" className="text-right">剩余</th>
                <th scope="col">每日额度</th>
                <th scope="col">状态</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {demo.allocations.map((item) => {
                const remaining = item.amount - item.usedAmount
                return (
                  <tr key={item.id}>
                    <td>
                      <span className="font-bold">{item.judgeName}</span>
                      <span className="workspace-muted block">{item.judgeUserId}</span>
                    </td>
                    <td>{item.scopeLabel}</td>
                    <td className="text-right font-mono text-meta">{item.amount}</td>
                    <td className="text-right font-mono text-meta">{item.usedAmount}</td>
                    <td className="text-right font-mono text-meta">{remaining}</td>
                    <td>{item.dailyQuota ? '开启' : '关闭'}</td>
                    <td>
                      <Chip tone={item.status === 'active' ? 'success' : 'neutral'}>
                        {item.status === 'active' ? '生效中' : '已回收'}
                      </Chip>
                    </td>
                    <td className="w-px whitespace-nowrap">
                      {item.status === 'active' && remaining > 0 ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setReclaimId(item.id)
                            setReclaimReason('')
                          }}
                        >
                          回收
                        </Button>
                      ) : (
                        <span className="workspace-muted">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="workspace-muted">
          回收只影响未来评分，已产生的评分与流水保留；进入结算中时自动回收全部未用分配。
        </p>
      </section>

      {allocateOpen ? (
        <ModalShell title="分配积分" eyebrow="ALLOCATE POINTS / 分配积分" onClose={() => setAllocateOpen(false)}>
          <form onSubmit={submitAllocate}>
            <div className="workspace-modal__fields">
              <FormField label="评委" htmlFor="allocate-judge" required>
                <SelectInput
                  id="allocate-judge"
                  name="judge"
                  value={allocate.judgeName}
                  onChange={(value) => setAllocate({ ...allocate, judgeName: value })}
                  options={judgeOptions}
                />
              </FormField>
              <FormField label="作用范围" htmlFor="allocate-scope" required>
                <SelectInput
                  id="allocate-scope"
                  name="scope"
                  value={allocate.scope}
                  onChange={(value) => setAllocate({ ...allocate, scope: value })}
                  options={SCOPE_OPTIONS}
                />
              </FormField>
              <FormField label="分配额度" htmlFor="allocate-amount" required hint={`剩余未分配 ${unallocated} 分`}>
                <TextInput
                  id="allocate-amount"
                  name="amount"
                  type="number"
                  value={allocate.amount}
                  onChange={(value) => setAllocate({ ...allocate, amount: value })}
                  min={1}
                />
              </FormField>
              {allocateError ? <p className="ui-field-error" role="alert">{allocateError}</p> : null}
            </div>
            <footer className="workspace-modal__actions">
              <Button type="button" variant="secondary" onClick={() => setAllocateOpen(false)}>取消</Button>
              <Button type="submit">确认分配</Button>
            </footer>
          </form>
        </ModalShell>
      ) : null}

      {addPointsOpen ? (
        <ModalShell title="追加积分池" eyebrow="ADD POINTS / 追加积分池" onClose={() => setAddPointsOpen(false)}>
          <form onSubmit={submitAddPoints}>
            <div className="workspace-modal__fields">
              <FormField label="追加积分" htmlFor="add-points" required hint="正整数，直接增加积分池总量">
                <TextInput
                  id="add-points"
                  name="amount"
                  type="number"
                  value={addPoints.amount}
                  onChange={(value) => setAddPoints({ amount: value })}
                  min={1}
                />
              </FormField>
              {addPointsError ? <p className="ui-field-error" role="alert">{addPointsError}</p> : null}
            </div>
            <footer className="workspace-modal__actions">
              <Button type="button" variant="secondary" onClick={() => setAddPointsOpen(false)}>取消</Button>
              <Button type="submit">确认追加</Button>
            </footer>
          </form>
        </ModalShell>
      ) : null}

      {reclaimTarget ? (
        <ModalShell title={`回收 ${reclaimTarget.judgeName} 的未用额度`} eyebrow="RECLAIM / 回收" onClose={() => setReclaimId(null)}>
          <div className="workspace-modal__fields">
            <p className="workspace-muted">
              可回收 {reclaimTarget.amount - reclaimTarget.usedAmount} 分；已使用的
              {' '}{reclaimTarget.usedAmount} 分不受影响。
            </p>
            <FormField label="回收原因" htmlFor="reclaim-reason" required>
              <TextArea
                id="reclaim-reason"
                name="reason"
                value={reclaimReason}
                onChange={setReclaimReason}
                rows={3}
                placeholder="例如：评委时间冲突，回收未用额度。"
              />
            </FormField>
          </div>
          <footer className="workspace-modal__actions">
            <Button type="button" variant="secondary" onClick={() => setReclaimId(null)}>取消</Button>
            <Button type="button" onClick={submitReclaim}>确认回收</Button>
          </footer>
        </ModalShell>
      ) : null}
    </div>
  )
}

function ModalShell({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string
  eyebrow: string
  onClose: () => void
  children: React.ReactNode
}) {
  const id = useId()
  return (
    <div className="workspace-modal" role="presentation">
      <button type="button" className="workspace-modal__backdrop" aria-label="关闭" onClick={onClose} />
      <div className="workspace-modal__panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <header className="workspace-modal__head">
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h3 id={`${id}-title`}>{title}</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
        </header>
        {children}
      </div>
    </div>
  )
}
