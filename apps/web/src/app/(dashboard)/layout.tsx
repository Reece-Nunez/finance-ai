import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { SessionWrapper } from '@/components/session/SessionWrapper'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile for the header
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('first_name, last_name')
    .eq('user_id', user.id)
    .maybeSingle()

  // Get name from profile or auth metadata
  const firstName = profile?.first_name || user.user_metadata?.first_name || null
  const lastName = profile?.last_name || user.user_metadata?.last_name || null
  const fullName = firstName ? (lastName ? `${firstName} ${lastName}` : firstName) : null

  return (
    <SessionWrapper>
      <div className="flex h-screen bg-neutral-50 dark:bg-neutral-950">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header user={user} userName={fullName} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SessionWrapper>
  )
}
