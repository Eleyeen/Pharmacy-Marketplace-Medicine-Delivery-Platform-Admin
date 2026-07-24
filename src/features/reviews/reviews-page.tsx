import { useDeferredValue, useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, EyeOff, Filter, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, StatusBadge } from '../../components/ui'
import { adminService } from '../../services/admin-service'
import { getErrorMessage } from '../../services/api'

export function ReviewsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const deferredSearch = useDeferredValue(search)
  const queryClient = useQueryClient()
  const params = useMemo(
    () => ({ page, search: deferredSearch || undefined, status: status || undefined }),
    [deferredSearch, page, status],
  )

  const query = useQuery({
    queryKey: ['reviews', params],
    queryFn: () => adminService.getResource('reviews', params),
    placeholderData: keepPreviousData,
  })

  const hideMutation = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => {
      const reason = hidden ? (window.prompt('Moderation reason (optional)') ?? undefined) : undefined
      return adminService.hideReview(id, hidden, reason || undefined)
    },
    onSuccess: (_, variables) => {
      toast.success(variables.hidden ? 'Review hidden.' : 'Review restored.')
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <div className="page">
      <PageHeader
        kicker="Trust & safety"
        title="Reviews"
        description="View customer feedback and hide abusive or inappropriate reviews."
      />
      <Card className="resource-card">
        <div className="resource-toolbar">
          <label className="resource-search">
            <Search size={17} />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search reviews..." />
          </label>
          <label className="filter-select">
            <Filter size={16} />
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
              <option value="">All statuses</option>
              <option value="VISIBLE">VISIBLE</option>
              <option value="HIDDEN">HIDDEN</option>
              <option value="FLAGGED">FLAGGED</option>
            </select>
          </label>
        </div>
        {query.isLoading ? <PageSkeleton /> : query.isError ? (
          <ErrorState title="Unable to load reviews" message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : !query.data?.data.length ? (
          <EmptyState title="No reviews found" message="Customer reviews will appear here once orders are completed." />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Pharmacy</th>
                    <th>Rating</th>
                    <th>Review</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {query.data.data.map((record) => {
                    const hidden = String(record.status) === 'HIDDEN'
                    return (
                      <tr key={record.id}>
                        <td>{record.userName ?? '—'}</td>
                        <td>{record.pharmacyName ?? '—'}</td>
                        <td>{record.rating ?? '—'}</td>
                        <td>{record.comment ?? record.text ?? '—'}</td>
                        <td><StatusBadge value={String(record.status ?? 'VISIBLE')} /></td>
                        <td>{record.createdAt ? format(new Date(String(record.createdAt)), 'MMM d, yyyy') : '—'}</td>
                        <td>
                          <Button
                            variant={hidden ? 'secondary' : 'danger'}
                            loading={hideMutation.isPending}
                            onClick={() => hideMutation.mutate({ id: record.id, hidden: !hidden })}
                          >
                            <EyeOff size={14} /> {hidden ? 'Restore' : 'Hide'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
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
