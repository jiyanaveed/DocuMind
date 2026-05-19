import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TopNav from './topnav';
import Sidebar from './sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNav email={user.email ?? ''} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6 bg-[var(--off-white)]">{children}</main>
      </div>
    </div>
  );
}
