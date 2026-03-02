'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DataTable, Column } from '@/components/admin/DataTable';
import { Modal } from '@/components/admin/Modal';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { useToast } from '@/components/admin/Toast';
import {
  getSubscriptions,
  createSubscription,
  cancelSubscription,
  suspendSubscription,
} from '@/lib/api/subscriptions';
import { getTenants } from '@/lib/api/tenants';
import { getPlans } from '@/lib/api/plans';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/types/api-error';
import { Subscription, CreateSubscriptionPayload } from '@/types/subscription';
import { MeResponse } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubscriptionsClientProps {
  currentUser: MeResponse;
}

interface Filters {
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | '';
  tenantId: string;
  page: number;
  limit: number;
  sort: string;
}

const PAGE_SIZES = [10, 25, 50] as const;

const emptyForm: CreateSubscriptionPayload = {
  tenantId: '',
  planId: '',
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SortHeader({
  label,
  field,
  sort,
  onSort,
}: {
  label: string;
  field: string;
  sort: string;
  onSort: (field: string) => void;
}) {
  const [currentField, currentDir] = sort.split(':');
  const isActive = currentField === field;
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-slate-400 hover:text-slate-200 font-medium transition-colors"
    >
      {label}
      <span className={`text-xs ${isActive ? 'text-indigo-400' : 'text-slate-600'}`}>
        {isActive ? (currentDir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  );
}

function ExpiryCell({ expiresAt }: { expiresAt: string }) {
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  const dateStr = new Date(expiresAt).toLocaleDateString('pt-BR');
  if (days < 0) return <span className="text-red-400">{dateStr}</span>;
  if (days < 30) {
    return (
      <span className="text-orange-400">
        {dateStr}{' '}
        <span className="text-xs opacity-80">({days}d)</span>
      </span>
    );
  }
  return <span>{dateStr}</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SubscriptionsClient({ currentUser }: SubscriptionsClientProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();

  const isSuperAdmin = currentUser.role === 'SUPERADMIN';

  const [filters, setFilters] = useState<Filters>({
    status: '',
    tenantId: isSuperAdmin ? '' : (currentUser.tenantId ?? ''),
    page: 1,
    limit: 25,
    sort: 'startedAt:desc',
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateSubscriptionPayload>(emptyForm);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Build query params — omit empty values
  const queryParams = {
    page: filters.page,
    limit: filters.limit,
    sort: filters.sort,
    status: filters.status || undefined,
    tenantId: filters.tenantId || undefined,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.subscriptions(queryParams),
    queryFn: () => getSubscriptions(queryParams),
    placeholderData: prev => prev,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: queryKeys.tenants(),
    queryFn: getTenants,
    enabled: isSuperAdmin,
  });

  const { data: plans = [] } = useQuery({
    queryKey: queryKeys.plans(),
    queryFn: getPlans,
  });

  // ─── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (payload: CreateSubscriptionPayload) =>
      createSubscription({ ...payload, expiresAt: new Date(payload.expiresAt).toISOString() }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['subscriptions'] });
      await qc.invalidateQueries({ queryKey: queryKeys.stats() });
      toast.success('Assinatura criada!');
      setCreateOpen(false);
      setForm(emptyForm);
      router.refresh();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Não foi possível criar a assinatura.')),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['subscriptions'] });
      await qc.invalidateQueries({ queryKey: queryKeys.stats() });
      toast.success('Assinatura cancelada.');
      setConfirmingId(null);
      router.refresh();
    },
    onError: (e) => {
      toast.error(getErrorMessage(e, 'Não foi possível cancelar.'));
      setConfirmingId(null);
    },
  });

  const suspendMutation = useMutation({
    mutationFn: suspendSubscription,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['subscriptions'] });
      await qc.invalidateQueries({ queryKey: queryKeys.stats() });
      toast.success('Assinatura suspensa.');
      router.refresh();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Não foi possível suspender.')),
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleSort(field: string) {
    setFilters(f => {
      const [currentField, currentDir] = f.sort.split(':');
      const newDir = currentField === field
        ? (currentDir === 'asc' ? 'desc' : 'asc')
        : 'asc';
      return { ...f, page: 1, sort: `${field}:${newDir}` };
    });
  }

  function resetPage(patch: Partial<Filters>) {
    setFilters(f => ({ ...f, ...patch, page: 1 }));
  }

  // ─── Columns ──────────────────────────────────────────────────────────────

  const columns: Column<Subscription>[] = [
    {
      key: 'tenant',
      label: 'Tenant',
      render: row => (
        <span className="font-medium text-slate-200">{row.tenant?.name ?? row.tenantId}</span>
      ),
    },
    {
      key: 'plan',
      label: 'Plano',
      render: row => (
        <span className="text-indigo-400">{row.plan?.name ?? row.planId}</span>
      ),
    },
    {
      key: 'status',
      label: <SortHeader label="Status" field="status" sort={filters.sort} onSort={handleSort} />,
      render: row => <StatusBadge status={row.status} />,
    },
    {
      key: 'startedAt',
      label: <SortHeader label="Início" field="startedAt" sort={filters.sort} onSort={handleSort} />,
      render: row => new Date(row.startedAt).toLocaleDateString('pt-BR'),
    },
    {
      key: 'expiresAt',
      label: <SortHeader label="Expira em" field="expiresAt" sort={filters.sort} onSort={handleSort} />,
      render: row => <ExpiryCell expiresAt={row.expiresAt} />,
    },
    {
      key: 'actions',
      label: 'Ações',
      render: row => {
        if (row.status !== 'ACTIVE') {
          return <span className="text-slate-600 text-xs">—</span>;
        }
        if (confirmingId === row.id) {
          return (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Confirmar?</span>
              <button
                onClick={() => cancelMutation.mutate(row.id)}
                disabled={cancelMutation.isPending}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
              >
                {cancelMutation.isPending ? 'A cancelar…' : 'Cancelar'}
              </button>
              <button
                onClick={() => setConfirmingId(null)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Voltar
              </button>
            </div>
          );
        }
        return (
          <div className="flex gap-3">
            <button
              onClick={() => suspendMutation.mutate(row.id)}
              disabled={suspendMutation.isPending}
              className="text-xs text-yellow-400 hover:text-yellow-300 disabled:opacity-50 transition-colors"
            >
              Suspender
            </button>
            <button
              onClick={() => setConfirmingId(row.id)}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Cancelar
            </button>
          </div>
        );
      },
    },
  ];

  // ─── Error state ──────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Assinaturas</h1>
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-400 text-sm">Falha ao carregar assinaturas</p>
          <button
            onClick={() => refetch()}
            className="text-xs text-red-400 hover:text-red-300 underline"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const subs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Assinaturas</h1>
          <p className="text-slate-400 text-sm mt-1">
            {total} assinatura{total !== 1 ? 's' : ''}
          </p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => { setCreateOpen(true); setForm(emptyForm); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nova Assinatura
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.status}
          onChange={e => resetPage({ status: e.target.value as Filters['status'] })}
          className="bg-[#1a1a1a] border border-[#2a2a2a] text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos os estados</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>

        {isSuperAdmin && (
          <select
            value={filters.tenantId}
            onChange={e => resetPage({ tenantId: e.target.value })}
            className="bg-[#1a1a1a] border border-[#2a2a2a] text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos os tenants</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
        <DataTable
          data={subs}
          columns={columns}
          loading={isLoading}
          emptyMessage="Nenhuma assinatura encontrada com os filtros actuais."
        />

        {/* Pagination */}
        {(totalPages > 1 || subs.length > 0) && (
          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Linhas:</span>
              {PAGE_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => resetPage({ limit: size })}
                  className={`px-2.5 py-1 text-xs rounded transition-colors ${
                    filters.limit === size
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#2a2a2a] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>

            <p className="text-slate-400 text-sm">
              Página {filters.page} de {totalPages} · {total} total
            </p>

            <div className="flex gap-1">
              <button
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                disabled={filters.page <= 1}
                className="px-3 py-1.5 text-sm rounded bg-[#1a1a1a] border border-[#2a2a2a] text-slate-300 hover:bg-[#2a2a2a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                disabled={filters.page >= totalPages}
                className="px-3 py-1.5 text-sm rounded bg-[#1a1a1a] border border-[#2a2a2a] text-slate-300 hover:bg-[#2a2a2a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create modal — SUPERADMIN only */}
      {isSuperAdmin && (
        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nova Assinatura">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Tenant</label>
              <select
                value={form.tenantId}
                onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecione...</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Plano</label>
              <select
                value={form.planId}
                onChange={e => setForm(f => ({ ...f, planId: e.target.value }))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecione...</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — R$ {Number(p.price).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Expira em</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending || !form.tenantId || !form.planId}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors"
              >
                {createMutation.isPending ? 'Criando...' : 'Criar Assinatura'}
              </button>
              <button
                onClick={() => setCreateOpen(false)}
                className="px-4 text-slate-400 hover:text-slate-200 text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
