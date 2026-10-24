import * as React from 'react';
import { cn } from '@/lib/utils';

export type AvatarSize = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Inisial aman: huruf pertama tiap kata, maks 2, tanpa emoji. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '–';
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  return `${(parts[0] ?? '').charAt(0)}${(parts[1] ?? '').charAt(0)}`.toUpperCase();
}

export function Avatar({
  name,
  src,
  size = 'md',
  status,
  className,
  rounded = 'md',
}: {
  readonly name: string;
  readonly src?: string | null;
  readonly size?: AvatarSize;
  readonly status?: 'online' | 'away' | 'busy' | undefined;
  readonly className?: string;
  readonly rounded?: 'md' | 'full';
}) {
  return (
    <span
      className={cn('avatar', `avatar-${size}`, rounded === 'full' && 'rounded-full', className)}
      title={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} loading="lazy" />
      ) : (
        <span className={cn('avatar-title', rounded === 'full' && 'rounded-full')}>
          {initials(name)}
        </span>
      )}
      {status ? <span className={cn('status-dot', `status-dot-${status}`)} aria-hidden /> : null}
    </span>
  );
}

export function AvatarGroup({
  people,
  max = 4,
  size = 'sm',
  className,
}: {
  readonly people: readonly { readonly name: string; readonly src?: string | null }[];
  readonly max?: number;
  readonly size?: AvatarSize;
  readonly className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <span className={cn('flex items-center -space-x-2', className)}>
      {shown.map((person, index) => (
        <span key={`${person.name}-${index}`} className="ring-2 rounded-md" style={{ boxShadow: '0 0 0 2px var(--sica-surface-card)' }}>
          <Avatar name={person.name} src={person.src} size={size} rounded="full" />
        </span>
      ))}
      {rest > 0 ? (
        <span
          className={cn('avatar rounded-full', `avatar-${size}`)}
          style={{ boxShadow: '0 0 0 2px var(--sica-surface-card)', background: 'var(--sica-surface-inset)' }}
        >
          <span className="avatar-title rounded-full">+{rest}</span>
        </span>
      ) : null}
    </span>
  );
}
