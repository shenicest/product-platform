'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FieldError, FormField, SelectInput, TextInput } from '@/components/submit/form-fields'
import { ChallengeDialogShell } from '@/components/organizer/challenges/challenge-dialog-shell'
import {
  emptyResourceDraft,
  resourceDraftsFrom,
  resourceKindOptions,
  resourceStatusOptions,
  toResourcePayload,
  validateResourceDrafts,
  type ChallengeDto,
  type ChallengeResourceDraft,
} from '@/lib/organizer-challenges'
import { replaceChallengeResources } from '@/lib/organizer-challenges-api'

/**
 * 「编辑资源」弹窗：整表替换某个命题的资源清单。
 *
 * 语义与规则卡一致 —— `PUT /challenges/:id/resources` 一次提交完整列表，
 * 后端按数组顺序写 `sort_order`。所以这里只需要本地维护一个数组：
 * 增行、删行、上下移动都在本地完成，点保存才发一次请求。
 *
 * 为什么用「上移 / 下移」而不是拖拽：资源清单一般只有几条，两个按钮就能
 * 表达顺序，而且键盘可用（拖拽的键盘等价操作要额外做一套 Alt+↑/↓，
 * 收益不足以抵消复杂度）。
 */
export function ResourceEditorDialog({
  challenge,
  onCancel,
  onSaved,
}: {
  challenge: ChallengeDto
  onCancel: () => void
  onSaved: () => void
}) {
  const router = useRouter()
  const uid = useId()

  const [rows, setRows] = useState<ChallengeResourceDraft[]>(() =>
    resourceDraftsFrom(challenge.resources),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const kindOptions = resourceKindOptions()
  const statusOptions = resourceStatusOptions()

  function updateRow(index: number, patch: Partial<ChallengeResourceDraft>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addRow() {
    setRows((current) => [...current, emptyResourceDraft()])
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index))
  }

  /** 上移 / 下移：越界时不动（按钮也会被禁用，这里是双保险）。 */
  function moveRow(index: number, direction: -1 | 1) {
    setRows((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const nextErrors = validateResourceDrafts(rows)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setFormError(nextErrors.items ?? '请先补全资源清单里标红的字段')
      return
    }

    setPending(true)
    const { error } = await replaceChallengeResources(challenge.id, toResourcePayload(rows))
    setPending(false)
    if (error) {
      setFormError(error.body.error.message)
      return
    }
    onSaved()
    router.refresh()
  }

  return (
    <ChallengeDialogShell
      title={`编辑资源 · ${challenge.title}`}
      description="整表保存：增删与排序会一次性提交。已关闭或已归档的命题不可修改资源。"
      onCancel={onCancel}
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate aria-label="资源清单表单">
        {rows.length === 0 ? (
          <p className="ui-hint">还没有资源。点「新增一条」把企业承诺的数据、场地、渠道等逐条记下来。</p>
        ) : (
          <ol className="grid gap-3">
            {rows.map((row, index) => (
              <li key={index} className="ui-card ui-card--static gap-3 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-meta text-muted-foreground">
                    第 {index + 1} 条
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveRow(index, -1)}
                      disabled={index === 0 || pending}
                      aria-label={`上移第 ${index + 1} 条资源`}
                    >
                      上移
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveRow(index, 1)}
                      disabled={index === rows.length - 1 || pending}
                      aria-label={`下移第 ${index + 1} 条资源`}
                    >
                      下移
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(index)}
                      disabled={pending}
                      aria-label={`删除第 ${index + 1} 条资源`}
                    >
                      删除
                    </Button>
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    label="类别"
                    htmlFor={`${uid}-kind-${index}`}
                    error={errors[`${index}.kind`]}
                  >
                    <SelectInput
                      id={`${uid}-kind-${index}`}
                      name={`kind-${index}`}
                      value={row.kind}
                      onChange={(next) => updateRow(index, { kind: next })}
                      options={kindOptions}
                    />
                  </FormField>

                  <FormField
                    label="资源名称"
                    htmlFor={`${uid}-title-${index}`}
                    required
                    error={errors[`${index}.title`]}
                  >
                    <TextInput
                      id={`${uid}-title-${index}`}
                      name={`title-${index}`}
                      value={row.title}
                      onChange={(next) => updateRow(index, { title: next })}
                      placeholder="3 个站点的历史用电数据"
                      maxLength={255}
                    />
                  </FormField>

                  <FormField
                    label="数量 / 条件"
                    htmlFor={`${uid}-quantity-${index}`}
                    error={errors[`${index}.quantity`]}
                  >
                    <TextInput
                      id={`${uid}-quantity-${index}`}
                      name={`quantity-${index}`}
                      value={row.quantity}
                      onChange={(next) => updateRow(index, { quantity: next })}
                      placeholder="3 个站点 · 近 5 年"
                      maxLength={100}
                    />
                  </FormField>

                  <FormField
                    label="负责人"
                    htmlFor={`${uid}-owner-${index}`}
                    error={errors[`${index}.owner`]}
                  >
                    <TextInput
                      id={`${uid}-owner-${index}`}
                      name={`owner-${index}`}
                      value={row.owner}
                      onChange={(next) => updateRow(index, { owner: next })}
                      placeholder="数据平台 · 王工"
                      maxLength={255}
                    />
                  </FormField>

                  <FormField
                    label="状态"
                    htmlFor={`${uid}-status-${index}`}
                    error={errors[`${index}.status`]}
                  >
                    <SelectInput
                      id={`${uid}-status-${index}`}
                      name={`status-${index}`}
                      value={row.status}
                      onChange={(next) => updateRow(index, { status: next })}
                      options={statusOptions}
                    />
                  </FormField>

                  <FormField
                    label="使用条件"
                    htmlFor={`${uid}-conditions-${index}`}
                    error={errors[`${index}.conditions`]}
                  >
                    <TextInput
                      id={`${uid}-conditions-${index}`}
                      name={`conditions-${index}`}
                      value={row.conditions}
                      onChange={(next) => updateRow(index, { conditions: next })}
                      placeholder="需签署数据使用协议"
                      maxLength={2000}
                    />
                  </FormField>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={addRow} disabled={pending}>
            新增一条
          </Button>
          <span className="ui-hint">保存后整表覆盖，顺序即展示顺序。</span>
        </div>

        <FieldError>{formError}</FieldError>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? '保存中…' : '保存资源'}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            取消
          </Button>
        </div>
      </form>
    </ChallengeDialogShell>
  )
}
