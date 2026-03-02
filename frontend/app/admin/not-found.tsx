import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
      <p className="text-6xl font-bold text-[#2a2a2a]">404</p>
      <h1 className="text-xl font-semibold text-slate-200">Página não encontrada</h1>
      <p className="text-slate-500 text-sm max-w-sm">
        A página que você está a tentar aceder não existe ou foi movida.
      </p>
      <Link
        href="/admin"
        className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
