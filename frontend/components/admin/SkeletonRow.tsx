interface SkeletonRowProps {
  rows?: number;
  cols?: number;
}

export function SkeletonRow({ rows = 5, cols = 4 }: SkeletonRowProps) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((__, j) => (
            <div
              key={j}
              className="h-8 bg-slate-700 rounded flex-1"
              style={{ opacity: 1 - j * 0.1 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
