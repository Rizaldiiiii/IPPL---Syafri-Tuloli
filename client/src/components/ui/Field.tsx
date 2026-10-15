import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn.js';

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

function FieldShell({ id, label, hint, error, required, className, children }: FieldShellProps): JSX.Element {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-2">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL_BASE =
  'w-full rounded border bg-surface px-3 text-sm text-ink transition placeholder:text-ink-3 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, containerClassName, className, required, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FieldShell
      id={inputId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
    >
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          CONTROL_BASE,
          'h-10',
          error ? 'border-danger' : 'border-line-strong focus:border-brand-600',
          className,
        )}
        {...rest}
      />
    </FieldShell>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, containerClassName, className, required, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  return (
    <FieldShell
      id={textareaId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
    >
      <textarea
        ref={ref}
        id={textareaId}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${textareaId}-error` : undefined}
        className={cn(
          CONTROL_BASE,
          'min-h-[80px] resize-y py-2',
          error ? 'border-danger' : 'border-line-strong focus:border-brand-600',
          className,
        )}
        {...rest}
      />
    </FieldShell>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, containerClassName, className, required, id, children, ...rest },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <FieldShell
      id={selectId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
    >
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        className={cn(
          CONTROL_BASE,
          'h-10 pr-8',
          error ? 'border-danger' : 'border-line-strong focus:border-brand-600',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
});

export interface CheckboxRowProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

export const CheckboxRow = forwardRef<HTMLInputElement, CheckboxRowProps>(function CheckboxRow(
  { label, description, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input
        ref={ref}
        id={checkboxId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-line-strong text-brand-600 accent-brand-600"
        {...rest}
      />
      <div className="min-w-0">
        <label htmlFor={checkboxId} className="text-sm font-medium text-ink">
          {label}
        </label>
        {description ? <p className="text-xs text-ink-3">{description}</p> : null}
      </div>
    </div>
  );
});
