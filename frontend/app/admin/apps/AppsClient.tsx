'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createApp, listApps, reloadAppsCache, toggleApp } from '@/lib/api/apps';
import { useToast } from '@/components/admin/Toast';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { AdminApp } from '@/types/app';

function normalizeDomain(value: string): string {
  return value.toLowerCase().trim();
}

export default function AppsClient() {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [domain, setDomain] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [redirectInput, setRedirectInput] = useState('');
  const [postLogoutRedirectUris, setPostLogoutRedirectUris] = useState<string[]>([]);

  const appsQuery = useQuery({
    queryKey: ['admin-apps'],
    queryFn: listApps,
  });

  const apps = appsQuery.data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: createApp,
    onSuccess: async () => {
      toast.success('Aplicação criada com sucesso');
      setName('');
      setSlug('');
      setDomain('');
      setBaseUrl('');
      await qc.invalidateQueries({ queryKey: ['admin-apps'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Falha ao criar aplicação');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleApp(id, active),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-apps'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Falha ao atualizar aplicação');
    },
  });

  const reloadMutation = useMutation({
    mutationFn: reloadAppsCache,
    onSuccess: () => toast.success('Cache recarregado com sucesso'),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Falha ao recarregar cache');
    },
  });

  const slugDomainMismatch = useMemo(() => {
    if (!slug || !domain) return false;
    return !normalizeDomain(domain).startsWith(`${slug.toLowerCase().trim()}.`);
  }, [slug, domain]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (slugDomainMismatch) {
      toast.error('Slug deve ser prefixo do domain (ex: erp -> erp.zonadev.tech)');
      return;
    }

    // Validate redirects are https when present
    for (const u of postLogoutRedirectUris) {
      if (!u.startsWith('https://')) {
        toast.error('post_logout_redirect_uris deve usar https://');
        return;
      }
    }

    createMutation.mutate({
      name: name.trim(),
      slug: slug.toLowerCase().trim(),
      domain: normalizeDomain(domain),
      baseUrl: baseUrl.trim() || `https://${normalizeDomain(domain)}`,
      active: true,
      postLogoutRedirectUris,
    });
  }

  function handleAddRedirect(e: React.FormEvent) {
    e.preventDefault();
    const v = redirectInput.trim();
    if (!v) return;
    try {
      const u = new URL(v);
      if (u.protocol !== 'https:') {
        toast.error('Somente https:// permitido para post logout redirects');
        return;
      }
      setPostLogoutRedirectUris((s) => Array.from(new Set([...s, v])));
      setRedirectInput('');
    } catch {
      toast.error('URL inválida');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Aplicações</h1>
          <p className="text-slate-400 text-sm mt-1">Gerencie apps autorizadas para token exchange</p>
        </div>
        <button
          onClick={() => reloadMutation.mutate()}
          disabled={reloadMutation.isPending}
          className="px-4 py-2 rounded-lg border border-indigo-400/40 text-indigo-300 hover:bg-indigo-500/10 text-sm transition-colors disabled:opacity-60"
        >
          {reloadMutation.isPending ? 'Recarregando...' : 'Recarregar Cache'}
        </button>
      </div>

      <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} required className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Domain</label>
          <input value={domain} onChange={(e) => setDomain(e.target.value)} required className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white" />
          {slugDomainMismatch && <p className="text-xs text-yellow-400 mt-1">Slug precisa ser prefixo do domain.</p>}
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Base URL</label>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://app.zonadev.tech" className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-slate-300 mb-1.5">Post-logout redirect URIs</label>
          <div className="flex gap-2">
            <input value={redirectInput} onChange={(e) => setRedirectInput(e.target.value)} placeholder="https://app.zonadev.tech/logout-callback" className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white" />
            <button onClick={handleAddRedirect} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm">Adicionar</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {postLogoutRedirectUris.map((u) => (
              <div key={u} className="inline-flex items-center gap-2 bg-[#121212] border border-[#2a2a2a] rounded-full px-3 py-1 text-xs text-slate-300">
                <span className="font-mono">{u}</span>
                <button type="button" onClick={() => setPostLogoutRedirectUris((s) => s.filter(x => x !== u))} className="text-red-400">✕</button>
              </div>
            ))}
          </div>
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-60"
          >
            {createMutation.isPending ? 'Criando...' : 'Criar Aplicação'}
          </button>
        </div>
      </form>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-[#2a2a2a]">
              <th className="py-2">Domain</th>
              <th className="py-2">Nome</th>
              <th className="py-2">Slug</th>
              <th className="py-2">Status</th>
              <th className="py-2">Atualizado</th>
              <th className="py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app: AdminApp) => (
              <tr key={app.id} className="border-b border-[#2a2a2a]/60">
                <td className="py-2 text-slate-200 font-mono text-xs">{app.domain ?? '-'}</td>
                <td className="py-2 text-slate-200">{app.name}</td>
                <td className="py-2 text-indigo-300">{app.slug}</td>
                <td className="py-2"><StatusBadge status={app.active} /></td>
                <td className="py-2 text-slate-400 text-xs">{app.updatedAt ? new Date(app.updatedAt).toLocaleString('pt-BR') : '-'}</td>
                <td className="py-2">
                  <button
                    onClick={() => toggleMutation.mutate({ id: app.id, active: !app.active })}
                    className="text-xs text-indigo-300 hover:text-indigo-200"
                  >
                    {app.active ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
            {!apps.length && (
              <tr>
                <td className="py-6 text-center text-slate-500" colSpan={6}>Nenhuma aplicação cadastrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
