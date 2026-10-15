import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

export function Card({ className, children }: { className?: string; children: ReactNode }): JSX.Element {
  return (
    <section className={cn('rounded-lg border border-line bg-surface shadow-sm', className)}>{children}</section>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}): JSX.Element {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-ink-3">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-2 border-line',
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  success: 'bg-success-bg text-success border-success/25',
  warning: 'bg-warning-bg text-warning border-warning/25',
  danger: 'bg-danger-bg text-danger border-danger/25',
  info: 'bg-info-bg text-info border-info/25',
};

export function Badge({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
        BADGE_TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: BadgeTone;
}): JSX.Element {
  const toneRing: Record<BadgeTone, string> = {
    neutral: 'bg-surface-2 text-ink-2',
    brand: 'bg-brand-50 text-brand-700',
    success: 'bg-success-bg text-success',
    warning: 'bg-warning-bg text-warning',
    danger: 'bg-danger-bg text-danger',
    info: 'bg-info-bg text-info',
  };
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4 shadow-sm">
      {icon ? (
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', toneRing[tone])}>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</p>
        <p className="tabular mt-1 text-xl font-bold text-ink">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-ink-3">{hint}</p> : null}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  color,
  className,
  label,
}: {
  value: number;
  color?: string;
  className?: string;
  label?: string;
}): JSX.Element {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `Progres ${clamped}%`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${clamped}%`, backgroundColor: color ?? '#2563EB' }}
      />
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }): JSX.Element {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700',
        className,
      )}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}
