'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetchJson } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

interface AdminStats {
  tenantsActive: number;
  totalUsers: number;
  subscriptionsActive: number;
  subscriptionsExpiringSoon: number;
}

export function StatsCards() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.stats(),
    queryFn: () => apiFetchJson<AdminStats>('/admin/stats'),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 animate-pulse">
            <div className="h-4 w-24 bg-[#2a2a2a] rounded mb-2" />
            <div className="h-8 w-16 bg-[#2a2a2a] rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
        <p className="text-red-400 text-sm">Falha ao carregar estatísticas</p>
        <button onClick={() => refetch()} className="text-xs text-red-400 hover:text-red-300 underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  const cards = [
    { label: 'Tenants Activos', value: data.tenantsActive, color: 'text-indigo-400' },
    { label: 'Total de Utilizadores', value: data.totalUsers, color: 'text-violet-400' },
    { label: 'Assinaturas Activas', value: data.subscriptionsActive, color: 'text-emerald-400' },
    { label: 'Expiram em 30 dias', value: data.subscriptionsExpiringSoon, color: 'text-amber-400' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(card => (
        <div key={card.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <p className="text-slate-400 text-sm">{card.label}</p>
          <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
