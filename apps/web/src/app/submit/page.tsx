import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ProjectSubmissionForm } from '@/components/submit/project-submission-form'

export const metadata: Metadata = {
  title: '提交项目',
  description: '提交你的早期产品，让平台审核并展示给用户。',
}

export const dynamic = 'force-dynamic'

export default async function SubmitPage() {
  const jar = await cookies()
  const token = jar.get('shenicest_token')?.value
  if (!token) redirect('/login')
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <p className="eyebrow">SUBMIT / 00</p>
        <h1 className="mt-3 text-[clamp(28px,4vw,40px)] font-bold leading-[1.1]">
          提交项目
        </h1>
        <p className="mt-3 max-w-[60ch] text-base leading-[1.7] text-muted-foreground">
          填写你的产品信息，保存草稿后可以随时回来继续编辑。
          确认无误后提交审核，通过后将在平台公开展示。
        </p>
      </header>
      <ProjectSubmissionForm />
    </div>
  )
}
