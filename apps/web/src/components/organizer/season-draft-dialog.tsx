'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SeasonDraftForm, type SeasonDraftSubmitResult } from '@/components/organizer/season-draft-form'
import { createSeasonDraft } from '@/lib/organizer-api'
import {
  updateSeasonCore,
  updateSeasonOrganizers,
  updateSeasonRules,
  updateSeasonSchedule,
  updateSeasonThemes,
} from '@/lib/organizer-settings-api'
import {
  SCHEDULE_FIELDS,
  toCreateSeasonPayload,
  toScheduleDraft,
  toSchedulePayload,
  type OrganizerOrg,
  type SeasonDraftValues,
  type SeasonManageDetail,
} from '@/lib/organizer'

/**
 * 「赛季草稿」弹窗：外壳 + 表单 + 三种提交语义。
 *
 * 抽出来的原因：同一个表单现在有三个入口 —— 发起空白草稿、复制上季、
 * 以及**草稿态下直接编辑当前赛季**（`mode: 'edit'`，保存即更新，不新建）。
 * 三个入口的弹窗外壳、Esc 行为、标题/说明与字段渲染必须完全一致，
 * 复制一份只会让它们慢慢跑偏；差异全部收敛在 `submit` 里。
 *
 * 语义边界（与产品确认过）：
 *   · create / copy —— `POST /seasons`，后端固定写 draft，绝不改任何赛季状态；
 *   · edit —— 更新**当前赛季**：`PATCH /seasons/:id` 加四条按需触发的 `PUT`
 *     （赛程 / 规则 / 主题 / 主办方组织），只有真的改了才发请求，
 *     避免一次保存把 `rulesVersion` 无谓地推高、凭空生成公告。
 *
 * 错误一律原样展示后端 `error.message`（不吞、不改写成泛泛的「保存失败」），
 * 后端给了 `field` 时同时把文案挂到那个字段上。
 */

export type SeasonDraftDialogMode = 'create' | 'copy' | 'edit'

const DIALOG_COPY: Record<SeasonDraftDialogMode, { title: string; description: string }> = {
  create: {
    title: '发起赛季草稿',
    description: '填写赛季的基础信息、赛程与规则。',
  },
  copy: {
    title: '复制上季',
    description: '已按上一季预填，请确认编号与赛程。',
  },
  edit: {
    title: '编辑赛季草稿',
    description: '保存后会更新当前赛季的基础信息、赛程与规则。',
  },
}

