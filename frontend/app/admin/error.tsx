'use client'; // error.tsx é sempre Client Component no Next

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Visível em: docker logs zonadev-auth-frontend-1
  console.error('[AdminError]', error);

  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-red-400 text-lg font-medium">Algo deu errado no painel.</p>
      <p className="text-slate-500 text-sm font-mono">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  );
}
