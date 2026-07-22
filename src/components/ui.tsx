import { memo, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AlertCircle, ArrowUpRight, LoaderCircle, PackageOpen } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  loading?: boolean
}

export const Button = memo(function Button({
  className,
  variant = 'primary',
  loading,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={twMerge('button', `button--${variant}`, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  )
})

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase().replaceAll('_', '-')
  return <span className={`badge badge--${normalized}`}>{value.replaceAll('_', ' ')}</span>
}

interface StateProps {
  title: string
  message: string
  onRetry?: () => void
}

export function ErrorState({ title, message, onRetry }: StateProps) {
  return (
    <div className="page-state" role="alert">
      <span className="page-state__icon page-state__icon--error"><AlertCircle /></span>
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export function EmptyState({ title, message }: StateProps) {
  return (
    <div className="page-state">
      <span className="page-state__icon"><PackageOpen /></span>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  )
}

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-stack" aria-label="Loading content">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton" key={index} style={{ animationDelay: `${index * 80}ms` }} />
      ))}
    </div>
  )
}

interface MetricCardProps {
  label: string
  value: string
  change: number
  icon: ReactNode
  tone?: string
}

export const MetricCard = memo(function MetricCard({
  label,
  value,
  change,
  icon,
  tone = 'mint',
}: MetricCardProps) {
  return (
    <Card className="metric-card">
      <div className={`metric-card__icon metric-card__icon--${tone}`}>{icon}</div>
      <span className="metric-card__label">{label}</span>
      <strong>{value}</strong>
      <span className={change >= 0 ? 'trend trend--up' : 'trend trend--down'}>
        <ArrowUpRight size={14} /> {Math.abs(change)}%
        <small> vs last month</small>
      </span>
    </Card>
  )
})
