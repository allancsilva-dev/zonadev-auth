// Server Component — Dashboard com Suspense granular
import { Suspense } from 'react';
import { serverFetch } from '@/lib/api/server';
import { SkeletonRow } from '@/components/admin/SkeletonRow';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Tenant } from '@/types/tenant';
import { Plan } from '@/types/plan';
import { Subscription } from '@/types/subscription';
import { User } from '@/types/user';

interface SummaryData {
  tenantCount: number;
  userCount: number;
  activeSubCount: number;
  planCount: number;
}

async function SummaryCards() {
  // Promise.all para buscar em paralelo — nunca chamadas sequenciais
  const [tenants, users, subscriptions, plans] = await Promise.all([
    serverFetch<Tenant[]>('/tenants'),
    serverFetch<User[]>('/users'),
    serverFetch<Subscription[]>('/subscriptions'),
    serverFetch<Plan[]>('/plans'),
  ]);

  const summary: SummaryData = {
    tenantCount: tenants.length,
    userCount: users.length,
    activeSubCount: subscriptions.filter(s => s.status === 'ACTIVE').length,
    planCount: plans.length,
  };

  const cards = [
    { label: 'Tenants', value: summary.tenantCount, color: 'text-indigo-400' },
    { label: 'Usuários', value: summary.userCount, color: 'text-violet-400' },
    { label: 'Assinaturas Ativas', value: summary.activeSubCount, color: 'text-emerald-400' },
    { label: 'Planos', value: summary.planCount, color: 'text-blue-400' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(card => (
        <div key={card.label} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-sm">{card.label}</p>
          <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}

async function RecentTenants() {
  const tenants = await serverFetch<Tenant[]>('/tenants');
  const recent = tenants.slice(-5).reverse();

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <h2 className="text-white font-semibold mb-4">Tenants Recentes</h2>
      {recent.length === 0 ? (
        <p className="text-slate-500 text-sm">Nenhum tenant cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {recent.map(tenant => (
            <div key={tenant.id} className="flex items-center justify-between">
              <div>
                <p className="text-slate-200 text-sm font-medium">{tenant.name}</p>
                <p className="text-slate-500 text-xs">{tenant.subdomain}.zonadev.tech</p>
              </div>
              <StatusBadge status={tenant.active} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function RecentSubscriptions() {
  const subscriptions = await serverFetch<Subscription[]>('/subscriptions');
  const recent = subscriptions.slice(-5).reverse();

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <h2 className="text-white font-semibold mb-4">Assinaturas Recentes</h2>
      {recent.length === 0 ? (
        <p className="text-slate-500 text-sm">Nenhuma assinatura encontrada.</p>
      ) : (
        <div className="space-y-3">
          {recent.map(sub => (
            <div key={sub.id} className="flex items-center justify-between">
              <div>
                <p className="text-slate-200 text-sm font-medium">{sub.tenant?.name ?? sub.tenantId}</p>
                <p className="text-slate-500 text-xs">
                  {sub.plan?.name} — expira {new Date(sub.expiresAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <StatusBadge status={sub.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Visão geral da plataforma ZonaDev</p>
      </div>

      {/* Cards de resumo — se falhar, apenas este bloco exibe erro */}
      <Suspense fallback={
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-5 animate-pulse">
              <div className="h-4 w-24 bg-slate-700 rounded mb-2" />
              <div className="h-8 w-16 bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      }>
        <SummaryCards />
      </Suspense>

      {/* Listas recentes — falhas independentes entre si */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Suspense fallback={<SkeletonRow rows={5} cols={2} />}>
          <RecentTenants />
        </Suspense>

        <Suspense fallback={<SkeletonRow rows={5} cols={2} />}>
          <RecentSubscriptions />
        </Suspense>
      </div>
    </div>
  );
}
