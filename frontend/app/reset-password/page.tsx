'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function ResetPasswordPage() {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [token, setToken]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') ?? '';
    setToken(t);
    if (!t) setError('Link inválido. Solicite um novo link de recuperação.');
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres');
      return;
    }

    if (password !== confirm) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      });

      if (res.status === 400) {
        setError('Link expirado ou inválido. Solicite um novo link de recuperação.');
        return;
      }

      if (!res.ok) {
        setError('Erro ao redefinir senha. Tente novamente.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ZonaDev Auth</h1>
          <p className="text-zinc-400 text-sm mt-1">Nova senha</p>
        </div>

        <div className="bg-[#141414] border border-white/[0.08] rounded-2xl p-6 shadow-xl">
          {success ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-4">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-white font-semibold mb-2">Senha redefinida!</h2>
              <p className="text-zinc-400 text-sm mb-5">
                Sua senha foi alterada com sucesso. Todas as sessões anteriores foram encerradas.
              </p>
              <Link
                href="/login"
                className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors"
              >
                Fazer login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white mb-2">Criar nova senha</h2>
              <p className="text-zinc-400 text-sm mb-6">
                Escolha uma senha segura com no mínimo 8 caracteres.
              </p>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Nova senha
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full bg-[#1e1e1e] border border-white/[0.08] text-white placeholder-zinc-600 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Confirmar nova senha
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full bg-[#1e1e1e] border border-white/[0.08] text-white placeholder-zinc-600 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-3">
                    <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !password || !confirm || !token}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Redefinindo...
                    </>
                  ) : 'Redefinir senha'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
