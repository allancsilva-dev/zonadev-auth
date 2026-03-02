import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getMe } from '@/lib/auth';
import { serverFetch } from '@/lib/api/server';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { User } from '@/types/user';
import { DeactivateButton } from './DeactivateButton';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

const roleLabel: Record<string, string> = {
  SUPERADMIN: 'Super Admin',
  ADMIN: 'Admin',
  USER: 'Utilizador',
};

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params;

  const me = await getMe();
  if (!me || (me.role !== 'SUPERADMIN' && me.role !== 'ADMIN')) redirect('/login');

  let user: User;
  try {
    user = await serverFetch<User>(`/users/${id}`);
  } catch {
    notFound();
  }

  // ADMIN can only view users from their own tenant
  if (me.role === 'ADMIN' && user.tenantId !== me.tenantId) redirect('/admin/users');

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/users"
          className="text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Voltar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{user.email}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{roleLabel[user.role] ?? user.role}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Detalhes</h2>
          <dl className="space-y-2.5">
            <div className="flex justify-between items-center">
              <dt className="text-sm text-slate-500">ID</dt>
              <dd className="text-sm text-slate-300 font-mono">{user.id.slice(0, 8)}…</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm text-slate-500">Email</dt>
              <dd className="text-sm text-slate-300">{user.email}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm text-slate-500">Role</dt>
              <dd className="text-sm text-slate-300">{roleLabel[user.role] ?? user.role}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm text-slate-500">Estado</dt>
              <dd><StatusBadge status={user.active} /></dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm text-slate-500">Email verificado</dt>
              <dd className="text-sm text-slate-300">
                {user.emailVerifiedAt
                  ? new Date(user.emailVerifiedAt).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })
                  : <span className="text-slate-600">Não verificado</span>}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Tenant & Datas</h2>
          <dl className="space-y-2.5">
            <div className="flex justify-between items-center">
              <dt className="text-sm text-slate-500">Tenant</dt>
              <dd className="text-sm text-slate-300">
                {user.tenant ? (
                  me.role === 'SUPERADMIN' ? (
                    <Link
                      href={`/admin/tenants/${user.tenantId}`}
                      className="text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {user.tenant.name}
                    </Link>
                  ) : (
                    user.tenant.name
                  )
                ) : (
                  <span className="text-slate-600">—</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm text-slate-500">Criado em</dt>
              <dd className="text-sm text-slate-300">
                {new Date(user.createdAt).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm text-slate-500">Atualizado em</dt>
              <dd className="text-sm text-slate-300">
                {new Date(user.updatedAt).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {user.active && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Ações</h2>
          <DeactivateButton userId={user.id} />
        </div>
      )}
    </div>
  );
}
