import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowLeft, Ban, RotateCcw } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, StatusBadge } from '../../components/ui'
import { adminService } from '../../services/admin-service'
import { getErrorMessage } from '../../services/api'

export function UserDetailPage() {
  const { userId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const userQuery = useQuery({
    queryKey: ['user', userId],
    queryFn: () => adminService.getUser(userId),
    enabled: Boolean(userId),
  })
  const ordersQuery = useQuery({
    queryKey: ['user-orders', userId],
    queryFn: () => adminService.getUserOrders(userId),
    enabled: Boolean(userId),
  })

  const block = useMutation({
    mutationFn: (blocked: boolean) => {
      const reason = blocked ? (window.prompt('Block reason (optional)') ?? undefined) : undefined
      return adminService.blockUser(userId, blocked, reason || undefined)
    },
    onSuccess: (_, blocked) => {
      toast.success(blocked ? 'User blocked.' : 'User unblocked.')
      queryClient.invalidateQueries({ queryKey: ['user', userId] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  if (userQuery.isLoading) return <PageSkeleton rows={8} />
  if (userQuery.isError) {
    return <ErrorState title="User unavailable" message={getErrorMessage(userQuery.error)} onRetry={() => userQuery.refetch()} />
  }
  const user = userQuery.data
  if (!user) return <EmptyState title="User not found" message="This account may have been removed." />

  const isBlocked = user.status === 'BLOCKED'

  return (
    <div className="page">
      <PageHeader
        kicker="User detail"
        title={user.name || 'Customer'}
        description={user.email}
        actions={
          <div className="header-actions">
            <Button variant="secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</Button>
            {isBlocked ? (
              <Button loading={block.isPending} onClick={() => block.mutate(false)}><RotateCcw size={16} /> Unblock</Button>
            ) : (
              <Button variant="danger" loading={block.isPending} onClick={() => block.mutate(true)}><Ban size={16} /> Block</Button>
            )}
          </div>
        }
      />

      <div className="detail-grid">
        <Card className="detail-card">
          <div className="detail-card__title">
            <h2>Profile</h2>
            <StatusBadge value={user.status} />
          </div>
          <dl className="detail-list">
            <div><dt>Email</dt><dd>{user.email || '—'}</dd></div>
            <div><dt>Phone</dt><dd>{user.phone || '—'}</dd></div>
            <div><dt>Total orders</dt><dd>{user.totalOrders ?? 0}</dd></div>
            <div><dt>Registered</dt><dd>{user.createdAt ? format(new Date(user.createdAt), 'PP') : '—'}</dd></div>
          </dl>
        </Card>

        <Card className="detail-card">
          <h2>Addresses</h2>
          {!user.addresses?.length ? (
            <EmptyState title="No addresses" message="Saved delivery addresses will appear here." />
          ) : (
            <ul className="address-list">
              {user.addresses.map((address) => (
                <li key={address.id}>
                  <strong>{address.label || 'Address'}</strong>
                  <span>{address.line1}{address.city ? `, ${address.city}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="detail-card span-all table-card">
          <div className="card-heading"><div><h2>Orders</h2><p>Recent orders by this customer</p></div></div>
          {ordersQuery.isLoading ? <PageSkeleton rows={4} /> : !ordersQuery.data?.length ? (
            <EmptyState title="No orders" message="This customer has not placed an order yet." />
          ) : (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Order</th><th>Pharmacy</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {ordersQuery.data.map((order) => (
                    <tr key={order.id}>
                      <td><Link to={`/orders/${order.id}`}><strong>#{order.id.slice(0, 8)}</strong></Link></td>
                      <td>{order.pharmacyName ?? 'Searching'}</td>
                      <td>{new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(order.total)}</td>
                      <td><StatusBadge value={order.status} /></td>
                      <td>{format(new Date(order.createdAt), 'MMM d, yyyy')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
