'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SEASON_AGREEMENT_CONTENT_MAX_LENGTH } from '@shenicest/shared'
import { Button } from '@/components/ui/button'
import { FormField, TextArea } from '@/components/submit/form-fields'
import { updateSeasonAgreement } from '@/lib/organizer-settings-api'

/**
 * 「协议与规则卡」区块：公开协议页的正文编辑器。
 *
 * 为什么单独成块而不是塞进「编辑赛季信息」：
 *   · 正文是长文本，和名称/城市那些一行短字段混在一起不好写；
 *   · 它和规则卡在同一个公开页展示，放在规则卡区块上方能看清两者关系。
 *
 * 可写窗口与后端 `updateAgreement` 同口径（草稿 / 待批准），前端用
 * `canEditSeasonAgreement` 算好再传进来；已发布时这里只展示、不提交。
 */
export function SeasonAgreementEditor({
  seasonId,
  agreementVersion,
  content,
  canEdit,
  publicHref,
}: {
  seasonId: number
  agreementVersion: string
  content: string | null
  /** 未发布赛季可编辑；已发布只读。 */
  canEdit: boolean
  /** 公开协议页地址；赛季还没批准（页面尚不存在）时传 null。 */
  publicHref: string | null
}) {
  const router = useRouter()
  const uid = useId()
  const fieldId = `${uid}-content`
  const [value, setValue] = useState(content ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const dirty = value.trim() !== (content ?? '').trim()

  async function save() {
    setError(null)
    setNotice(null)
    const next = value.trim()
    setPending(true)
    const { error: requestError } = await updateSeasonAgreement(seasonId, {
      agreementContent: next || null,
    })
    setPending(false)
    if (requestError) {
      setError(requestError.body.error.message || '保存失败，请稍后重试')
      return
    }
    setValue(next)
    setNotice('协议正文已保存')
    router.refresh()
  }

  return (
    <section aria-labelledby={`${uid}-title`} className="mt-10">
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <h2
            id={`${uid}-title`}
            className="flex flex-wrap items-baseline gap-3 text-h3 font-bold text-foreground"
          >
            协议与规则卡
            <span className="font-mono text-meta text-muted-foreground">{agreementVersion}</span>
          </h2>
          <p className="mt-2 max-w-3xl text-body-sm leading-relaxed text-muted-foreground">
            报名页「我已阅读并同意本赛季协议与规则卡」链接到的公开页内容。规则卡会自动排在正文之后，
            由「规则」与下方规则卡配置生成，不需要在这里重复写一遍。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {publicHref ? (
            <Link
              href={publicHref}
              target="_blank"
              rel="noreferrer"
              className="ui-btn ui-btn--secondary ui-btn--small"
            >
              查看公开页
            </Link>
          ) : (
            <span className="ui-hint">赛季批准后生成公开页</span>
          )}
        </div>
      </div>

      {canEdit ? (
        <div className="grid gap-3">
          <FormField
            label="协议正文"
            htmlFor={fieldId}
            hint={`纯文本，按空行分段；最多 ${SEASON_AGREEMENT_CONTENT_MAX_LENGTH} 字。未发布赛季可随时修改，发布后锁定。`}
          >
            <TextArea
              id={fieldId}
              name="agreementContent"
              value={value}
              onChange={setValue}
              placeholder="例如：第一条 参赛资格……"
              rows={10}
              maxLength={SEASON_AGREEMENT_CONTENT_MAX_LENGTH}
            />
          </FormField>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={save} disabled={pending || !dirty}>
              {pending ? '保存中…' : '保存协议正文'}
            </Button>
            {notice ? (
              <span role="status" className="text-body-sm text-muted-foreground">
                {notice}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="ui-note ui-note--warning">
            赛季已发布，协议正文锁定。如需更新，请升级协议版本并通过公告重新告知报名者。
          </p>
          {content ? (
            <div className="ui-card ui-card--static p-4 text-body-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {content}
            </div>
          ) : (
            <p className="ui-hint">这个赛季还没有填写协议正文，公开页只展示规则卡。</p>
          )}
        </div>
      )}

      {error ? (
        <p role="alert" className="ui-field-error mt-3">
          {error}
        </p>
      ) : null}
    </section>
  )
}
