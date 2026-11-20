import { cn } from '@/lib/utils'

export function Progress({ value, className, indeterminate }: { value: number; className?: string; indeterminate?: boolean }): JSX.Element {
  return (
    <div className={cn('relative h-2.5 w-full overflow-hidden rounded-full bg-muted', className)} role="progressbar" aria-valuenow={Math.round(value)}>
      <div className={cn('h-full rounded-full bg-brand transition-[width] duration-300', indeterminate && 'w-1/3 animate-pulse')} style={indeterminate ? undefined : { width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}
