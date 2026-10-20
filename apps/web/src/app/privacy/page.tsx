import { ButtonLink } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/typography'

export const metadata = { title: '隐私' }

export default function PrivacyPage() {
  return (
    <article className="shell shell--text section section--flush">
      <Eyebrow>LEGAL / PRIVACY</Eyebrow>
      <h1 className="page-title">隐私说明</h1>
      <p className="page-lead">
        Shenicest 仅在提供登录、项目提交与互动功能所必需的范围内处理你的信息。
        我们不会公开项目提交表单中的联系方式。
      </p>
      <ButtonLink href="/" variant="secondary" className="mt-10 w-fit">
        返回项目索引 <span className="ui-btn__arrow" aria-hidden>→</span>
      </ButtonLink>
    </article>
  )
}
