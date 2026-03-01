import { Suspense, ReactNode } from 'react';
import { SkeletonRow } from './SkeletonRow';

interface AsyncSectionProps {
  children: ReactNode;
  rows?: number;
  cols?: number;
}

export function AsyncSection({ children, rows = 5, cols = 4 }: AsyncSectionProps) {
  return (
    <Suspense fallback={<SkeletonRow rows={rows} cols={cols} />}>
      {children}
    </Suspense>
  );
}
