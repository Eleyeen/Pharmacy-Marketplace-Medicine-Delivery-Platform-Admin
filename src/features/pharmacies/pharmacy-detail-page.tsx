import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowLeft, Ban, Pencil, RotateCcw, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, StatusBadge } from '../../components/ui'
import { adminService } from '../../services/admin-service'
import { getErrorMessage } from '../../services/api'

export function PharmacyDetailPage() {
  const { pharmacyId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const pharmacyQuery = useQuery({
    queryKey: ['pharmacy', pharmacyId],
    queryFn: () => adminService.getPharmacy(pharmacyId),
    enabled: Boolean(pharmacyId),
  })
  const ordersQuery = useQuery({
    queryKey: ['pharmacy-orders', pharmacyId],
    queryFn: () => adminService.getPharmacyOrders(pharmacyId),
    enabled: Boolean(pharmacyId),
  })
  const reviewsQuery = useQuery({
    queryKey: ['pharmacy-reviews', pharmacyId],
    queryFn: () => adminService.getPharmacyReviews(pharmacyId),
    enabled: Boolean(pharmacyId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pharmacy', pharmacyId] })
    queryClient.invalidateQueries({ queryKey: ['pharmacies'] })
  }

  const suspend = useMutation({
    mutationFn: () => {
      const reason = window.prompt('Suspension reason (optional)') ?? undefined
      return adminService.suspendPharmacy(pharmacyId, reason || undefined)
    },
    onSuccess: () => { toast.success('Pharmacy suspended.'); invalidate() },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const reactivate = useMutation({
    mutationFn: () => adminService.reactivatePharmacy(pharmacyId),
    onSuccess: () => { toast.success('Pharmacy reactivated.'); invalidate() },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  if (pharmacyQuery.isLoading) return <PageSkeleton rows={8} />
  if (pharmacyQuery.isError) {
    return <ErrorState title="Pharmacy unavailable" message={getErrorMessage(pharmacyQuery.error)} onRetry={() => pharmacyQuery.refetch()} />
  }
  const pharmacy = pharmacyQuery.data
  if (!pharmacy) return <EmptyState title="Pharmacy not found" message="This pharmacy may have been removed." />

  const isSuspended = pharmacy.verificationStatus === 'SUSPENDED' || pharmacy.status === 'BLOCKED'

  return (
    <div className="page">
      <PageHeader
        kicker="Pharmacy profile"
        title={pharmacy.name}
        description={`${pharmacy.ownerName} · ${pharmacy.city}`}
        actions={
          <div className="header-actions">
            <Button variant="secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</Button>
            {pharmacy.verificationStatus === 'PENDING' && (
              <Link to={`/pharmacies/${pharmacyId}/verify`}><Button><ShieldCheck size={16} /> Verify</Button></Link>
            )}
            <Link to={`/pharmacies/${pharmacyId}/edit`}><Button variant="secondary"><Pencil size={16} /> Edit</Button></Link>
            {isSuspended ? (
              <Button loading={reactivate.isPending} onClick={() => reactivate.mutate()}><RotateCcw size={16} /> Reactivate</Button>
            ) : (
              <Button variant="danger" loading={suspend.isPending} onClick={() => suspend.mutate()}><Ban size={16} /> Suspend</Button>
            )}
          </div>
        }
      />

      <div className="detail-grid">
        <Card className="detail-card">
          <div className="detail-card__title">
            <h2>Profile</h2>
            <div className="badge-row">
              <StatusBadge value={pharmacy.verificationStatus} />
              <StatusBadge value={pharmacy.status} />
            </div>
          </div>
          <dl className="detail-list">
            <div><dt>Owner</dt><dd>{pharmacy.ownerName}</dd></div>
            <div><dt>Phone</dt><dd>{pharmacy.phone}</dd></div>
            <div><dt>Email</dt><dd>{pharmacy.ownerEmail || '—'}</dd></div>
            <div><dt>CNIC / ID</dt><dd>{pharmacy.cnic || '—'}</dd></div>
            <div><dt>License</dt><dd>{pharmacy.licenseNumber || '—'}</dd></div>
            <div><dt>Address</dt><dd>{pharmacy.address}</dd></div>
            <div><dt>Delivery</dt><dd>{pharmacy.deliveryMode?.replaceAll('_', ' ') || (pharmacy.deliveryEnabled ? 'Own rider' : 'Pickup only')}</dd></div>
            <div><dt>Rating</dt><dd>{pharmacy.rating ?? 0} ({pharmacy.reviewCount ?? 0} reviews)</dd></div>
            <div><dt>Total orders</dt><dd>{pharmacy.totalOrders ?? 0}</dd></div>
          </dl>
        </Card>

        <Card className="detail-card">
          <h2>Reviews</h2>
          {reviewsQuery.isLoading ? <PageSkeleton rows={3} /> : !reviewsQuery.data?.length ? (
            <EmptyState title="No reviews yet" message="Customer reviews for this pharmacy will appear here." />
          ) : (
            <ul className="review-list">
              {reviewsQuery.data.map((review) => (
                <li key={review.id}>
                  <strong>{review.rating}★ · {review.userName}</strong>
                  <p>{review.comment || 'No comment'}</p>
                  <StatusBadge value={review.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="detail-card span-all table-card">
          <div className="card-heading"><div><h2>Order history</h2><p>Recent orders fulfilled by this pharmacy</p></div></div>
          {ordersQuery.isLoading ? <PageSkeleton rows={4} /> : !ordersQuery.data?.length ? (
            <EmptyState title="No orders yet" message="Orders assigned to this pharmacy will show here." />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th><th>Payment</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {ordersQuery.data.map((order) => (
                    <tr key={order.id}>
                      <td><Link to={`/orders/${order.id}`}><strong>#{order.id.slice(0, 8)}</strong></Link></td>
                      <td>{order.userName}</td>
                      <td>{new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(order.total)}</td>
                      <td><StatusBadge value={order.status} /></td>
                      <td><StatusBadge value={order.paymentStatus} /></td>
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
