'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { deactivateUser } from '@/lib/api/users';
import { useToast } from '@/components/admin/Toast';
import { getErrorMessage } from '@/types/api-error';

export function DeactivateButton({ userId }: { userId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deactivateUser(userId),
    onSuccess: () => {
      toast.success('Utilizador desativado.');
      router.refresh();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Não foi possível desativar o utilizador.')),
  });

  if (!confirmed) {
    return (
      <button
        onClick={() => setConfirmed(true)}
        className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 hover:text-red-300 text-sm font-medium rounded-lg transition-colors"
      >
        Desativar Utilizador
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-400">Confirmar desativação?</span>
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {mutation.isPending ? 'A desativar…' : 'Confirmar'}
      </button>
      <button
        onClick={() => setConfirmed(false)}
        className="px-3 py-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors"
      >
        Cancelar
      </button>
    </div>
  );
}
