import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/server/auth'
import { getOwnProfile } from '@/server/founder'
import { ProjectSubmissionForm } from '@/components/submit/project-submission-form'
import { Eyebrow } from '@/components/ui/typography'

export const metadata: Metadata = {
  title: '提交项目',
  description: '提交你的早期产品，让平台审核并展示给用户。',
}

export const dynamic = 'force-dynamic'

export default async function SubmitPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  // Resolve the nickname here rather than letting the form fetch `/api/me` after
  // hydration. The prefill then ships inside the server-rendered markup, so the
  // page is complete without JavaScript — which is also what makes it capturable
  // by scripts/html-snapshot.mjs, whose whole premise is a single GET.
  const profile = await getOwnProfile()

  return (
    <div className="shell py-12">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-10">
          <Eyebrow tone="accent">SUBMIT / 00</Eyebrow>
          <h1 className="mt-3 text-[clamp(28px,4vw,40px)] font-black leading-[1.1] text-foreground">
            提交项目
          </h1>
          <p className="mt-3 max-w-[60ch] text-body leading-[1.7] text-muted-foreground">
            填写你的产品信息，保存草稿后可以随时回来继续编辑。
            确认无误后提交审核，通过后将在平台公开展示。
          </p>
        </header>
        <ProjectSubmissionForm
          serverAuthenticated
          initialNickname={profile?.nickname ?? null}
        />
      </div>
    </div>
  )
}
