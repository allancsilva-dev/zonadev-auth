'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, Column } from '@/components/admin/DataTable';
import { Modal } from '@/components/admin/Modal';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Pagination } from '@/components/admin/Pagination';
import { useToast } from '@/components/admin/Toast';
import { createSubscription, cancelSubscription, suspendSubscription } from '@/lib/api/subscriptions';
import { getErrorMessage } from '@/types/api-error';
import { Subscription, CreateSubscriptionPayload } from '@/types/subscription';
import { Tenant } from '@/types/tenant';
import { Plan } from '@/types/plan';

const PAGE_SIZE = 10;

interface SubscriptionsClientProps {
  initialData: Subscription[];
  tenants: Tenant[];
  plans: Plan[];
}

const emptyForm: CreateSubscriptionPayload = {
  tenantId: '',
  planId: '',
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
};

export default function SubscriptionsClient({ initialData, tenants, plans }: SubscriptionsClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [form, setForm] = useState<CreateSubscriptionPayload>(emptyForm);

  const filtered = initialData.filter(s =>
    (s.tenant?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (s.plan?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleCreate() {
    if (isPending) return;
    setIsPending(true);
    try {
      await createSubscription({ ...form, expiresAt: new Date(form.expiresAt).toISOString() });
      toast.success('Assinatura criada!');
      setCreateOpen(false);
      setForm(emptyForm);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível criar a assinatura.'));
    } finally {
      setIsPending(false);
    }
  }

  async function handleCancel(id: string) {
    if (isPending) return;
    if (!confirm('Cancelar esta assinatura?')) return;
    setIsPending(true);
    try {
      await cancelSubscription(id);
      toast.success('Assinatura cancelada.');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível cancelar.'));
    } finally {
      setIsPending(false);
    }
  }

  async function handleSuspend(id: string) {
    if (isPending) return;
    if (!confirm('Suspender esta assinatura?')) return;
    setIsPending(true);
    try {
      await suspendSubscription(id);
      toast.success('Assinatura suspensa.');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível suspender.'));
    } finally {
      setIsPending(false);
    }
  }

  const columns: Column<Subscription>[] = [
    { key: 'tenant', label: 'Tenant', render: row => row.tenant?.name ?? row.tenantId },
    { key: 'plan', label: 'Plano', render: row => <span className="text-indigo-400">{row.plan?.name ?? row.planId}</span> },
    { key: 'status', label: 'Status', render: row => <StatusBadge status={row.status} /> },
    { key: 'expiresAt', label: 'Expira em', render: row => new Date(row.expiresAt).toLocaleDateString('pt-BR') },
    {
      key: 'actions',
      label: 'Ações',
      render: row => row.status === 'ACTIVE' ? (
        <div className="flex gap-2">
          <button onClick={() => handleSuspend(row.id)} className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors">Suspender</button>
          <button onClick={() => handleCancel(row.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Cancelar</button>
        </div>
      ) : <span className="text-slate-600 text-xs">—</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Assinaturas</h1>
          <p className="text-slate-400 text-sm mt-1">{filtered.length} assinatura{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nova Assinatura
        </button>
      </div>

      <input
        type="search"
        placeholder="Buscar por tenant ou plano..."
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <DataTable data={paginated} columns={columns} emptyMessage="Nenhuma assinatura encontrada." />
        <Pagination total={filtered.length} page={page} limit={PAGE_SIZE} />
      </div>

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setForm(emptyForm); }} title="Nova Assinatura">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Tenant</label>
            <select
              value={form.tenantId}
              onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Selecione...</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name} — R$ {Number(p.price).toFixed(2)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Expira em</label>
            <input
              type="date"
              value={form.expiresAt}
              onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={isPending || !form.tenantId || !form.planId || !form.expiresAt}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg py-2 transition-colors"
            >
              {isPending ? 'Criando...' : 'Criar Assinatura'}
            </button>
            <button onClick={() => { setCreateOpen(false); setForm(emptyForm); }} className="px-4 text-slate-400 hover:text-slate-200 text-sm transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
