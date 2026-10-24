import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Accordion Velzon-style: hairline antar butir, judul 14px semibold, isi lega. */
export function Accordion({
  items,
  defaultOpen,
  className,
}: {
  readonly items: readonly { readonly title: string; readonly content: React.ReactNode }[];
  readonly defaultOpen?: number;
  readonly className?: string;
}) {
  const [open, setOpen] = React.useState<number | null>(defaultOpen ?? null);

  return (
    <div className={cn('divide-y', className)} style={{ borderColor: 'var(--sica-divider)' }}>
      {items.map((item, index) => {
        const expanded = open === index;
        return (
          <section key={item.title}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : index)}
              className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:text-primary-hover"
            >
              <span className="text-sm font-semibold text-[color:var(--sica-text-heading)]">{item.title}</span>
              <ChevronDown
                size={16}
                strokeWidth={2}
                aria-hidden
                className={cn('shrink-0 text-[color:var(--sica-text-muted)] transition-transform duration-200', expanded && 'rotate-180')}
              />
            </button>
            {expanded ? (
              <div className="pb-4 text-[13.5px] leading-relaxed text-[color:var(--sica-text-body)]">{item.content}</div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
