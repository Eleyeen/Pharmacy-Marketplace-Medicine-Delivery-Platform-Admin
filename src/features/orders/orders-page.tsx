import { useDeferredValue, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, StatusBadge } from '../../components/ui'
import { adminService } from '../../services/admin-service'
import { getErrorMessage } from '../../services/api'
import { ORDER_STATUS_FILTERS } from '../../types'

export function OrdersPage() {
  const [searchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState(searchParams.get('status') ?? '')
  const deferredSearch = useDeferredValue(search)

  const params = useMemo(
    () => ({ page, search: deferredSearch || undefined, status: filter || undefined }),
    [deferredSearch, filter, page],
  )

  const query = useQuery({
    queryKey: ['orders', params],
    queryFn: () => adminService.getResource('orders', params),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="page">
      <PageHeader
        kicker="Monitoring only"
        title="Orders"
        description="Track marketplace orders. Cancel and refund are support overrides — not day-to-day ops."
      />
      <Card className="resource-card">
        <div className="resource-toolbar">
          <label className="resource-search">
            <Search size={17} />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search orders..." />
          </label>
          <label className="filter-select">
            <Filter size={16} />
            <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1) }}>
              <option value="">All statuses</option>
              {ORDER_STATUS_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>
        {query.isLoading ? <PageSkeleton /> : query.isError ? (
          <ErrorState title="Unable to load orders" message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : !query.data?.data.length ? (
          <EmptyState title="No orders found" message="Try changing your search or filters." />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>User</th>
                    <th>Pharmacy</th>
                    <th>Amount</th>
                    <th>Payment Status</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.data.map((record) => (
                    <tr key={record.id}>
                      <td><Link to={`/orders/${record.id}`}><strong>#{String(record.id).slice(0, 8)}</strong></Link></td>
                      <td>{record.userName ?? '—'}</td>
                      <td>{record.pharmacyName ?? 'Searching'}</td>
                      <td>{new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(Number(record.total ?? record.amount ?? 0))}</td>
                      <td><StatusBadge value={String(record.paymentStatus ?? 'PENDING')} /></td>
                      <td><StatusBadge value={String(record.status ?? 'PENDING')} /></td>
                      <td>{record.createdAt ? format(new Date(String(record.createdAt)), 'MMM d, yyyy') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="pagination">
              <span>Page {query.data.meta.page} of {query.data.meta.totalPages} · {query.data.meta.total} results</span>
              <div>
                <Button variant="secondary" disabled={page === 1} onClick={() => setPage((v) => v - 1)}><ChevronLeft /></Button>
                <Button variant="secondary" disabled={page >= query.data.meta.totalPages} onClick={() => setPage((v) => v + 1)}><ChevronRight /></Button>
              </div>
            </footer>
          </>
        )}
      </Card>
    </div>
  )
}
