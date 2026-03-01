'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, Column } from '@/components/admin/DataTable';
import { Modal } from '@/components/admin/Modal';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Pagination } from '@/components/admin/Pagination';
import { useToast } from '@/components/admin/Toast';
import { createUser, deactivateUser } from '@/lib/api/users';
import { getErrorMessage } from '@/types/api-error';
import { User, CreateUserPayload, Role } from '@/types/user';
import { Tenant } from '@/types/tenant';

const PAGE_SIZE = 10;
const ROLES: Role[] = ['USER', 'ADMIN', 'SUPERADMIN'];

interface UsersClientProps {
  initialData: User[];
  tenants: Tenant[];
}

const emptyForm: CreateUserPayload = { email: '', password: '', tenantId: undefined, role: 'USER', active: true };

export default function UsersClient({ initialData, tenants }: UsersClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [form, setForm] = useState<CreateUserPayload>(emptyForm);

  const filtered = initialData.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.tenant?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleCreate() {
    if (isPending) return;
    setIsPending(true);
    try {
      await createUser({
        ...form,
        tenantId: form.tenantId || undefined,
      });
      toast.success('Usuário criado com sucesso!');
      setCreateOpen(false);
      setForm(emptyForm);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível criar o usuário.'));
    } finally {
      setIsPending(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (isPending) return;
    if (!confirm('Desativar este usuário?')) return;
    setIsPending(true);
    try {
      await deactivateUser(id);
      toast.success('Usuário desativado.');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível desativar o usuário.'));
    } finally {
      setIsPending(false);
    }
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
    { key: 'emailVerifiedAt', label: 'E-mail verificado', render: row => row.emailVerifiedAt ? (
      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ) : <span className="text-slate-600 text-xs">Não</span> },
    {
      key: 'actions',
      label: 'Ações',
      render: row => row.active ? (
        <button onClick={() => handleDeactivate(row.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
          Desativar
        </button>
      ) : <span className="text-slate-600 text-xs">—</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuários</h1>
          <p className="text-slate-400 text-sm mt-1">{filtered.length} usuário{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Usuário
        </button>
      </div>

      <input
        type="search"
        placeholder="Buscar por e-mail ou tenant..."
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <DataTable data={paginated} columns={columns} emptyMessage="Nenhum usuário encontrado." />
        <Pagination total={filtered.length} page={page} limit={PAGE_SIZE} />
      </div>

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setForm(emptyForm); }} title="Novo Usuário">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Senha (mín. 8 caracteres)</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Tenant (opcional)</label>
            <select
              value={form.tenantId ?? ''}
              onChange={e => setForm(f => ({ ...f, tenantId: e.target.value || undefined }))}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Sem tenant</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active-user"
              checked={form.active}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              className="accent-indigo-500"
            />
            <label htmlFor="active-user" className="text-sm text-slate-300">Ativo</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={isPending || !form.email || (form.password?.length ?? 0) < 8}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg py-2 transition-colors"
            >
              {isPending ? 'Criando...' : 'Criar Usuário'}
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