export function SeasonDraftDialog({
  mode,
  draft,
  organizerOrgs,
  sourceSeasonName,
  editTarget,
  onDraftChange,
  onClose,
  onSaved,
  returnFocusRef,
}: {
  mode: SeasonDraftDialogMode
  /** 表单值；`null` 表示还在读取模板（复制上季时）。 */
  draft: SeasonDraftValues | null
  organizerOrgs: OrganizerOrg[]
  sourceSeasonName?: string
  /** `edit` 模式的已保存数据：用来判断哪些 PUT 真的需要发。 */
  editTarget?: SeasonManageDetail
  onDraftChange: (next: SeasonDraftValues) => void
  onClose: () => void
  /** 保存成功后的回调；缺省时只刷新服务端数据（弹窗由调用方关闭）。 */
  onSaved?: () => void
  /** 触发按钮：关闭后把焦点还回去（`aria-modal` 弹窗的焦点契约）。 */
  returnFocusRef?: React.RefObject<HTMLButtonElement | null>
}) {
  const router = useRouter()
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const copy = DIALOG_COPY[mode]

  const close = useCallback(() => {
    onClose()
    returnFocusRef?.current?.focus()
  }, [onClose, returnFocusRef])

  /**
   * 只在**挂载时**跑一次的 Esc / 初始聚焦。
   *
   * 关键点：依赖数组必须是空的。`onClose` 通常是父级的内联箭头函数，每次渲染
   * 都是新引用；如果把它放进依赖，表单每敲一个字都会重跑这个 effect，而里面
   * 的 `closeRef.current?.focus()` 会把焦点从输入框抢到「关闭」按钮上 ——
   * 表现是「只能输入第一个字符」。所以用 ref 拿最新的 close，effect 只管挂载。
   */
  const closeRefLatest = useRef(close)
  // 在 effect 里同步（不在 render 里写 ref，react-hooks/refs 不允许）。
  useEffect(() => {
    closeRefLatest.current = close
  }, [close])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRefLatest.current()
    }
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  async function submit(values: SeasonDraftValues): Promise<SeasonDraftSubmitResult> {
    if (mode === 'edit') return submitEdit(values)
    return submitCreate(values)
  }

  /** create / copy：只新增草稿，不改任何赛季的发布状态。 */
  async function submitCreate(values: SeasonDraftValues): Promise<SeasonDraftSubmitResult> {
    const { data, error } = await createSeasonDraft(toCreateSeasonPayload(values))
    if (error || !data) {
      const bundle = error?.body.error
      return {
        ok: false,
        message: bundle?.message || '创建失败，请稍后重试',
        field: bundle?.field,
        code: bundle?.code,
      }
    }

    // 新建成功 → 落到同一个后台外壳的「赛季设置」，并选中刚建好的赛季，
    // 让用户能立刻看到它（后续在那里补齐赛程、命题、预算）。
    router.push(`/organizer/season-settings?season=${data.id}&created=1`)
    router.refresh()
    onSaved?.()
    return { ok: true }
  }

  /**
   * edit：把表单值写回当前赛季。
   *
   * 顺序固定为「核心字段 → 赛程 → 规则 → 主题 → 主办方组织」，任一步失败即停，
   * 并把后端文案原样返回。不并发是因为后三步都会 `rulesVersion + 1` 并生成公告，
   * 并发提交会让版本号与公告顺序变得不可预期。
   */
  async function submitEdit(values: SeasonDraftValues): Promise<SeasonDraftSubmitResult> {
    const target = editTarget
    if (!target) return { ok: false, message: '缺少当前赛季数据，无法保存' }

    const capacity = values.participantCapacity.trim()
    const core = await updateSeasonCore(target.id, {
      name: values.name.trim(),
      type: values.type,
      city: values.city.trim() || null,
      intro: values.intro.trim() || null,
      themes: values.themes,
      agreementVersion: values.agreementVersion.trim() || 'v1',
      awardingEntity: values.awardingEntity.trim() || null,
      participantCapacity: capacity ? Number(capacity) : null,
    })
    if (core.error || !core.data) {
      const bundle = core.error?.body.error
      return {
        ok: false,
        message: bundle?.message || '保存失败，请稍后重试',
        field: bundle?.field,
        code: bundle?.code,
      }
    }

    // ---- 赛程：只有真的改了才发 PUT（否则会凭空生成公告与规则版本） ----
    const scheduleChanged = SCHEDULE_FIELDS.some(
      (field) => values.schedule[field.key] !== toScheduleDraft(target.schedule)[field.key],
    )
    if (scheduleChanged) {
      const schedule = toSchedulePayload(values.schedule)
      if (!schedule) {
        // 后端 `PUT /schedule` 的 body 不接受 null，所以「清空赛程」在这里就拦住。
        return {
          ok: false,
          message: '赛程不能整体清空：要么八个节点都填，要么保持原有赛程',
          field: 'schedule',
        }
      }
      const result = await updateSeasonSchedule(target.id, { schedule })
      if (result.error || !result.data) {
        return {
          ok: false,
          message: result.error?.body.error.message || '赛程保存失败，请稍后重试',
          field: 'schedule',
        }
      }
    }

    // ---- 类型化规则 ----
    if (!sameRules(values.rules, target.rules)) {
      const result = await updateSeasonRules(target.id, { rules: values.rules })
      if (result.error || !result.data) {
        return {
          ok: false,
          message: result.error?.body.error.message || '规则保存失败，请稍后重试',
          field: 'rules',
        }
      }
    }

    // ---- 赛季主题（整表替换，后端会 trim / 去重） ----
    if (!sameStringList(values.themes, target.themes)) {
      const result = await updateSeasonThemes(target.id, { themes: values.themes })
      if (result.error || !result.data) {
        return {
          ok: false,
          message: result.error?.body.error.message || '赛季主题保存失败，请稍后重试',
          field: 'themes',
        }
      }
    }

    // ---- 主办方组织 ----
    if (!sameNumberList(values.organizerOrgIds, target.organizerOrgIds)) {
      const result = await updateSeasonOrganizers(target.id, {
        organizerOrgIds: values.organizerOrgIds,
      })
      if (result.error || !result.data) {
        return {
          ok: false,
          message: result.error?.body.error.message || '主办方组织保存失败，请稍后重试',
          field: 'organizerOrgIds',
        }
      }
    }

    onSaved?.()
    router.refresh()
    return { ok: true }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="season-draft-dialog-title"
    >
      <div className="ui-panel my-8 w-full max-w-3xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="season-draft-dialog-title" className="text-h3 font-bold text-foreground">
              {copy.title}
            </h2>
            <p className="mt-2 text-body-sm text-muted-foreground">
              {mode === 'copy'
                ? sourceSeasonName
                  ? `已按「${sourceSeasonName}」预填，请确认编号与赛程。`
                  : '正在读取上一个赛季…'
                : copy.description}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            className="ui-btn ui-btn--ghost ui-btn--small"
            aria-label="关闭"
          >
            关闭
          </button>
        </div>

        {draft ? (
          <SeasonDraftForm
            key={mode + (sourceSeasonName ?? '') + (editTarget?.updatedAt ?? '')}
            value={draft}
            onChange={onDraftChange}
            organizerOrgOptions={organizerOrgs}
            mode={mode}
            sourceSeasonName={sourceSeasonName}
            onSubmit={submit}
            onCancel={close}
          />
        ) : (
          <p className="ui-hint" aria-live="polite">
            正在读取上一个赛季…
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 差异比较
// ---------------------------------------------------------------------------

/** 规则字段固定九个，逐键比较即可（顺序与 `SeasonRules` 声明一致，值都是原始类型）。 */
function sameRules(a: SeasonDraftValues['rules'], b: SeasonDraftValues['rules']): boolean {
  return (
    a.maxChallengesPerProject === b.maxChallengesPerProject
    && a.maxProjectsPerParticipant === b.maxProjectsPerParticipant
    && a.maxCoreMembers === b.maxCoreMembers
    && a.singleWorkCap === b.singleWorkCap
    && a.exchangeRatio === b.exchangeRatio
    && a.reviewThreshold === b.reviewThreshold
    && a.dailyQuotaEnabled === b.dailyQuotaEnabled
  )
}

/** 主题是顺序敏感的有序列表：顺序不同也要保存（顺序即展示顺序）。 */
function sameStringList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index])
}

/** 主办方组织是集合语义：顺序不敏感，用长度 + 包含判断。 */
function sameNumberList(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item))
}
