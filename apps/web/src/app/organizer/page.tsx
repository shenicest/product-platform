import { redirect } from 'next/navigation'
import { DEFAULT_ORGANIZER_TAB } from '@/components/organizer/organizer-tabs'

export default function OrganizerIndexPage() {
  redirect(`/organizer/${DEFAULT_ORGANIZER_TAB.slug}`)
}
