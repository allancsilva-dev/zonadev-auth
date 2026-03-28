'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listApps } from '@/lib/api/apps';
import { apiFetchJson } from '@/lib/api';
import { useToast } from '@/components/admin/Toast';

export default function UserAppsClient({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const appsQuery = useQuery({ queryKey: ['admin-apps'], queryFn: listApps });
  const [accesses, setAccesses] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiFetchJson<{ data: any[] }>(`/admin/users/${userId}/app-access`);
        if (!mounted) return;
        setAccesses(res.data.map((a) => a.app?.slug));
      } catch (err) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [userId]);

  const toggleMutation = useMutation({
    mutationFn: async ({ appSlug, action, defaultRole }: { appSlug: string; action: 'grant' | 'revoke'; defaultRole?: string }) => {
      return apiFetchJson(`/admin/users/${userId}/app-access`, {
        method: 'POST',
        body: JSON.stringify({ appSlug, action, defaultRole }),
      });
    },
    onSuccess: async (_, vars) => {
      if (vars.action === 'grant') setAccesses((s) => Array.from(new Set([...s, vars.appSlug])));
      else setAccesses((s) => s.filter((x) => x !== vars.appSlug));
      await qc.invalidateQueries({ queryKey: ['admin-apps'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro'),
  });

  const apps = appsQuery.data?.data ?? [];

  return (
    <div className="p-4 bg-[#0b0b0b] rounded-xl">
      <h2 className="text-lg font-semibold mb-4">Aplicações</h2>
      <div className="space-y-2">
        {apps.map((app: any) => {
          const has = accesses.includes(app.slug);
          return (
            <div key={app.id} className="flex items-center justify-between bg-[#121212] p-3 rounded">
              <div>
                <div className="text-sm font-medium">{app.name}</div>
                <div className="text-xs text-slate-400">{app.domain}</div>
              </div>
              <div className="flex items-center gap-2">
                <select defaultValue="viewer" className="bg-transparent border border-[#2a2a2a] rounded px-2 py-1 text-sm text-white">
                  <option value="admin">admin</option>
                  <option value="user">user</option>
                  <option value="viewer">viewer</option>
                </select>
                <button
                  onClick={() => toggleMutation.mutate({ appSlug: app.slug, action: has ? 'revoke' : 'grant' })}
                  className={`px-3 py-1 rounded text-sm ${has ? 'bg-red-600' : 'bg-green-600'}`}
                >
                  {has ? 'Revoke' : 'Grant'}
                </button>
              </div>
            </div>
          );
        })}
        {!apps.length && <div className="text-sm text-slate-500">Nenhuma aplicação cadastrada.</div>}
      </div>
    </div>
  );
}
