import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowLeft, Phone, RefreshCcw, XCircle } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, StatusBadge } from '../../components/ui'
import { adminService } from '../../services/admin-service'
import { getErrorMessage } from '../../services/api'

export function OrderDetailPage() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => adminService.getOrder(orderId),
    enabled: Boolean(orderId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['order', orderId] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
  }

  const cancel = useMutation({
    mutationFn: () => {
      const reason = window.prompt('Cancellation reason') ?? ''
      if (reason.trim().length < 3) throw new Error('Provide a short cancellation reason.')
      return adminService.cancelOrder(orderId, reason.trim())
    },
    onSuccess: () => { toast.success('Order cancelled.'); invalidate() },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const refund = useMutation({
    mutationFn: () => {
      const reason = window.prompt('Refund reason') ?? ''
      if (reason.trim().length < 3) throw new Error('Provide a short refund reason.')
      return adminService.refundOrder(orderId, reason.trim())
    },
    onSuccess: () => { toast.success('Order marked refunded.'); invalidate() },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  if (query.isLoading) return <PageSkeleton rows={8} />
  if (query.isError) {
    return <ErrorState title="Order unavailable" message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
  }
  const order = query.data
  if (!order) return <EmptyState title="Order not found" message="This order may have been removed." />

  const canCancel = !['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(order.status)
  const canRefund = order.status !== 'REFUNDED'

  return (
    <div className="page">
      <PageHeader
        kicker="Order detail"
        title={`Order #${order.id.slice(0, 10)}`}
        description="Support override tools for exceptional cases only."
        actions={
          <div className="header-actions">
            <Button variant="secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</Button>
            {canCancel && (
              <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>
                <XCircle size={16} /> Cancel Order
              </Button>
            )}
            {canRefund && (
              <Button variant="secondary" loading={refund.isPending} onClick={() => refund.mutate()}>
                <RefreshCcw size={16} /> Mark Refunded
              </Button>
            )}
          </div>
        }
      />

      <div className="detail-grid">
        <Card className="detail-card">
          <div className="detail-card__title">
            <h2>Summary</h2>
            <div className="badge-row">
              <StatusBadge value={order.status} />
              <StatusBadge value={order.paymentStatus} />
            </div>
          </div>
          <dl className="detail-list">
            <div><dt>Created</dt><dd>{format(new Date(order.createdAt), 'PPpp')}</dd></div>
            <div><dt>Delivery</dt><dd>{order.deliveryType ?? '—'}</dd></div>
            <div><dt>Subtotal</dt><dd>{order.subtotal != null ? new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(order.subtotal) : '—'}</dd></div>
            <div><dt>Delivery fee</dt><dd>{order.deliveryFee != null ? new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(order.deliveryFee) : '—'}</dd></div>
            <div><dt>Total</dt><dd>{new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(order.total)}</dd></div>
          </dl>
        </Card>

        <Card className="detail-card">
          <h2>Contacts</h2>
          <div className="contact-blocks">
            <div>
              <strong>User</strong>
              <p>{order.userName}</p>
              <p>{order.userPhone || order.userEmail || 'No contact on order'}</p>
              {order.userId && <Link to={`/users/${order.userId}`}>View user</Link>}
              {order.userPhone && <a href={`tel:${order.userPhone}`}><Phone size={14} /> Call user</a>}
            </div>
            <div>
              <strong>Pharmacy</strong>
              <p>{order.pharmacyName || 'Not assigned yet'}</p>
              <p>{order.pharmacyPhone || '—'}</p>
              {order.pharmacyId && <Link to={`/pharmacies/${order.pharmacyId}`}>View pharmacy</Link>}
              {order.pharmacyPhone && <a href={`tel:${order.pharmacyPhone}`}><Phone size={14} /> Call pharmacy</a>}
            </div>
          </div>
        </Card>

        <Card className="detail-card">
          <h2>Items</h2>
          {!order.items.length ? (
            <EmptyState title="No line items" message="Item breakdown was not stored on this order." />
          ) : (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Medicine</th><th>Qty</th><th>Unit</th><th>Line</th></tr></thead>
                <tbody>
                  {order.items.map((item, index) => (
                    <tr key={`${item.medicineId}-${index}`}>
                      <td>{item.medicineName || item.medicineId}</td>
                      <td>{item.quantity}</td>
                      <td>{item.unitPrice != null ? new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(item.unitPrice) : '—'}</td>
                      <td>{item.lineTotal != null ? new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(item.lineTotal) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="detail-card">
          <h2>Status timeline</h2>
          {!order.statusHistory?.length ? (
            <div className="timeline">
              <div className="timeline__item">
                <StatusBadge value={order.status} />
                <span>{format(new Date(order.createdAt), 'PPpp')}</span>
              </div>
            </div>
          ) : (
            <ol className="timeline">
              {order.statusHistory.map((event, index) => (
                <li className="timeline__item" key={`${event.status}-${index}`}>
                  <StatusBadge value={event.status} />
                  <span>{event.at ? format(new Date(event.at), 'PPpp') : '—'}</span>
                  {event.note && <small>{event.note}</small>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  )
}
