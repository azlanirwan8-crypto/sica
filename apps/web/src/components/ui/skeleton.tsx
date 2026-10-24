import * as React from 'react';
import { cn } from '@/lib/utils';

/** Skeleton shimmer Velzon — pengganti spinner biasa. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} aria-hidden {...props} />;
}

export function SkeletonText({ lines = 3, className }: { readonly lines?: number; readonly className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { readonly className?: string }) {
  return (
    <div className={cn('card', className)}>
      <div className="card-header">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
      <div className="card-body flex flex-col gap-3">
        <Skeleton className="h-24 w-full rounded-lg" />
        <SkeletonText lines={2} />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 4 }: { readonly rows?: number; readonly cols?: number }) {
  return (
    <div className="flex flex-col">
      <div className="table-head flex items-center gap-4 px-4 py-3">
        {Array.from({ length: cols }).map((_, index) => (
          <Skeleton key={index} className="h-2.5 w-20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 border-b border-[color:var(--sica-divider)] px-4 py-3.5">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className={cn('h-3', colIndex === 0 ? 'w-40' : colIndex === cols - 1 ? 'w-16' : 'w-24')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { readonly count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card">
          <div className="card-body flex flex-col gap-3">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
