// Server Component — dupla validação completa (defesa em profundidade)
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { decodeJwtPayload, isTokenExpired, isTokenTrusted } from '@/lib/jwt';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/admin/Toast';
import Sidebar from '@/components/admin/Sidebar';

export const metadata: Metadata = {
  title: 'ZonaDev Admin',
  robots: { index: false, follow: false }, // bloqueia indexação acidental
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  if (!token) redirect('/login');

  const payload = decodeJwtPayload(token);

  // Lidos sem `!` — falhar controladamente é melhor que crashar em runtime
  const expectedIss = process.env.JWT_EXPECTED_ISS;
  const expectedAud = process.env.JWT_EXPECTED_AUD;

  // Se env vars não configuradas, redireciona em vez de explodir
  if (!expectedIss || !expectedAud) redirect('/login');

  // Mesmos critérios do middleware — iss, aud, role, exp
  if (
    !payload ||
    isTokenExpired(payload) ||
    !isTokenTrusted(payload, expectedIss, expectedAud) ||
    payload.role !== 'SUPERADMIN'
  ) {
    redirect('/login');
  }

  // Apenas claims necessários no contexto — nunca o token em si
  const user = {
    sub: payload.sub,
    role: payload.role,
    tenantId: payload.tenantId,
    plan: payload.plan,
  };

  return (
    <AuthProvider initialUser={user}>
      <ToastProvider>
        <div className="flex h-screen bg-slate-900">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-8">
            {children}
          </main>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
