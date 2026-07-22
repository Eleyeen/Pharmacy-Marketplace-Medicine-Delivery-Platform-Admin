import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  ArrowRight, CheckCircle2, CircleDollarSign, ClipboardList, Clock3,
  Download, ShieldAlert, Store, Users, XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Button, Card, EmptyState, ErrorState, MetricCard, PageSkeleton, StatusBadge } from '../../components/ui'
import { adminService } from '../../services/admin-service'
import { getErrorMessage } from '../../services/api'
import type { Metric } from '../../types'

const metricIcons = [Users, Store, ClipboardList, CircleDollarSign, CheckCircle2, Clock3]
const tones = ['blue', 'purple', 'orange', 'mint', 'green', 'rose']

const formatMetric = (metric: Metric) =>
  metric.format === 'currency'
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(metric.value)
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
        <div><span className="page-kicker">{today}</span><h1>Good day, here’s your overview.</h1><p>Monitor marketplace health and take action where it matters.</p></div>
        <Button variant="secondary" onClick={() => window.print()}><Download size={17} /> Export report</Button>
      </header>

      <section className="metrics-grid">
        {data.metrics.map((metric, index) => {
          const Icon = metricIcons[index % metricIcons.length]
          return <MetricCard key={metric.label} label={metric.label} value={formatMetric(metric)} change={metric.change} icon={<Icon />} tone={tones[index % tones.length]} />
        })}
      </section>

      <section className="dashboard-grid">
        <Card className="chart-card">
          <div className="card-heading">
            <div><h2>Order performance</h2><p>Orders and revenue over time</p></div>
            <span className="live-pill"><i /> Live data</span>
          </div>
          {data.performance.length ? (
            <ResponsiveContainer width="100%" height={290}>
              <AreaChart data={data.performance} margin={{ top: 18, right: 10, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="orderFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0a9b76" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#0a9b76" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e8eeeb" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#82908a', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#82908a', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #dfe8e3' }} />
                <Area type="monotone" dataKey="orders" stroke="#078667" strokeWidth={2.5} fill="url(#orderFill)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No chart data" message="Performance will be plotted after orders are created." />}
        </Card>

        <Card className="attention-card">
          <div className="card-heading"><div><h2>Needs attention</h2><p>Items requiring review</p></div></div>
          {data.metrics.filter((metric) => /pending|cancel/i.test(metric.label)).map((metric) => {
            const isCancellation = /cancel/i.test(metric.label)
            const AttentionIcon = isCancellation ? XCircle : ShieldAlert
            return (
              <Link to={isCancellation ? '/orders?status=CANCELLED' : '/pharmacies?status=PENDING'} className="attention-item" key={metric.label}>
                <span className={`attention-item__icon metric-card__icon--${isCancellation ? 'rose' : 'orange'}`}><AttentionIcon /></span>
                <span><strong>{metric.value} {metric.label}</strong><small>Review and take action</small></span>
                <ArrowRight size={17} />
              </Link>
            )
          })}
        </Card>
      </section>

      <Card className="table-card">
        <div className="card-heading"><div><h2>Recent orders</h2><p>Latest activity across the marketplace</p></div><Link to="/orders">View all <ArrowRight size={15} /></Link></div>
        {data.recentOrders.length ? (
          <div className="table-scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Pharmacy</th><th>Amount</th><th>Status</th><th>Payment</th><th>Created</th></tr></thead>
            <tbody>{data.recentOrders.map((order) => <tr key={order.id}><td><strong>#{order.id}</strong></td><td>{order.userName}</td><td>{order.pharmacyName ?? 'Searching'}</td><td>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(order.amount)}</td><td><StatusBadge value={order.status} /></td><td><StatusBadge value={order.paymentStatus} /></td><td>{format(new Date(order.createdAt), 'MMM d, h:mm a')}</td></tr>)}</tbody>
          </table></div>
        ) : <EmptyState title="No recent orders" message="New orders will appear here in real time." />}
      </Card>
    </div>
  )
}
