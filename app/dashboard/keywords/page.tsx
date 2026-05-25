import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { KeywordsClient } from './KeywordsClient'

export default async function KeywordsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <KeywordsClient userName={session.name} />
}
