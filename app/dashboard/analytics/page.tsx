import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AnalyticsClient } from './AnalyticsClient'

export default async function AnalyticsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <AnalyticsClient userName={session.name} />
}
