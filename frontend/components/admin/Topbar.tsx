'use client';

import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from './ThemeToggle';

const roleLabel: Record<string, string> = {
  SUPERADMIN: 'Super Admin',
  ADMIN: 'Admin',
  USER: 'Utilizador',
};

export default function Topbar() {
  const { user } = useAuth();

  return (
    <header className="h-14 shrink-0 border-b border-[#2a2a2a] bg-[#0a0a0a] flex items-center justify-between px-6 gap-4">
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-slate-200 leading-tight">{user.sub}</p>
          <p className="text-xs text-slate-500">{roleLabel[user.role] ?? user.role}</p>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
