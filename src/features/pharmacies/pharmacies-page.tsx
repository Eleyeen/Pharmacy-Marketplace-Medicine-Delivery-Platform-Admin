import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Filter, Plus, Search } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, StatusBadge } from '../../components/ui'
import { adminService } from '../../services/admin-service'
import { getErrorMessage } from '../../services/api'

const verificationFilters = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']

export function PharmaciesPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(searchParams.get('status') ?? '')
  const deferredSearch = useDeferredValue(search)
  const params = useMemo(
    () => ({ page, search: deferredSearch || undefined, status: status || undefined }),
    [deferredSearch, page, status],
  )
  const query = useQuery({
    queryKey: ['pharmacies', params],
    queryFn: () => adminService.getResource('pharmacies', params),
    placeholderData: keepPreviousData,
  })

  const openPharmacy = useCallback((id: string, verification?: string) => {
    if (verification === 'PENDING') navigate(`/pharmacies/${id}/verify`)
    else navigate(`/pharmacies/${id}`)
  }, [navigate])

  return (
    <div className="page">
      <PageHeader
        kicker="Core module"
        title="Pharmacies"
        description="Onboard, verify, and oversee marketplace pharmacy partners."
        actions={<Button onClick={() => navigate('/pharmacies/new')}><Plus size={16} /> Add Pharmacy</Button>}
      />
      <Card className="resource-card">
        <div className="resource-toolbar">
          <label className="resource-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder="Search pharmacies..."
            />
          </label>
          <label className="filter-select">
            <Filter size={16} />
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
              <option value="">All verification statuses</option>
              {verificationFilters.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        {query.isLoading ? <PageSkeleton /> : query.isError ? (
          <ErrorState title="Unable to load pharmacies" message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : !query.data?.data.length ? (
          <EmptyState title="No pharmacies found" message="Try changing your search or filters, or add a pharmacy manually." />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Pharmacy Name</th>
                    <th>Owner</th>
                    <th>Location</th>
                    <th>Verification</th>
                    <th>Rating</th>
                    <th>Total Orders</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.data.map((record) => (
                    <tr key={record.id} className="row-link" onClick={() => openPharmacy(record.id, String(record.verificationStatus ?? ''))}>
                      <td><strong>{record.name ?? '—'}</strong></td>
                      <td>{record.ownerName ?? '—'}</td>
                      <td>{record.city ?? record.address ?? '—'}</td>
                      <td><StatusBadge value={String(record.verificationStatus ?? 'PENDING')} /></td>
                      <td>{record.rating ?? 0}</td>
                      <td>{record.totalOrders ?? 0}</td>
                      <td><StatusBadge value={String(record.status ?? 'PENDING')} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="pagination">
              <span>Page {query.data.meta.page} of {query.data.meta.totalPages} · {query.data.meta.total} results</span>
              <div>
                <Button variant="secondary" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft /></Button>
                <Button variant="secondary" disabled={page >= query.data.meta.totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight /></Button>
              </div>
            </footer>
          </>
        )}
      </Card>
      <p className="page-footnote">Pending rows open the verification workspace. Approved pharmacies open the full detail view. <Link to="/pharmacies?status=PENDING">Jump to pending</Link></p>
    </div>
  )
}
