'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Eyebrow } from '@/components/ui/typography'
import {
  CURRENT_RULE_VERSION,
  SEASON_RULE_VERSIONS,
  type SeasonRuleVersion,
} from '@/lib/season-rules-archive'

function RulesSnapshot({ version }: { version: SeasonRuleVersion }) {
  const rules = version.rules
  return (
    <dl className="rules-snapshot">
      <div>
        <dt>每个项目命题上限</dt>
        <dd>{rules.maxChallengesPerProject} 个</dd>
      </div>
      <div>
        <dt>每人项目上限</dt>
        <dd>{rules.maxProjectsPerParticipant} 个</dd>
      </div>
      <div>
        <dt>团队核心人数</dt>
        <dd>{rules.maxCoreMembers} 人</dd>
      </div>
      <div>
        <dt>单次评分上限</dt>
        <dd>{rules.singleWorkCap} 分</dd>
      </div>
      <div>
        <dt>积分兑换</dt>
        <dd>1 积分 = ¥{rules.exchangeRatio}</dd>
      </div>
      <div>
        <dt>大额复核阈值</dt>
        <dd>{rules.reviewThreshold} 分</dd>
      </div>
      <div>
        <dt>作品截止</dt>
        <dd>{rules.workDeadline}</dd>
      </div>
      <div>
        <dt>评分截止</dt>
        <dd>{rules.scoreDeadline}</dd>
      </div>
      <div>
        <dt>每日额度</dt>
        <dd>{rules.dailyQuota ? '开启' : '关闭'}</dd>
      </div>
    </dl>
  )
}

export function RulesArchiveView() {
  const [selectedVersion, setSelectedVersion] = useState<SeasonRuleVersion>(
    CURRENT_RULE_VERSION,
  )

  return (
    <div className="workspace-page">
      <header className="workspace-head">
        <div>
          <Eyebrow>RULES ARCHIVE / 规则归档</Eyebrow>
          <h2 className="workspace-title">赛季规则版本</h2>
          <p className="workspace-lead">
            每次赛程或规则变更都会生成不可变版本。选手提交、作品审核与评委评分都按提交当时的版本留痕，后续修改不会覆盖历史。
          </p>
        </div>
        <div className="workspace-head__meta">
          <Chip tone="accent" dot>
            当前 v{CURRENT_RULE_VERSION.version}
          </Chip>
          <Chip>{SEASON_RULE_VERSIONS.length} 个归档版本</Chip>
        </div>
      </header>

      <div className="workspace-metrics">
        <article className="ui-metric">
          <span className="ui-metric__label">当前版本</span>
          <strong className="ui-metric__value font-mono">v{CURRENT_RULE_VERSION.version}</strong>
          <p className="ui-metric__hint">{CURRENT_RULE_VERSION.createdAt}</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">最近变更</span>
          <strong className="ui-metric__value font-mono">
            {CURRENT_RULE_VERSION.changes.length}
          </strong>
          <p className="ui-metric__hint">项规则调整</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">操作人</span>
          <strong className="ui-metric__value text-h3">主办方</strong>
          <p className="ui-metric__hint">{CURRENT_RULE_VERSION.operator}</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">关联公告</span>
          <strong className="ui-metric__value text-h3">
            {CURRENT_RULE_VERSION.announcement ? '已发布' : '无'}
          </strong>
          <p className="ui-metric__hint">规则变更会同步给目标用户</p>
        </article>
      </div>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>VERSIONS / 版本列表</Eyebrow>
            <h3>不可变规则快照</h3>
          </div>
          <span className="workspace-muted">按时间倒序 · 点击查看完整快照</span>
        </header>

        <div className="overflow-x-auto">
          <table className="console-table" aria-label="赛季规则版本列表">
            <thead>
              <tr>
                <th scope="col">版本</th>
                <th scope="col">时间</th>
                <th scope="col">操作人</th>
                <th scope="col">变更原因</th>
                <th scope="col">变更项</th>
                <th scope="col">公告</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {SEASON_RULE_VERSIONS.map((version) => {
                const active = version.version === selectedVersion.version
                return (
                  <tr key={version.version}>
                    <td className="font-mono text-meta">
                      v{version.version}
                      {version.version === CURRENT_RULE_VERSION.version ? (
                        <Chip tone="accent" className="ml-2">
                          当前
                        </Chip>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap font-mono text-meta">{version.createdAt}</td>
                    <td className="min-w-36">{version.operator}</td>
                    <td className="min-w-52 text-muted-foreground">{version.reason}</td>
                    <td className="font-mono text-meta">{version.changes.length} 项</td>
                    <td className="min-w-40 text-muted-foreground">
                      {version.announcement ?? '—'}
                    </td>
                    <td className="w-px whitespace-nowrap">
                      <Button
                        size="sm"
                        variant={active ? 'primary' : 'secondary'}
                        onClick={() => setSelectedVersion(version)}
                      >
                        {active ? '查看中' : '查看'}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>SNAPSHOT / 规则快照</Eyebrow>
            <h3>v{selectedVersion.version} · {selectedVersion.createdAt}</h3>
          </div>
          <Chip tone="neutral">{selectedVersion.operator}</Chip>
        </header>

        <p className="workspace-project__summary">{selectedVersion.reason}</p>

        <RulesSnapshot version={selectedVersion} />

        <div className="workspace-project__block">
          <span className="workspace-label">本版变更</span>
          <ul className="rules-changes">
            {selectedVersion.changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </div>

        {selectedVersion.announcement ? (
          <div className="workspace-project__block">
            <span className="workspace-label">关联公告</span>
            <p className="workspace-project__summary">{selectedVersion.announcement}</p>
          </div>
        ) : null}
      </section>
    </div>
  )
}
