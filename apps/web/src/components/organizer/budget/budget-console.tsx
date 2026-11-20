'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Eyebrow } from '@/components/ui/typography'
import { FormField, TextArea, TextInput } from '@/components/submit/form-fields'
import { WORKSPACE_SEASON } from '@/lib/season-workspace'
import {
  auditEntry,
  demoId,
  setDemoState,
  useDemoState,
} from '@/lib/season-demo-store'

type BudgetForm = {
  totalAmount: string
  managementFee: string
  prizePoolAmount: string
  reason: string
}

const EMPTY_BUDGET: BudgetForm = {
  totalAmount: '20000',
  managementFee: '4000',
  prizePoolAmount: '16000',
  reason: '',
}

/**
 * 主办方「预算与结算」。
 *
 * 预算与积分池是两本账：积分池决定能评多少分，预算决定能兑多少钱。
 * 这里的追加预算会生成新版本并把旧版本标记为已替代，结算预览只做口径
 * 展示，不真正发放。
 */
export function BudgetConsole() {
  const demo = useDemoState()
  const [notice, setNotice] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<BudgetForm>(EMPTY_BUDGET)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  const active = demo.budgets.find((budget) => budget.status === 'active') ?? null
  const pendingLargeReviews = demo.verifications.filter(
    (item) => item.kind === 'large-review' && item.status === 'pending',
  ).length
  const expectedPayout = demo.pointPool.usedPoints

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const total = Number(form.totalAmount)
    const fee = Number(form.managementFee)
    const prize = Number(form.prizePoolAmount)
    if (!Number.isInteger(total) || total <= 0) {
      setError('预算总额请填写正整数。')
      return
    }
    if (!Number.isInteger(fee) || fee < 0) {
      setError('管理费请填写非负整数。')
      return
    }
    if (!Number.isInteger(prize) || prize < 0) {
      setError('奖励池请填写非负整数。')
      return
    }
    if (fee + prize > total) {
      setError('管理费 + 奖励池不能超过预算总额。')
      return
    }
    if (form.reason.trim().length < 4) {
      setError('请填写追加原因（至少 4 个字）。')
      return
    }
    const nextVersion = Math.max(...demo.budgets.map((budget) => budget.version)) + 1
    setDemoState((current) => ({
      ...current,
      budgets: [
        {
          id: demoId('budget'),
          version: nextVersion,
          totalAmount: total,
          managementFee: fee,
          prizePoolAmount: prize,
          reason: form.reason.trim(),
          status: 'active',
          createdAt: '刚刚',
        },
        ...current.budgets.map((budget) =>
          budget.status === 'active' ? { ...budget, status: 'superseded' as const } : budget,
        ),
      ],
      audit: [
        auditEntry(
          'budget.added',
          `预算 v${nextVersion}`,
          `总额 ${total} 元，奖励池 ${prize} 元：${form.reason.trim()}`,
        ),
        ...current.audit,
      ],
    }))
    setOpen(false)
    setForm(EMPTY_BUDGET)
    setError(null)
    setNotice(`预算 v${nextVersion} 已生效，旧版本标记为已替代。`)
  }

  return (
    <div className="workspace-page">
      <header className="workspace-head">
        <div>
          <Eyebrow>BUDGET & SETTLEMENT / 预算与结算</Eyebrow>
          <h2 className="workspace-title">预算版本与结算口径</h2>
          <p className="workspace-lead">
            每次追加预算都生成新版本并留痕；积分池与预算独立，1 积分 = ¥1 只用于预计奖金。
          </p>
        </div>
        <div className="workspace-head__meta">
          <Chip tone="accent" dot>
            主办方视图
          </Chip>
          <Chip>{WORKSPACE_SEASON.name}</Chip>
          <Button size="sm" onClick={() => setOpen(true)}>
            追加预算
          </Button>
        </div>
      </header>

      {notice ? (
        <p className="workspace-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="workspace-metrics">
        <article className="ui-metric">
          <span className="ui-metric__label">当前预算版本</span>
          <strong className="ui-metric__value font-mono">
            {active ? `v${active.version}` : '—'}
          </strong>
          <p className="ui-metric__hint">{active?.reason ?? '还没有生效预算'}</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">预算总额</span>
          <strong className="ui-metric__value font-mono">
            {active ? `¥${active.totalAmount.toLocaleString('zh-CN')}` : '—'}
          </strong>
          <p className="ui-metric__hint">含管理费与奖励池</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">奖励池</span>
          <strong className="ui-metric__value font-mono">
            {active ? `¥${active.prizePoolAmount.toLocaleString('zh-CN')}` : '—'}
          </strong>
          <p className="ui-metric__hint">用于选手奖励与过程激励</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">积分预计奖金</span>
          <strong className="ui-metric__value font-mono">¥{expectedPayout}</strong>
          <p className="ui-metric__hint">{demo.pointPool.usedPoints} 已用积分 × ¥1</p>
        </article>
      </div>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>BUDGET VERSIONS / 预算版本</Eyebrow>
            <h3>每次追加都留痕</h3>
          </div>
          <span className="workspace-muted">同一时间只有一个生效版本</span>
        </header>
        <div className="overflow-x-auto">
          <table className="console-table" aria-label="赛季预算版本">
            <thead>
              <tr>
                <th scope="col">版本</th>
                <th scope="col" className="text-right">总额</th>
                <th scope="col" className="text-right">管理费</th>
                <th scope="col" className="text-right">奖励池</th>
                <th scope="col">原因</th>
                <th scope="col">状态</th>
                <th scope="col">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {demo.budgets.map((budget) => (
                <tr key={budget.id}>
                  <td className="font-mono text-meta">v{budget.version}</td>
                  <td className="text-right font-mono text-meta">
                    ¥{budget.totalAmount.toLocaleString('zh-CN')}
                  </td>
                  <td className="text-right font-mono text-meta">
                    ¥{budget.managementFee.toLocaleString('zh-CN')}
                  </td>
                  <td className="text-right font-mono text-meta">
                    ¥{budget.prizePoolAmount.toLocaleString('zh-CN')}
                  </td>
                  <td>{budget.reason}</td>
                  <td>
                    <Chip tone={budget.status === 'active' ? 'success' : 'neutral'}>
                      {budget.status === 'active' ? '生效中' : '已替代'}
                    </Chip>
                  </td>
                  <td className="whitespace-nowrap font-mono text-meta">{budget.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>SETTLEMENT / 结算</Eyebrow>
            <h3>结算预览</h3>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setPreview((value) => !value)}>
            {preview ? '收起预览' : '生成结算预览'}
          </Button>
        </header>

        {pendingLargeReviews > 0 ? (
          <p className="ui-note ui-note--warning" role="note">
            仍有 {pendingLargeReviews} 笔大额评分待复核，复核完成前不能定格。
          </p>
        ) : (
          <p className="workspace-muted">大额评分已全部复核，可以进行结算复核。</p>
        )}

        {preview ? (
          <div className="workspace-report__grid mt-4">
            <div>
              <span className="workspace-label">已核验积分</span>
              <strong>{demo.pointPool.usedPoints}</strong>
            </div>
            <div>
              <span className="workspace-label">预计奖金</span>
              <strong>¥{expectedPayout}</strong>
            </div>
            <div>
              <span className="workspace-label">待复核评分</span>
              <strong>{pendingLargeReviews}</strong>
            </div>
            <div>
              <span className="workspace-label">未用分配</span>
              <strong>{demo.pointPool.allocatedPoints - demo.pointPool.usedPoints}</strong>
            </div>
          </div>
        ) : null}

        <p className="workspace-muted">
          结算前所有金额都只是预计；未用分配在进入结算中时自动回收，驳回的大额评分按冲正处理。
        </p>
      </section>

      {open ? (
        <BudgetDialog
          form={form}
          setForm={setForm}
          error={error}
          onClose={() => setOpen(false)}
          onSubmit={submit}
        />
      ) : null}
    </div>
  )
}

function BudgetDialog({
  form,
  setForm,
  error,
  onClose,
  onSubmit,
}: {
  form: BudgetForm
  setForm: (form: BudgetForm) => void
  error: string | null
  onClose: () => void
  onSubmit: (event: React.FormEvent) => void
}) {
  const id = useId()
  return (
    <div className="workspace-modal" role="presentation">
      <button type="button" className="workspace-modal__backdrop" aria-label="关闭" onClick={onClose} />
      <form className="workspace-modal__panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onSubmit={onSubmit}>
        <header className="workspace-modal__head">
          <div>
            <Eyebrow>ADD BUDGET / 追加预算</Eyebrow>
            <h3 id={`${id}-title`}>新增预算版本</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
        </header>
        <p className="workspace-modal__hint">新版本生效后，原生效版本自动标记为已替代。</p>
        <div className="workspace-modal__fields">
          <FormField label="预算总额" htmlFor={`${id}-total`} required>
            <TextInput id={`${id}-total`} name="totalAmount" type="number" value={form.totalAmount} onChange={(value) => setForm({ ...form, totalAmount: value })} min={1} />
          </FormField>
          <FormField label="管理费" htmlFor={`${id}-fee`} required>
            <TextInput id={`${id}-fee`} name="managementFee" type="number" value={form.managementFee} onChange={(value) => setForm({ ...form, managementFee: value })} min={0} />
          </FormField>
          <FormField label="奖励池" htmlFor={`${id}-prize`} required>
            <TextInput id={`${id}-prize`} name="prizePoolAmount" type="number" value={form.prizePoolAmount} onChange={(value) => setForm({ ...form, prizePoolAmount: value })} min={0} />
          </FormField>
          <FormField label="追加原因" htmlFor={`${id}-reason`} required>
            <TextArea id={`${id}-reason`} name="reason" value={form.reason} onChange={(value) => setForm({ ...form, reason: value })} rows={3} placeholder="例如：追加过程奖励池。" />
          </FormField>
          {error ? <p className="ui-field-error" role="alert">{error}</p> : null}
        </div>
        <footer className="workspace-modal__actions">
          <Button type="button" variant="secondary" onClick={onClose}>取消</Button>
          <Button type="submit">提交并生效</Button>
        </footer>
      </form>
    </div>
  )
}
