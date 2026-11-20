'use client'

import { useMemo, useState } from 'react'
import { Chip } from '@/components/ui/chip'
import { Eyebrow } from '@/components/ui/typography'
import { Button } from '@/components/ui/button'
import { WORKSPACE_SEASON } from '@/lib/season-workspace'
import { useDemoState } from '@/lib/season-demo-store'

const ACTION_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'season', label: '赛季与项目' },
  { value: 'score', label: '评分与复核' },
  { value: 'point', label: '积分与预算' },
  { value: 'application', label: '报名' },
] as const

function actionGroup(action: string): (typeof ACTION_FILTERS)[number]['value'] {
  if (action.startsWith('score') || action.startsWith('review') || action.startsWith('work') || action.startsWith('evidence') || action.startsWith('dispute') || action.startsWith('milestone') || action.startsWith('project')) {
    return 'score'
  }
  if (action.startsWith('point') || action.startsWith('budget') || action.startsWith('delivery')) {
    return 'point'
  }
  if (action.startsWith('application')) return 'application'
  return 'season'
}

/**
 * 主办方「审计」。
 *
 * 读取 store 里的操作日志：积分分配/回收、预算追加、评分提交、复核结论、
 * 作品与里程碑提交都会追加一行。没有单独的后端审计接口，本批用同一份
 * 演示状态验证「所有关键操作都留痕」。
 */
export function AuditConsole() {
  const demo = useDemoState()
  const [filter, setFilter] = useState<(typeof ACTION_FILTERS)[number]['value']>('all')

  const entries = useMemo(
    () =>
      filter === 'all'
        ? demo.audit
        : demo.audit.filter((entry) => actionGroup(entry.action) === filter),
    [demo.audit, filter],
  )

  return (
    <div className="workspace-page">
      <header className="workspace-head">
        <div>
          <Eyebrow>AUDIT / 审计</Eyebrow>
          <h2 className="workspace-title">赛季操作留痕</h2>
          <p className="workspace-lead">
            谁在什么时候改了什么：积分池、评委分配、预算、评分、复核、作品与里程碑提交都会写入这里。
          </p>
        </div>
        <div className="workspace-head__meta">
          <Chip tone="accent" dot>
            主办方视图
          </Chip>
          <Chip>{WORKSPACE_SEASON.name}</Chip>
          <Chip>{entries.length} 条记录</Chip>
        </div>
      </header>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>AUDIT LOG / 操作日志</Eyebrow>
            <h3>最新在前</h3>
          </div>
          <div className="workspace-filters" role="group" aria-label="筛选审计类型">
            {ACTION_FILTERS.map((item) => (
              <Button
                key={item.value}
                variant={filter === item.value ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </header>

        {entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="console-table" aria-label="赛季审计日志">
              <thead>
                <tr>
                  <th scope="col">时间</th>
                  <th scope="col">操作人</th>
                  <th scope="col">动作</th>
                  <th scope="col">对象</th>
                  <th scope="col">详情</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap font-mono text-meta">{entry.createdAt}</td>
                    <td>{entry.actor}</td>
                    <td>
                      <code className="font-mono text-meta">{entry.action}</code>
                    </td>
                    <td className="min-w-40">{entry.target}</td>
                    <td className="max-w-96 text-muted-foreground">{entry.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="workspace-empty">
            <p className="mono text-brand-text">这个筛选下没有记录</p>
            <p>新的关键操作会自动追加到审计日志。</p>
          </div>
        )}
      </section>
    </div>
  )
}
