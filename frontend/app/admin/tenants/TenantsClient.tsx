'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, Column } from '@/components/admin/DataTable';
import { Modal } from '@/components/admin/Modal';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Pagination } from '@/components/admin/Pagination';
import { useToast } from '@/components/admin/Toast';
import { createTenant, updateTenant, deleteTenant } from '@/lib/api/tenants';
import { getErrorMessage } from '@/types/api-error';
import { Tenant, CreateTenantPayload, PlanType } from '@/types/tenant';

const PAGE_SIZE = 10;
const PLAN_OPTIONS: PlanType[] = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];

interface TenantsClientProps {
  initialData: Tenant[];
}

export default function TenantsClient({ initialData }: TenantsClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tenant | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Form state — criação
  const [form, setForm] = useState<CreateTenantPayload>({ name: '', subdomain: '', plan: 'FREE', active: true });

  // Filtro client-side sobre dados SSR (suficiente para admin — lista completa é pequena)
  const filtered = initialData.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.subdomain.toLowerCase().includes(search.toLowerCase())
  );
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetForm = useCallback(() => {
    setForm({ name: '', subdomain: '', plan: 'FREE', active: true });
  }, []);

  async function handleCreate() {
    if (isPending) return;
    setIsPending(true);
    try {
      await createTenant(form);
      toast.success('Tenant criado com sucesso!');
      setCreateOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível criar o tenant.'));
    } finally {
      setIsPending(false);
    }
  }

  async function handleUpdate() {
    if (!editTarget || isPending) return;
    setIsPending(true);
    try {
      await updateTenant(editTarget.id, { active: editTarget.active, plan: editTarget.plan, name: editTarget.name });
      toast.success('Tenant atualizado!');
      setEditTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível atualizar o tenant.'));
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(id: string) {
    if (isPending) return;
    if (!confirm('Tem certeza que deseja remover este tenant?')) return;
    setIsPending(true);
    try {
      await deleteTenant(id);
      toast.success('Tenant removido.');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível remover o tenant.'));
    } finally {
      setIsPending(false);
    }
  }

  const columns: Column<Tenant>[] = [
    { key: 'name', label: 'Nome' },
    { key: 'subdomain', label: 'Subdomínio', render: row => <span className="font-mono text-xs text-slate-400">{row.subdomain}.zonadev.tech</span> },
    { key: 'plan', label: 'Plano', render: row => <span className="text-indigo-400 text-xs font-medium">{row.plan}</span> },
    { key: 'active', label: 'Status', render: row => <StatusBadge status={row.active} /> },
    {
      key: 'actions',
      label: 'Ações',
      render: row => (
        <div className="flex gap-2">
          <button
            onClick={() => setEditTarget({ ...row })}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Editar
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Remover
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-slate-400 text-sm mt-1">{filtered.length} tenant{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Tenant
        </button>
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Buscar por nome ou subdomínio..."
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <DataTable data={paginated} columns={columns} emptyMessage="Nenhum tenant encontrado." />
        <Pagination total={filtered.length} page={page} limit={PAGE_SIZE} />
      </div>

      {/* Modal — Criar */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); resetForm(); }} title="Novo Tenant">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Nome</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Subdomínio</label>
            <input
              value={form.subdomain}
              onChange={e => setForm(f => ({ ...f, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
              placeholder="ex: minha-empresa"
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Plano</label>
            <select
              value={form.plan}
              onChange={e => setForm(f => ({ ...f, plan: e.target.value as PlanType }))}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active-create"
              checked={form.active}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              className="accent-indigo-500"
            />
            <label htmlFor="active-create" className="text-sm text-slate-300">Ativo</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={isPending || !form.name || !form.subdomain}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg py-2 transition-colors"
            >
              {isPending ? 'Criando...' : 'Criar Tenant'}
            </button>
            <button
              onClick={() => { setCreateOpen(false); resetForm(); }}
              className="px-4 text-slate-400 hover:text-slate-200 text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal — Editar */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar Tenant">
        {editTarget && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Nome</label>
              <input
                value={editTarget.name}
                onChange={e => setEditTarget(t => t ? { ...t, name: e.target.value } : t)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Plano</label>
              <select
                value={editTarget.plan}
                onChange={e => setEditTarget(t => t ? { ...t, plan: e.target.value as PlanType } : t)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active-edit"
                checked={editTarget.active}
                onChange={e => setEditTarget(t => t ? { ...t, active: e.target.checked } : t)}
                className="accent-indigo-500"
              />
              <label htmlFor="active-edit" className="text-sm text-slate-300">Ativo</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleUpdate}
                disabled={isPending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg py-2 transition-colors"
              >
                {isPending ? 'Salvando...' : 'Salvar Alterações'}
              </button>
              <button
                onClick={() => setEditTarget(null)}
                className="px-4 text-slate-400 hover:text-slate-200 text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
