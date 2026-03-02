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
import { getUsers, createUser, deactivateUser } from '@/lib/api/users';
import { getTenants } from '@/lib/api/tenants';
import { queryKeys } from '@/lib/queryKeys';
import { userSchema, UserFormData } from '@/lib/validations/user';
import { getErrorMessage } from '@/types/api-error';
import { User, Role } from '@/types/user';

const PAGE_SIZE = 25;
const ROLES: Role[] = ['USER', 'ADMIN', 'SUPERADMIN'];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-red-400 text-xs mt-1">{message}</p>;
}

export default function UsersClient() {
  const qc = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const params = { page, limit: PAGE_SIZE, search: search || undefined };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.users(params),
    queryFn: () => getUsers(params),
    placeholderData: prev => prev,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: queryKeys.tenants(),
    queryFn: getTenants,
  });

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { email: '', password: '', tenantId: '', role: 'USER', active: false },
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users'] });
      await qc.invalidateQueries({ queryKey: queryKeys.stats() });
      toast.success('Utilizador criado com sucesso!');
      setCreateOpen(false);
      form.reset();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Não foi possível criar o utilizador.')),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users'] });
      await qc.invalidateQueries({ queryKey: queryKeys.stats() });
      toast.success('Utilizador desativado.');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Não foi possível desativar o utilizador.')),
  });

  function handleDeactivate(id: string) {
    if (!confirm('Desativar este utilizador?')) return;
    deactivateMutation.mutate(id);
  }

  const roleBadge = (role: Role) => {
    const colors: Record<Role, string> = {
      SUPERADMIN: 'text-violet-400 bg-violet-900/40',
      ADMIN: 'text-indigo-400 bg-indigo-900/40',
      USER: 'text-slate-400 bg-slate-700',
    };
    return <span className={`text-xs px-2 py-0.5 rounded font-medium ${colors[role]}`}>{role}</span>;
  };

  const columns: Column<User>[] = [
    { key: 'email', label: 'E-mail', render: row => <span className="font-mono text-xs text-slate-200">{row.email}</span> },
    { key: 'tenant', label: 'Tenant', render: row => row.tenant?.name ?? <span className="text-slate-500">—</span> },
    { key: 'role', label: 'Role', render: row => roleBadge(row.role) },
    { key: 'active', label: 'Status', render: row => <StatusBadge status={row.active} /> },
    {
      key: 'emailVerifiedAt', label: 'E-mail verificado',
      render: row => row.emailVerifiedAt ? (
        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : <span className="text-slate-600 text-xs">Não</span>,
    },
    {
      key: 'actions', label: 'Ações',
      render: row => row.active ? (
        <button
          onClick={() => handleDeactivate(row.id)}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Desativar
        </button>
      ) : <span className="text-slate-600 text-xs">—</span>,
    },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Utilizadores</h1>
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-400 text-sm">Falha ao carregar utilizadores</p>
          <button onClick={() => refetch()} className="text-xs text-red-400 hover:text-red-300 underline">Tentar novamente</button>
        </div>
      </div>
    );
  }

  const users = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Utilizadores</h1>
          <p className="text-slate-400 text-sm mt-1">{total} utilizador{total !== 1 ? 'es' : ''}</p>
        </div>
        <button
          onClick={() => { setCreateOpen(true); form.reset(); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Utilizador
        </button>
      </div>

      <input
        type="search"
        placeholder="Buscar por e-mail..."
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm bg-[#1a1a1a] border border-[#2a2a2a] text-slate-200 placeholder-slate-500 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
        <DataTable data={users} columns={columns} loading={isLoading} emptyMessage="Nenhum utilizador encontrado." />
        <Pagination total={total} page={page} limit={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {/* Modal — Criar */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo Utilizador">
        <form onSubmit={form.handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">E-mail</label>
            <input
              type="email"
              {...form.register('email')}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <FieldError message={form.formState.errors.email?.message} />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Senha (mín. 8 caracteres)</label>
            <input
              type="password"
              {...form.register('password')}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <FieldError message={form.formState.errors.password?.message} />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Tenant (opcional)</label>
            <select {...form.register('tenantId')} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Sem tenant</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Role</label>
            <select {...form.register('role')} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="active-user" {...form.register('active')} className="accent-indigo-500" />
            <label htmlFor="active-user" className="text-sm text-slate-300">Ativo</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors"
            >
              {createMutation.isPending ? 'Criando...' : 'Criar Utilizador'}
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 text-slate-400 hover:text-slate-200 text-sm transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
