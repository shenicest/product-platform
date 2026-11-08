'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FieldError, FormField, SelectInput, TextInput } from '@/components/submit/form-fields'
import { ChallengeDialogShell } from '@/components/organizer/challenges/challenge-dialog-shell'
import {
  cooperationDraftsFrom,
  cooperationStatusOptions,
  cooperationTierOptions,
  emptyCooperationDraft,
  publicScopeOptions,
  toCooperationPayload,
  validateCooperationDrafts,
  type CooperationDraft,
  type EnterpriseCooperationDto,
} from '@/lib/organizer-challenges'
import { replaceCooperations } from '@/lib/organizer-challenges-api'

/**
 * 「编辑企业合作配置」弹窗：整表替换。
 *
 * 语义与资源清单一致 —— `PUT /seasons/:id/cooperations` 一次提交完整列表，
 * 后端按数组顺序写 `sort_order`。
 *
 * **三项金额各自独立**：总费用 / 管理费 / 奖金池出资各有各的输入框，
 * 这里刻意不做「填总费用自动算奖金池」之类的联动 —— 管理费不进选手奖励账本
 * （CHG-006），任何派生都会算错账，也会让「总额与分项对不上」这种真实的
 * 商务口径被判成错误。
 */
export function CooperationEditorDialog({
  seasonId,
  items,
  onCancel,
  onSaved,
}: {
  seasonId: number
  items: EnterpriseCooperationDto[]
  onCancel: () => void
  onSaved: () => void
}) {
  const router = useRouter()
  const uid = useId()

  const [rows, setRows] = useState<CooperationDraft[]>(() => cooperationDraftsFrom(items))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const tierOptions = cooperationTierOptions()
  const scopeOptions = publicScopeOptions()
  const statusOptions = cooperationStatusOptions()

  function updateRow(index: number, patch: Partial<CooperationDraft>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index))
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const nextErrors = validateCooperationDrafts(rows)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setFormError('请先补全企业合作配置里标红的字段')
      return
    }

    setPending(true)
    const { error } = await replaceCooperations(seasonId, toCooperationPayload(rows))
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
      title="编辑企业合作配置"
      description="整表保存：增删与顺序会一次性提交。三项金额各自独立记录，系统不会用其中两项算出第三项。"
      onCancel={onCancel}
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate aria-label="企业合作配置表单">
        {rows.length === 0 ? (
          <p className="ui-hint">还没有企业。点「新增企业」把本季的档位、费用与授权记下来。</p>
        ) : (
          <ol className="grid gap-3">
            {rows.map((row, index) => (
              <li key={index} className="ui-card ui-card--static gap-3 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-meta text-muted-foreground">
                    第 {index + 1} 家
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(index)}
                    disabled={pending}
                    aria-label={`删除第 ${index + 1} 家企业`}
                  >
                    删除
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    label="企业名称"
                    htmlFor={`${uid}-name-${index}`}
                    required
                    error={errors[`${index}.enterpriseName`]}
                  >
                    <TextInput
                      id={`${uid}-name-${index}`}
                      name={`enterpriseName-${index}`}
                      value={row.enterpriseName}
                      onChange={(next) => updateRow(index, { enterpriseName: next })}
                      maxLength={255}
                    />
                  </FormField>

                  <FormField
                    label="档位"
                    htmlFor={`${uid}-tier-${index}`}
                    required
                    error={errors[`${index}.tier`]}
                  >
                    <SelectInput
                      id={`${uid}-tier-${index}`}
                      name={`tier-${index}`}
                      value={row.tier}
                      onChange={(next) => updateRow(index, { tier: next })}
                      options={tierOptions}
                    />
                  </FormField>

                  <FormField
                    label="等级"
                    htmlFor={`${uid}-grade-${index}`}
                    error={errors[`${index}.grade`]}
                    hint="金银标之类的商务口径，可留空"
                  >
                    <TextInput
                      id={`${uid}-grade-${index}`}
                      name={`grade-${index}`}
                      value={row.grade}
                      onChange={(next) => updateRow(index, { grade: next })}
                      maxLength={16}
                    />
                  </FormField>

                  <FormField
                    label="合作状态"
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
                    label="总费用（元）"
                    htmlFor={`${uid}-total-${index}`}
                    error={errors[`${index}.totalAmount`]}
                  >
                    <TextInput
                      id={`${uid}-total-${index}`}
                      name={`totalAmount-${index}`}
                      type="number"
                      value={row.totalAmount}
                      onChange={(next) => updateRow(index, { totalAmount: next })}
                      min={0}
                      max={100_000_000}
                    />
                  </FormField>

                  <FormField
                    label="管理费（元）"
                    htmlFor={`${uid}-management-${index}`}
                    error={errors[`${index}.managementFee`]}
                    hint="不进选手奖励账本，与奖金池出资分开记录"
                  >
                    <TextInput
                      id={`${uid}-management-${index}`}
                      name={`managementFee-${index}`}
                      type="number"
                      value={row.managementFee}
                      onChange={(next) => updateRow(index, { managementFee: next })}
                      min={0}
                      max={100_000_000}
                    />
                  </FormField>

                  <FormField
                    label="奖金池出资（元）"
                    htmlFor={`${uid}-prize-${index}`}
                    error={errors[`${index}.prizePoolAmount`]}
                  >
                    <TextInput
                      id={`${uid}-prize-${index}`}
                      name={`prizePoolAmount-${index}`}
                      type="number"
                      value={row.prizePoolAmount}
                      onChange={(next) => updateRow(index, { prizePoolAmount: next })}
                      min={0}
                      max={100_000_000}
                    />
                  </FormField>

                  <FormField
                    label="公开授权"
                    htmlFor={`${uid}-scope-${index}`}
                    error={errors[`${index}.publicScope`]}
                  >
                    <SelectInput
                      id={`${uid}-scope-${index}`}
                      name={`publicScope-${index}`}
                      value={row.publicScope}
                      onChange={(next) => updateRow(index, { publicScope: next })}
                      options={scopeOptions}
                    />
                  </FormField>

                  <FormField
                    label="数据授权说明"
                    htmlFor={`${uid}-data-${index}`}
                    error={errors[`${index}.dataGrant`]}
                  >
                    <TextInput
                      id={`${uid}-data-${index}`}
                      name={`dataGrant-${index}`}
                      value={row.dataGrant}
                      onChange={(next) => updateRow(index, { dataGrant: next })}
                      placeholder="可提供脱敏用电数据，需签保密协议"
                      maxLength={2000}
                    />
                  </FormField>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRows((current) => [...current, emptyCooperationDraft()])}
            disabled={pending}
          >
            新增企业
          </Button>
          <span className="ui-hint">金额单位为元，留空按 0 处理。</span>
        </div>

        <FieldError>{formError}</FieldError>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? '保存中…' : '保存企业配置'}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            取消
          </Button>
        </div>
      </form>
    </ChallengeDialogShell>
  )
}
