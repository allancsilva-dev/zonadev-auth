'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/admin/DataTable';
import { Modal } from '@/components/admin/Modal';
import { useToast } from '@/components/admin/Toast';
import { getPlans, createPlan, updatePlan } from '@/lib/api/plans';
import { queryKeys } from '@/lib/queryKeys';
import { planSchema } from '@/lib/validations/plan';
import { getErrorMessage } from '@/types/api-error';
import { Plan, UpdatePlanPayload } from '@/types/plan';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-red-400 text-xs mt-1">{message}</p>;
}

export default function PlansClient() {
  const qc = useQueryClient();
  const toast = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Plan | null>(null);

  const { data: plans = [], isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.plans(),
    queryFn: getPlans,
  });

  const createForm = useForm({
    resolver: zodResolver(planSchema),
    defaultValues: { name: '', price: 0, maxUsers: 5, features: {} },
  });

  const editForm = useForm({
    resolver: zodResolver(planSchema),
  });

  const createMutation = useMutation({
    mutationFn: createPlan,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.plans() });
      toast.success('Plano criado com sucesso!');
      setCreateOpen(false);
      createForm.reset();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Não foi possível criar o plano.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePlanPayload }) => updatePlan(id, data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.plans() });
      toast.success('Plano atualizado!');
      setEditTarget(null);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Não foi possível atualizar o plano.')),
  });

  function openEdit(plan: Plan) {
    setEditTarget(plan);
    editForm.reset({ name: plan.name, price: plan.price, maxUsers: plan.maxUsers, features: plan.features });
  }

  const columns: Column<Plan>[] = [
    { key: 'name', label: 'Nome' },
    { key: 'price', label: 'Preço', render: row => <span className="text-emerald-400">R$ {Number(row.price).toFixed(2)}</span> },
    { key: 'maxUsers', label: 'Máx. Utilizadores', render: row => <span className="text-slate-300">{row.maxUsers}</span> },
    {
      key: 'actions', label: 'Ações',
      render: row => (
        <button onClick={() => openEdit(row)} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          Editar
        </button>
      ),
    },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Planos</h1>
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-400 text-sm">Falha ao carregar planos</p>
          <button onClick={() => refetch()} className="text-xs text-red-400 hover:text-red-300 underline">Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Planos</h1>
          <p className="text-slate-400 text-sm mt-1">{plans.length} plano{plans.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setCreateOpen(true); createForm.reset(); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Plano
        </button>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
        <DataTable data={plans} columns={columns} loading={isLoading} emptyMessage="Nenhum plano cadastrado." />
      </div>

      {/* Modal — Criar */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo Plano">
        <form onSubmit={createForm.handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Nome do Plano</label>
            <input {...createForm.register('name')} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <FieldError message={createForm.formState.errors.name?.message} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Preço (R$)</label>
              <input type="number" min="0" step="0.01" {...createForm.register('price', { valueAsNumber: true })} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <FieldError message={createForm.formState.errors.price?.message} />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Máx. Utilizadores</label>
              <input type="number" min="1" {...createForm.register('maxUsers', { valueAsNumber: true })} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <FieldError message={createForm.formState.errors.maxUsers?.message} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={createMutation.isPending} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors">
              {createMutation.isPending ? 'Criando...' : 'Criar Plano'}
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 text-slate-400 hover:text-slate-200 text-sm transition-colors">Cancelar</button>
          </div>
        </form>
      </Modal>

      {/* Modal — Editar */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar Plano">
        {editTarget && (
          <form onSubmit={editForm.handleSubmit(data => updateMutation.mutate({ id: editTarget.id, data }))} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Nome do Plano</label>
              <input {...editForm.register('name')} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <FieldError message={editForm.formState.errors.name?.message} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Preço (R$)</label>
                <input type="number" min="0" step="0.01" {...editForm.register('price', { valueAsNumber: true })} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Máx. Utilizadores</label>
                <input type="number" min="1" {...editForm.register('maxUsers', { valueAsNumber: true })} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={updateMutation.isPending} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors">
                {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </button>
              <button type="button" onClick={() => setEditTarget(null)} className="px-4 text-slate-400 hover:text-slate-200 text-sm transition-colors">Cancelar</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
