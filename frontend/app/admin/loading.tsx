import { SkeletonRow } from '@/components/admin/SkeletonRow';

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-slate-700 rounded animate-pulse" />
      <SkeletonRow rows={6} cols={4} />
    </div>
  );
}
