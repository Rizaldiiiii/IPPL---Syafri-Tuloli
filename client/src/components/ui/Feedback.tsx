import type { ReactNode } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { Button } from './Button.js';

export function Spinner({ className }: { className?: string }): JSX.Element {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-600', className)} aria-hidden />;
}

export function LoadingBlock({ label = 'Memuat data...' }: { label?: string }): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-ink-2" role="status">
      <Spinner />
      {label}
    </div>
  );
}

export function SkeletonRows({ rows = 6 }: { rows?: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-2 p-4" role="status" aria-label="Memuat data">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-9 animate-pulse rounded bg-surface-2"
          style={{ animationDelay: `${index * 60}ms` }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon ? (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          {icon}
        </span>
      ) : null}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-ink-3">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Gagal memuat data',
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center" role="alert">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-ink-3">{description}</p>
      {onRetry ? (
        <Button className="mt-4" variant="secondary" icon={<RefreshCw className="h-4 w-4" aria-hidden />} onClick={onRetry}>
          Coba lagi
        </Button>
      ) : null}
    </div>
  );
}

export function InlineAlert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  children?: ReactNode;
}): JSX.Element {
  const tones = {
    info: 'border-info/25 bg-info-bg text-info',
    warning: 'border-warning/25 bg-warning-bg text-warning',
    danger: 'border-danger/25 bg-danger-bg text-danger',
    success: 'border-success/25 bg-success-bg text-success',
  } as const;
  return (
    <div className={cn('rounded-md border px-4 py-3', tones[tone])} role={tone === 'danger' ? 'alert' : 'status'}>
      <p className="text-sm font-semibold">{title}</p>
      {children ? <div className="mt-1 text-xs text-ink-2">{children}</div> : null}
    </div>
  );
}
