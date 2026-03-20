// Server Component — força re-render a cada request (dados de sessão nunca cacheados)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getMe } from '@/lib/auth';
import { getRedirectByRole } from '@/lib/routeGuard';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/admin/Toast';
import Sidebar from '@/components/admin/Sidebar';
import Topbar from '@/components/admin/Topbar';

export const metadata: Metadata = {
  title: 'ZonaDev Admin',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getMe();

  if (!user) redirect('/login');

  // Apenas SUPERADMIN e ADMIN acedem ao painel
  const effectiveRole = user.roles?.[0] ?? user.role;
  if (!['SUPERADMIN', 'ADMIN'].includes(effectiveRole)) {
    redirect(getRedirectByRole(user.role));
  }

  const authUser = {
    sub: user.sub,
    email: user.email,
    role: effectiveRole,
    roles: user.roles,
    tenantId: user.tenantId,
    plan: user.plan,
  };

  return (
    <AuthProvider initialUser={authUser}>
      <ToastProvider>
        <div className="flex h-screen bg-[#0a0a0a] dark:bg-[#0a0a0a]">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-y-auto p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
