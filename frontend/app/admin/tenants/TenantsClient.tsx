'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/admin/DataTable';
import { Modal } from '@/components/admin/Modal';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Pagination } from '@/components/admin/Pagination';
import { useToast } from '@/components/admin/Toast';
import { getTenants, createTenant, updateTenant, deleteTenant } from '@/lib/api/tenants';
import { queryKeys } from '@/lib/queryKeys';
import { tenantSchema, TenantFormData } from '@/lib/validations/tenant';
import { getErrorMessage } from '@/types/api-error';
import { Tenant, PlanType } from '@/types/tenant';
import { useAuth } from '@/hooks/useAuth';

const PAGE_SIZE = 10;
const PLAN_OPTIONS: PlanType[] = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-red-400 text-xs mt-1">{message}</p>;
}

export default function TenantsClient() {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tenant | null>(null);

  const { data: tenants = [], isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.tenants(),
    queryFn: getTenants,
  });

  const createForm = useForm({
    resolver: zodResolver(tenantSchema),
    defaultValues: { name: '', subdomain: '', ownerEmail: '', plan: 'FREE', active: true },
  });

  const editForm = useForm({
    resolver: zodResolver(tenantSchema),
  });

  const createMutation = useMutation({
    mutationFn: createTenant,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.tenants() });
      await qc.invalidateQueries({ queryKey: queryKeys.stats() });
      toast.success('Tenant criado com sucesso!');
      setCreateOpen(false);
      createForm.reset();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Não foi possível criar o tenant.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TenantFormData> }) =>
      updateTenant(id, data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.tenants() });
      toast.success('Tenant atualizado!');
      setEditTarget(null);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Não foi possível atualizar o tenant.')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTenant,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.tenants() });
      await qc.invalidateQueries({ queryKey: queryKeys.stats() });
      toast.success('Tenant removido.');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Não foi possível remover o tenant.')),
  });

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.subdomain.toLowerCase().includes(search.toLowerCase())
  );
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openEdit(tenant: Tenant) {
    setEditTarget(tenant);
    editForm.reset({
      name: tenant.name,
      subdomain: tenant.subdomain,
      plan: tenant.plan as PlanType,
      active: tenant.active,
    });
  }

  function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja remover este tenant?')) return;
    deleteMutation.mutate(id);
  }

  const columns: Column<Tenant>[] = [
    { key: 'name', label: 'Nome' },
    {
      key: 'subdomain', label: 'Subdomínio',
      render: row => <span className="font-mono text-xs text-slate-400">{row.subdomain}.zonadev.tech</span>,
    },
    { key: 'plan', label: 'Plano', render: row => <span className="text-indigo-400 text-xs font-medium">{row.plan}</span> },
    { key: 'active', label: 'Status', render: row => <StatusBadge status={row.active} /> },
    {
      key: 'provisionStatus',
      label: 'Provisionamento',
      render: (row) => <StatusBadge status={(row.provisionStatus ?? 'pending').toUpperCase() as any} />,
    },
    {
      key: 'actions', label: 'Ações',
      render: row => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(row)} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Editar</button>
          <button onClick={() => handleDelete(row.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Remover</button>
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Tenants</h1>
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-400 text-sm">Falha ao carregar tenants</p>
          <button onClick={() => refetch()} className="text-xs text-red-400 hover:text-red-300 underline">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-slate-400 text-sm mt-1">
            {filtered.length} tenant{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setCreateOpen(true); createForm.reset(); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Tenant
        </button>
      </div>

      <input
        type="search"
        placeholder="Buscar por nome ou subdomínio..."
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm bg-[#1a1a1a] border border-[#2a2a2a] text-slate-200 placeholder-slate-500 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
        <DataTable data={paginated} columns={columns} loading={isLoading} emptyMessage="Nenhum tenant encontrado." />
        <Pagination total={filtered.length} page={page} limit={PAGE_SIZE} />
      </div>

      {/* Modal — Criar */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo Tenant">
        <form
          onSubmit={createForm.handleSubmit((data) =>
            createMutation.mutate({
              ...data,
              ownerAuthUserId: user.sub,
            })
          )}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Nome</label>
            <input
              {...createForm.register('name')}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <FieldError message={createForm.formState.errors.name?.message} />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Subdomínio</label>
            <input
              {...createForm.register('subdomain')}
              placeholder="ex: minha-empresa"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <FieldError message={createForm.formState.errors.subdomain?.message} />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Plano</label>
            <select {...createForm.register('plan')} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">E-mail do Admin Inicial</label>
            <input
              type="email"
              {...createForm.register('ownerEmail')}
              placeholder="admin@empresa.com"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <FieldError message={createForm.formState.errors.ownerEmail?.message} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="active-create" {...createForm.register('active')} className="accent-indigo-500" />
            <label htmlFor="active-create" className="text-sm text-slate-300">Ativo</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors"
            >
              {createMutation.isPending ? 'Criando...' : 'Criar Tenant'}
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 text-slate-400 hover:text-slate-200 text-sm transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal — Editar */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar Tenant">
        {editTarget && (
          <form
            onSubmit={editForm.handleSubmit(data => updateMutation.mutate({ id: editTarget.id, data }))}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Nome</label>
              <input
                {...editForm.register('name')}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <FieldError message={editForm.formState.errors.name?.message} />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Plano</label>
              <select {...editForm.register('plan')} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active-edit" {...editForm.register('active')} className="accent-indigo-500" />
              <label htmlFor="active-edit" className="text-sm text-slate-300">Ativo</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors"
              >
                {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </button>
              <button type="button" onClick={() => setEditTarget(null)} className="px-4 text-slate-400 hover:text-slate-200 text-sm transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
