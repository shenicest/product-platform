import Link from 'next/link'

export const metadata = { title: '隐私' }

export default function PrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="eyebrow">LEGAL / PRIVACY</p>
      <h1 className="mt-3 text-[clamp(30px,4vw,44px)] font-bold leading-[1.1]">隐私说明</h1>
      <p className="mt-6 max-w-[65ch] text-base leading-[1.7] text-muted-foreground">Shenicest 仅在提供登录、项目提交与互动功能所必需的范围内处理你的信息。我们不会公开项目提交表单中的联系方式。</p>
      <Link href="/" className="btn-hard btn-secondary mt-10">返回项目索引 <span aria-hidden>→</span></Link>
    </article>
  )
}
