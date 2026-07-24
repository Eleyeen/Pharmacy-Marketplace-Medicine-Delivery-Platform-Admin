import { useDeferredValue, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, StatusBadge } from '../../components/ui'
import { adminService } from '../../services/admin-service'
import { getErrorMessage } from '../../services/api'

export function UsersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const deferredSearch = useDeferredValue(search)
  const params = useMemo(
    () => ({ page, search: deferredSearch || undefined, status: status || undefined }),
    [deferredSearch, page, status],
  )
  const query = useQuery({
    queryKey: ['users', params],
    queryFn: () => adminService.getResource('users', params),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="page">
      <PageHeader
        kicker="Basic view"
        title="Users"
        description="Customer accounts — view activity and block abusive access."
      />
      <Card className="resource-card">
        <div className="resource-toolbar">
          <label className="resource-search">
            <Search size={17} />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search users..." />
          </label>
          <label className="filter-select">
            <Filter size={16} />
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
              <option value="">All statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="BLOCKED">BLOCKED</option>
            </select>
          </label>
        </div>
        {query.isLoading ? <PageSkeleton /> : query.isError ? (
          <ErrorState title="Unable to load users" message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : !query.data?.data.length ? (
          <EmptyState title="No users found" message="Try changing your search or filters." />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Total Orders</th>
                    <th>Status</th>
                    <th>Registration Date</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.data.map((record) => (
                    <tr key={record.id}>
                      <td><Link to={`/users/${record.id}`}><strong>{record.name ?? '—'}</strong></Link></td>
                      <td>{record.email ?? '—'}</td>
                      <td>{record.phone ?? '—'}</td>
                      <td>{record.totalOrders ?? 0}</td>
                      <td><StatusBadge value={String(record.status ?? 'ACTIVE')} /></td>
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
