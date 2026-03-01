import { SubscriptionStatus } from '@/types/subscription';

const styles: Record<string, string> = {
  ACTIVE: 'bg-emerald-900 text-emerald-300',
  EXPIRED: 'bg-red-900 text-red-300',
  CANCELLED: 'bg-slate-700 text-slate-400',
  SUSPENDED: 'bg-yellow-900 text-yellow-300',
  true: 'bg-emerald-900 text-emerald-300',
  false: 'bg-red-900 text-red-300',
};

const labels: Record<string, string> = {
  ACTIVE: 'Ativo',
  EXPIRED: 'Expirado',
  CANCELLED: 'Cancelado',
  SUSPENDED: 'Suspenso',
  true: 'Ativo',
  false: 'Inativo',
};

interface StatusBadgeProps {
  status: SubscriptionStatus | boolean;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const key = String(status);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[key] ?? 'bg-slate-700 text-slate-400'}`}>
      {labels[key] ?? key}
    </span>
  );
}
