import Link from 'next/link'

export const metadata = { title: '条款' }

export default function TermsPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="eyebrow">LEGAL / TERMS</p>
      <h1 className="mt-3 text-[clamp(30px,4vw,44px)] font-bold leading-[1.1]">使用条款</h1>
      <p className="mt-6 max-w-[65ch] text-base leading-[1.7] text-muted-foreground">提交项目时，请确保你有权发布相关内容，并如实描述产品状态。平台可以依据内容规范处理不适合公开展示的项目。</p>
      <Link href="/" className="btn-hard btn-secondary mt-10">返回项目索引 <span aria-hidden>→</span></Link>
    </article>
  )
}
