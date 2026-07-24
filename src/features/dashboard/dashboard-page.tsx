import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Activity, ArrowRight, ClipboardList, Clock3, Store,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Card, EmptyState, ErrorState, MetricCard, PageSkeleton, StatusBadge,
} from '../../components/ui'
import { adminService } from '../../services/admin-service'
import { getErrorMessage } from '../../services/api'
import type { Metric } from '../../types'

const metricIcons = [Store, Clock3, Store, ClipboardList, ClipboardList, Activity]
const tones = ['blue', 'orange', 'mint', 'purple', 'green', 'rose']

const formatMetric = (metric: Metric) =>
  metric.format === 'currency'
    ? new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', notation: 'compact' }).format(metric.value)
    : new Intl.NumberFormat('en-US', { notation: 'compact' }).format(metric.value)

export function DashboardPage() {
  const query = useQuery({ queryKey: ['admin-dashboard'], queryFn: adminService.getDashboard })
  const today = useMemo(() => format(new Date(), 'EEEE, MMMM d'), [])

  if (query.isLoading) return <PageSkeleton rows={8} />
  if (query.isError) {
    return <ErrorState title="Dashboard unavailable" message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
  }

  const data = query.data
  if (!data) return <EmptyState title="No dashboard data" message="Metrics will appear once marketplace activity begins." />

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="page-kicker">{today}</span>
          <h1>Marketplace pulse</h1>
          <p>Lightweight KPIs for pharmacy onboarding and live order monitoring.</p>
        </div>
      </header>

      <section className="metrics-grid metrics-grid--six">
        {data.metrics.map((metric, index) => {
          const Icon = metricIcons[index % metricIcons.length]
          return (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={formatMetric(metric)}
              hint={metric.hint}
              icon={<Icon />}
              tone={tones[index % tones.length]}
            />
          )
        })}
      </section>

      <Card className="table-card">
        <div className="card-heading">
          <div><h2>Recent orders</h2><p>Read-only monitoring — manage from the Orders module</p></div>
          <Link to="/orders">View all <ArrowRight size={15} /></Link>
        </div>
        {data.recentOrders.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>User</th>
                  <th>Pharmacy</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td><Link to={`/orders/${order.id}`}><strong>#{order.id.slice(0, 8)}</strong></Link></td>
                    <td>{order.userName}</td>
                    <td>{order.pharmacyName ?? 'Searching'}</td>
                    <td>{new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(order.amount)}</td>
                    <td><StatusBadge value={order.status} /></td>
                    <td><StatusBadge value={order.paymentStatus} /></td>
                    <td>{format(new Date(order.createdAt), 'MMM d, h:mm a')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No recent orders" message="New orders will appear here as customers place them." />
        )}
      </Card>
    </div>
  )
}
