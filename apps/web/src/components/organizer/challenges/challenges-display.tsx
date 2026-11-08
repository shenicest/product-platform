import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'
import { challengeStatusMeta } from '@/lib/boomland'
import { challengeTypeLabel } from '@shenicest/shared'
import {
  capacityLabel,
  challengeProjectRows,
  challengeThemeLabel,
  challengeTitleLabel,
  challengeVersionRows,
  cooperationDisplayRows,
  fivePieceSummary,
  type ChallengeDto,
  type EnterpriseCooperationDto,
} from '@/lib/organizer-challenges'

/**
 * 命题与资源 tab 的纯展示件。
 *
 * 全部**无状态、无副作用**：只吃 props、只吐 DOM。所有按钮由调用方以
 * `actions` / `renderActions` 传入 —— 这样这些组件既能被 Server Component
 * 直接渲染，也能被客户端视图复用，不用背 `'use client'` 的包袱。
 *
 * 视觉沿用现有体系：`ui-panel` 作卡片外壳、`console-table` 作表格、
 * `ui-chip` 作状态标记、`eyebrow` / `mono` 作小标与元信息。
 */

// ---------------------------------------------------------------------------
// 区块头
// ---------------------------------------------------------------------------

/** 区块头：标题 + 计数 + 一句说明 + 右侧操作。 */
function SectionHead({
  title,
  meta,
  lead,
  actions,
}: {
  title: string
  meta?: React.ReactNode
  lead?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <h2 className="flex flex-wrap items-baseline gap-3 text-h3 font-bold text-foreground">
          {title}
          {meta ? <span className="font-mono text-meta text-muted-foreground">{meta}</span> : null}
        </h2>
        {lead ? (
          <p className="mt-2 max-w-3xl text-body-sm leading-relaxed text-muted-foreground">{lead}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 命题库
// ---------------------------------------------------------------------------

/** 表头：与契约 §3.1 的八列一致。 */
const CHALLENGE_COLUMNS = [
  { key: 'title', label: '命题标题' },
  { key: 'enterprise', label: '企业' },
  { key: 'type', label: '类型' },
  { key: 'status', label: '状态' },
  { key: 'version', label: '版本' },
  { key: 'fivePiece', label: '五件套' },
  { key: 'capacity', label: '已选容量' },
  { key: 'actions', label: '操作' },
] as const

/**
 * 五件套单元格：齐全给 success chip，缺失给 warning chip。
 *
 * `title` 里列出缺什么（后端 `missingFields` 的中文名）：鼠标悬停能直接看到
 * 「还缺目标客户、结果证据规则」，不用点进编辑弹窗逐个字段对。
 */
function FivePieceCell({ challenge }: { challenge: ChallengeDto }) {
  const summary = fivePieceSummary(challenge)
  return (
    <Chip tone={summary.tone} dot title={summary.title} className="text-meta whitespace-nowrap">
      {summary.label}
    </Chip>
  )
}

/**
 * 命题库表格。
 *
 * 「企业」列按契约取**赛季主办方组织名**（`organizerNames`），不拿命题的
 * `enterpriseName` 去冒充归属：企业合作配置可以晚于命题录入、也可能一个企业
 * 有多条档位配置，直接对齐会误导。`enterpriseName` 有值时以 mono 小字补一行
 * 「出题方」，标明这是命题自带的字符串而不是赛季归属。
 */
export function ChallengeTable({
  items,
  organizerNames,
  renderActions,
}: {
  items: ChallengeDto[]
  organizerNames: string[]
  renderActions?: (challenge: ChallengeDto) => React.ReactNode
}) {
  const organizerLabel = organizerNames.length > 0 ? organizerNames.join('、') : '—'

  return (
    <div className="overflow-x-auto">
      {/* 八列 + 操作列，窄屏会横向溢出；`console-table--sticky-actions` 把操作列
          冻结在右侧，滚动看「五件套 / 容量」时不用先滚回去才能点「发布」。 */}
      <table className="console-table console-table--sticky-actions" aria-label="命题库">
        <thead>
          <tr>
            {CHALLENGE_COLUMNS.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((challenge) => {
            const status = challengeStatusMeta(challenge.status)
            return (
              <tr key={challenge.id} data-challenge-id={challenge.id} data-status={challenge.status}>
                <td className="min-w-56 max-w-80">
                  <span className="block font-bold text-foreground">
                    {challengeTitleLabel(challenge.title)}
                  </span>
                  <span className="mt-1 block font-mono text-meta text-muted-foreground">
                    {challengeThemeLabel(challenge.theme)}
                  </span>
                </td>

                <td className="min-w-40">
                  <span className="block text-foreground">{organizerLabel}</span>
                  {challenge.enterpriseName ? (
                    <span className="mt-1 block font-mono text-meta text-muted-foreground">
                      出题方 {challenge.enterpriseName}
                    </span>
                  ) : null}
                </td>

                <td className="min-w-36 whitespace-nowrap">
                  <span className="text-foreground">{challengeTypeLabel(challenge.type)}</span>
                </td>

                <td className="whitespace-nowrap">
                  <Chip tone={status.tone} dot className="text-meta">
                    {status.label}
                  </Chip>
                </td>

                <td className="whitespace-nowrap font-mono text-meta text-muted-foreground">
                  v{challenge.version}
                </td>

                <td className="whitespace-nowrap">
                  <FivePieceCell challenge={challenge} />
                </td>

                <td className="whitespace-nowrap font-mono text-meta text-foreground">
                  {capacityLabel(challenge.selectedCount, challenge.capacity)}
                </td>

                {/* 操作列按内容收缩，不参与表格的等分拉伸。 */}
                <td className="w-px whitespace-nowrap">
                  {renderActions ? (
                    renderActions(challenge)
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** 命题库区块：表格头（右上「新建命题草稿」）+ 表格或空态。 */
export function ChallengeLibrarySection({
  items,
  organizerNames,
  actions,
  renderActions,
}: {
  items: ChallengeDto[]
  organizerNames: string[]
  actions?: React.ReactNode
  renderActions?: (challenge: ChallengeDto) => React.ReactNode
}) {
  return (
    <section aria-labelledby="challenge-library-title">
      <SectionHead
        title="命题库"
        meta={`${items.length} 条`}
        lead="命题发布只看五件套（真实问题、目标客户、最小交付物、资源投入、结果证据规则）；类型、主题、企业与容量都是补充信息，不参与发布门槛。发布后修改内容会让版本号 +1。"
        actions={actions}
      />

      {items.length === 0 ? (
        <EmptyState
          title="NO CHALLENGES"
          description="这个赛季还没有命题。点右上「新建命题草稿」开始，五件套可以之后补齐。"
        />
      ) : (
        <div className="ui-panel ui-panel--flush min-w-0">
          <ChallengeTable items={items} organizerNames={organizerNames} renderActions={renderActions} />
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// 版本记录（契约 §4.2 第 2 条）
// ---------------------------------------------------------------------------

/**
 * 版本记录表。
 *
 * 展示形态：**一张表 + 「命题」列**，而不是按命题分块。理由：
 *   · 版本条数不确定，分块会让页面在命题多的时候被拉得很长；
 *   · 表格能横向对比「哪条命题改得最频繁」，分块做不到；
 *   · 「命题」列保证多命题混排时仍能读到归属，不会出现「这条 v3 是谁的」。
 * 排序：先按命题库顺序，同一命题内版本号从新到旧（后端写入即按时间递增）。
 */
export function ChallengeVersionTable({ items }: { items: ChallengeDto[] }) {
  const rows = challengeVersionRows(items)
  return (
    <div className="overflow-x-auto">
      <table className="console-table" aria-label="命题版本记录">
        <thead>
          <tr>
            <th scope="col">命题</th>
            <th scope="col">版本</th>
            <th scope="col">说明</th>
            <th scope="col">操作人</th>
            <th scope="col">时间</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.challengeId}-${row.id}`} data-version-id={row.id}>
              <td className="min-w-48 max-w-80">
                <span className="block font-bold text-foreground">{row.challengeTitle}</span>
              </td>
              <td className="whitespace-nowrap font-mono text-meta text-foreground">
                {row.versionLabel}
              </td>
              <td className="min-w-56 text-muted-foreground">{row.note}</td>
              <td className="min-w-32 font-mono text-meta text-muted-foreground">
                {row.changedBy}
              </td>
              <td className="whitespace-nowrap font-mono text-meta text-muted-foreground">
                {row.timeLabel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * 版本记录区块。
 *
 * 说明文案写清「什么时候会有记录」：新建草稿 / 发布 / 已发布命题的内容更新，
 * 这样空态不会让人以为功能坏了（草稿只建过一次时也会有一条 v1）。
 */
export function ChallengeVersionSection({ items }: { items: ChallengeDto[] }) {
  const rows = challengeVersionRows(items)
  return (
    <section aria-labelledby="challenge-versions-title" className="mt-10">
      <SectionHead
        title="版本记录"
        meta={`${rows.length} 条`}
        lead="新建草稿、发布命题、以及已发布命题的内容更新都会写一条记录（含变更说明与操作人）。版本号只增不减，旧版本不会被覆盖；「变更说明」在命题库行内的「编辑详情」里填写。"
      />

      {rows.length === 0 ? (
        <EmptyState
          title="NO VERSION RECORDS"
          description="这个赛季的命题还没有版本记录。后端会在新建草稿 / 发布 / 内容更新时自动写入；如果刚更新过命题，刷新页面再看。"
        />
      ) : (
        <div className="ui-panel ui-panel--flush min-w-0">
          <ChallengeVersionTable items={items} />
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// 选择本命题的项目（契约 §4.2 第 3 条）
// ---------------------------------------------------------------------------

/**
 * 「选择本命题的项目」表。
 *
 * 展示形态：**一张表 + 「命题」列**，与版本记录同口径。列按契约给
 * 命题 / 项目 / 阶段 / 负责人；阶段用 shared 的 `seasonProjectStageLabel`
 * （本批只展示，不提供阶段流转入口）。
 *
 * 只读：项目选择命题（CHG-003）与权益/容量校验不在本批，所以这里不摆
 * 任何「移除 / 调整」按钮 —— 一个点不动的按钮比没有按钮更让人困惑。
 */
export function ChallengeProjectTable({ items }: { items: ChallengeDto[] }) {
  const rows = challengeProjectRows(items)
  return (
    <div className="overflow-x-auto">
      <table className="console-table" aria-label="选择本命题的项目">
        <thead>
          <tr>
            <th scope="col">命题</th>
            <th scope="col">项目</th>
            <th scope="col">阶段</th>
            <th scope="col">负责人</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.challengeId}-${row.seasonProjectId}`}
              data-season-project-id={row.seasonProjectId}
            >
              <td className="min-w-48 max-w-80">
                <span className="block font-bold text-foreground">{row.challengeTitle}</span>
              </td>
              <td className="min-w-56">
                <span className="block text-foreground">{row.name}</span>
                <span className="mt-1 block font-mono text-meta text-muted-foreground">
                  #{row.projectId}
                </span>
              </td>
              <td className="whitespace-nowrap">
                <Chip tone="neutral" className="text-meta">
                  {row.stageLabel}
                </Chip>
              </td>
              <td className="min-w-32 text-muted-foreground">{row.ownerName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * 「选择本命题的项目」区块。
 *
 * 说明文案强调「项目选择命题由选手侧发起」：主办方在这里只能看，
 * 免得有人以为漏了一个录入入口。
 */
export function ChallengeProjectSection({ items }: { items: ChallengeDto[] }) {
  const rows = challengeProjectRows(items)
  return (
    <section aria-labelledby="challenge-projects-title" className="mt-10">
      <SectionHead
        title="选择本命题的项目"
        meta={`${rows.length} 个项目`}
        lead="赛季项目在选择命题时挂上本命题，这里按命题汇总展示。阶段只前进（本批只展示，不做流转）；选择命题时的权益快照与容量校验不在本批。"
      />

      {rows.length === 0 ? (
        <EmptyState
          title="NO SELECTED PROJECTS"
          description="还没有项目选择这些命题。项目选择命题由选手在赛季项目里发起，主办方这里只做查看。"
        />
      ) : (
        <div className="ui-panel ui-panel--flush min-w-0">
          <ChallengeProjectTable items={items} />
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// 企业合作配置
// ---------------------------------------------------------------------------

/** 表头：契约 §3.1 的八列。三项金额分列，互不换算。 */
const COOPERATION_COLUMNS = [
  { key: 'enterprise', label: '企业' },
  { key: 'tier', label: '档位' },
  { key: 'total', label: '总费用' },
  { key: 'management', label: '管理费' },
  { key: 'prizePool', label: '奖金池出资' },
  { key: 'dataGrant', label: '数据授权' },
  { key: 'publicScope', label: '公开授权' },
  { key: 'status', label: '状态' },
] as const

/**
 * 金额单元格：数字 + 低调的「元」后缀；破折号（= 0 或不适用）不加后缀。
 *
 * 「元」用 `text-muted-foreground` 而不是跟数字同色：三个金额列并排时，
 * 让数字成为视觉主体，单位退到背景里。
 */
function AmountCell({ value }: { value: string }) {
  return (
    <td className="whitespace-nowrap font-mono text-meta text-foreground">
      {value}
      {value === '—' ? null : <span className="ml-1 text-muted-foreground">元</span>}
    </td>
  )
}

/**
 * 企业合作配置表格（只读）。
 *
 * 金额统一加「元」后缀：表格里三个金额列并排，只写数字很容易被当成比例或
 * 积分。`0` 显示成破折号（见 `formatAmount`）。
 */
export function CooperationTable({ items }: { items: EnterpriseCooperationDto[] }) {
  const rows = cooperationDisplayRows(items)
  return (
    <div className="overflow-x-auto">
      <table className="console-table" aria-label="企业合作配置">
        <thead>
          <tr>
            {COOPERATION_COLUMNS.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-cooperation-id={row.id}>
              <td className="min-w-40 font-bold whitespace-nowrap text-foreground">
                {row.enterpriseName}
              </td>
              <td className="whitespace-nowrap text-foreground">{row.tierLabel}</td>
              <AmountCell value={row.totalAmount} />
              <AmountCell value={row.managementFee} />
              <AmountCell value={row.prizePoolAmount} />
              <td className="min-w-48 max-w-72 text-muted-foreground">{row.dataGrant}</td>
              <td className="min-w-40 text-muted-foreground">{row.publicScopeLabel}</td>
              <td className="whitespace-nowrap">
                <Chip tone={row.statusTone} className="text-meta">
                  {row.statusLabel}
                </Chip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 企业合作配置区块：表头（右上「编辑」）+ 表格或空态。 */
export function CooperationSection({
  items,
  actions,
}: {
  items: EnterpriseCooperationDto[]
  actions?: React.ReactNode
}) {
  return (
    <section aria-labelledby="challenge-cooperations-title" className="mt-10">
      <SectionHead
        title="企业合作配置"
        meta={`${items.length} 家`}
        lead="总费用、管理费与奖金池出资是三个独立口径：管理费不进选手奖励账本，所以系统不会用其中两项算出第三项。金额单位为元。"
        actions={actions}
      />

      {items.length === 0 ? (
        <EmptyState
          title="NO ENTERPRISES"
          description="这个赛季还没有登记企业合作配置。点右上「编辑」添加企业、档位与费用。"
        />
      ) : (
        <div className="ui-panel ui-panel--flush min-w-0">
          <CooperationTable items={items} />
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// 页面级提示
// ---------------------------------------------------------------------------

/** 没选中具体赛季：命题库是按赛季的，没有赛季就没有命题。 */
export function ChallengesNoSeason() {
  return (
    <EmptyState
      title="SELECT A SEASON"
      description="先在顶部选择赛季，才能管理它的命题、资源承诺与企业合作配置。"
    />
  )
}

/** 无权限（403）。 */
export function ChallengesForbidden({ action }: { action?: React.ReactNode }) {
  return (
    <EmptyState
      title="FORBIDDEN"
      description="你不是这个赛季的主办方，无法查看它的命题与资源。切换赛季或联系平台管理员。"
      action={action}
    />
  )
}

/** 读取失败（非 403）。 */
export function ChallengesLoadFailed({ message }: { message?: string }) {
  return (
    <EmptyState
      title="LOAD FAILED"
      description={message || '读取命题与资源失败，请稍后刷新重试。'}
    />
  )
}

/** 页面顶部 eyebrow：本 tab 的身份说明 + 当前赛季编号与名称。 */
export function ChallengesHeader({ code, name }: { code: string; name: string }) {
  return (
    <div className="mb-6">
      <Eyebrow tone="accent">CHALLENGES &amp; RESOURCES</Eyebrow>
      <p className="mt-2 font-mono text-meta text-muted-foreground">
        {code} · {name}
      </p>
    </div>
  )
}
