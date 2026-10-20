import { ButtonLink } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/typography'

export const metadata = { title: '条款' }

export default function TermsPage() {
  return (
    <article className="shell shell--text section section--flush">
      <Eyebrow>LEGAL / TERMS</Eyebrow>
      <h1 className="page-title">使用条款</h1>
      <p className="page-lead">
        提交项目时，请确保你有权发布相关内容，并如实描述产品状态。
        平台可以依据内容规范处理不适合公开展示的项目。
      </p>
      <ButtonLink href="/" variant="secondary" className="mt-10 w-fit">
        返回项目索引 <span className="ui-btn__arrow" aria-hidden>→</span>
      </ButtonLink>
    </article>
  )
}
