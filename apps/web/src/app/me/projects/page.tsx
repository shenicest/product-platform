import { WorkbenchPlaceholder } from '@/components/me/workbench-placeholder'
import { workbenchTabBySlug } from '@/lib/me'

export const metadata = { title: workbenchTabBySlug('projects')?.label ?? '个人中心' }

export default function Page() {
  return <WorkbenchPlaceholder slug="projects" />
}
