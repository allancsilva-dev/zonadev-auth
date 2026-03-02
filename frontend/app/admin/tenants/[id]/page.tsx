import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getMe } from '@/lib/auth';
import { serverFetch } from '@/lib/api/server';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Tenant } from '@/types/tenant';
import { User } from '@/types/user';

export const dynamic = 'force-dynamic';

interface TenantUsersResponse {
  data: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface Props {
  params: Promise<{ id: string }>;
}

async function TenantUsers({ tenantId }: { tenantId: string }) {
  let result: TenantUsersResponse;
  try {
    result = await serverFetch<TenantUsersResponse>(`/tenants/${tenantId}/users?limit=20`);
  } catch {
    return (
      <p className="text-slate-500 text-sm">Não foi possível carregar os utilizadores.</p>
    );
  }

  if (result.data.length === 0) {
    return <p className="text-slate-500 text-sm">Nenhum utilizador neste tenant.</p>;
  }

  return (
    <div className="space-y-2">
      {result.data.map((user) => (
        <div key={user.id} className="flex items-center justify-between py-2.5 border-b border-[#2a2a2a] last:border-0">
          <div>
            <Link
              href={`/admin/users/${user.id}`}
              className="text-sm text-slate-200 hover:text-indigo-400 transition-colors"
            >
              {user.email}
            </Link>
            <p className="text-xs text-slate-500 mt-0.5">{user.role}</p>
          </div>
          <StatusBadge status={user.active} />
        </div>
      ))}
      {result.total > result.data.length && (
        <p className="text-xs text-slate-500 pt-1">
          Mostrando {result.data.length} de {result.total} utilizadores.
        </p>
      )}
    </div>
  );
}

export default async function TenantDetailPage({ params }: Props) {
  const { id } = await params;

  const me = await getMe();
  if (!me || me.role !== 'SUPERADMIN') redirect('/admin');

  let tenant: Tenant;
  try {
    tenant = await serverFetch<Tenant>(`/tenants/${id}`);
  } catch {
    notFound();
  }

  const planColors: Record<string, string> = {
    FREE: 'text-slate-400',
    STARTER: 'text-blue-400',
    PRO: 'text-indigo-400',
    ENTERPRISE: 'text-purple-400',
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/tenants"
          className="text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Voltar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{tenant.subdomain}.zonadev.tech</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Detalhes</h2>
          <dl className="space-y-2.5">
            <div className="flex justify-between items-center">
              <dt className="text-sm text-slate-500">ID</dt>
              <dd className="text-sm text-slate-300 font-mono">{tenant.id.slice(0, 8)}…</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm text-slate-500">Subdomínio</dt>
              <dd className="text-sm text-slate-300">{tenant.subdomain}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm text-slate-500">Plano</dt>
              <dd className={`text-sm font-medium ${planColors[tenant.plan] ?? 'text-slate-300'}`}>
                {tenant.plan}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm text-slate-500">Estado</dt>
              <dd><StatusBadge status={tenant.active} /></dd>
            </div>
          </dl>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Datas</h2>
          <dl className="space-y-2.5">
            <div className="flex justify-between items-center">
              <dt className="text-sm text-slate-500">Criado em</dt>
              <dd className="text-sm text-slate-300">
                {new Date(tenant.createdAt).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm text-slate-500">Atualizado em</dt>
              <dd className="text-sm text-slate-300">
                {new Date(tenant.updatedAt).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Utilizadores</h2>
        <TenantUsers tenantId={tenant.id} />
      </div>
    </div>
  );
}
