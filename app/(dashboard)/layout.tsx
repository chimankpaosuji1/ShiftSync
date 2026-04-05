import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { UserProvider } from '@/components/layout/user-context'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const u = session.user as { id?: string; name?: string; role?: string }
  const user = {
    id: u.id ?? '',
    name: u.name ?? '',
    role: u.role ?? '',
  }

  return (
    <UserProvider user={user}>
      <div className="flex min-h-screen bg-background">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col min-w-0">
          {children}
        </div>
      </div>
    </UserProvider>
  )
}
