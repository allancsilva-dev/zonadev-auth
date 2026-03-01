'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, Column } from '@/components/admin/DataTable';
import { Modal } from '@/components/admin/Modal';
import { useToast } from '@/components/admin/Toast';
import { createPlan, updatePlan } from '@/lib/api/plans';
import { getErrorMessage } from '@/types/api-error';
import { Plan, CreatePlanPayload, UpdatePlanPayload } from '@/types/plan';

interface PlansClientProps {
  initialData: Plan[];
}

const emptyForm: CreatePlanPayload = { name: '', price: 0, maxUsers: 5, features: {} };

export default function PlansClient({ initialData }: PlansClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Plan | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [form, setForm] = useState<CreatePlanPayload>(emptyForm);

  async function handleCreate() {
    if (isPending) return;
    setIsPending(true);
    try {
      await createPlan(form);
      toast.success('Plano criado com sucesso!');
      setCreateOpen(false);
      setForm(emptyForm);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível criar o plano.'));
    } finally {
      setIsPending(false);
    }
  }

  async function handleUpdate() {
    if (!editTarget || isPending) return;
    setIsPending(true);
    const payload: UpdatePlanPayload = {
      name: editTarget.name,
      price: editTarget.price,
      maxUsers: editTarget.maxUsers,
      features: editTarget.features,
    };
    try {
      await updatePlan(editTarget.id, payload);
      toast.success('Plano atualizado!');
      setEditTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível atualizar o plano.'));
    } finally {
      setIsPending(false);
    }
  }

  const columns: Column<Plan>[] = [
    { key: 'name', label: 'Nome' },
    { key: 'price', label: 'Preço', render: row => <span className="text-emerald-400">R$ {Number(row.price).toFixed(2)}</span> },
    { key: 'maxUsers', label: 'Máx. Usuários', render: row => <span className="text-slate-300">{row.maxUsers}</span> },
    {
      key: 'actions',
      label: 'Ações',
      render: row => (
        <button
          onClick={() => setEditTarget({ ...row })}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Editar
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Planos</h1>
          <p className="text-slate-400 text-sm mt-1">{initialData.length} plano{initialData.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Plano
        </button>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <DataTable data={initialData} columns={columns} emptyMessage="Nenhum plano cadastrado." />
      </div>

      {/* Modal — Criar */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setForm(emptyForm); }} title="Novo Plano">
        <PlanForm
          form={form}
          onChange={partial => setForm(f => ({ ...f, ...partial }))}
          onSubmit={handleCreate}
          onCancel={() => { setCreateOpen(false); setForm(emptyForm); }}
          isPending={isPending}
          submitLabel="Criar Plano"
        />
      </Modal>

      {/* Modal — Editar */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar Plano">
        {editTarget && (
          <PlanForm
            form={{ name: editTarget.name, price: editTarget.price, maxUsers: editTarget.maxUsers, features: editTarget.features }}
            onChange={partial => setEditTarget(t => t ? { ...t, ...partial } : t)}
            onSubmit={handleUpdate}
            onCancel={() => setEditTarget(null)}
            isPending={isPending}
            submitLabel="Salvar Alterações"
          />
        )}
      </Modal>
    </div>
  );
}

function PlanForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
}: {
  form: CreatePlanPayload;
  onChange: (partial: Partial<CreatePlanPayload>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-slate-300 mb-1.5">Nome do Plano</label>
        <input
          value={form.name}
          onChange={e => onChange({ name: e.target.value })}
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Preço (R$)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={e => onChange({ price: parseFloat(e.target.value) || 0 })}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Máx. Usuários</label>
          <input
            type="number"
            min="1"
            value={form.maxUsers}
            onChange={e => onChange({ maxUsers: parseInt(e.target.value) || 1 })}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          onClick={onSubmit}
          disabled={isPending || !form.name}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg py-2 transition-colors"
        >
          {isPending ? 'Salvando...' : submitLabel}
        </button>
        <button onClick={onCancel} className="px-4 text-slate-400 hover:text-slate-200 text-sm transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  );
}
