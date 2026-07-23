import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Filter, MoreHorizontal, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, EmptyState, ErrorState, PageSkeleton, StatusBadge } from '../../components/ui'
import { adminService } from '../../services/admin-service'
import { getErrorMessage } from '../../services/api'
import type { AdminListRecord } from '../../types'
import {
  CreateResourceModal,
  type CreatableResource,
} from './create-resource-modal'

interface Column {
  key: string
  label: string
  format?: 'status' | 'currency' | 'date'
}

interface ResourceConfig {
  resource: string
  title: string
  description: string
  singular: string
  columns: Column[]
  statuses: string[]
  action?: { label: string; nextStatus: string }
}

const configs: Record<string, ResourceConfig> = {
  users: { resource: 'users', title: 'Users', description: 'Manage customer access and marketplace activity.', singular: 'user', statuses: ['ACTIVE', 'BLOCKED'], action: { label: 'Block', nextStatus: 'BLOCKED' }, columns: [{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'totalOrders', label: 'Orders' }, { key: 'status', label: 'Status', format: 'status' }, { key: 'createdAt', label: 'Registered', format: 'date' }] },
  pharmacies: { resource: 'pharmacies', title: 'Pharmacies', description: 'Verify and oversee marketplace pharmacy partners.', singular: 'pharmacy', statuses: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'], action: { label: 'Approve', nextStatus: 'APPROVED' }, columns: [{ key: 'name', label: 'Pharmacy' }, { key: 'ownerName', label: 'Owner' }, { key: 'city', label: 'Location' }, { key: 'verificationStatus', label: 'Verification', format: 'status' }, { key: 'rating', label: 'Rating' }, { key: 'totalOrders', label: 'Orders' }, { key: 'status', label: 'Status', format: 'status' }] },
  orders: { resource: 'orders', title: 'Orders', description: 'Track, investigate, and manage every marketplace order.', singular: 'order', statuses: ['PENDING', 'SEARCHING_PHARMACY', 'PHARMACY_CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED'], action: { label: 'Cancel', nextStatus: 'CANCELLED' }, columns: [{ key: 'id', label: 'Order' }, { key: 'userName', label: 'Customer' }, { key: 'pharmacyName', label: 'Pharmacy' }, { key: 'amount', label: 'Amount', format: 'currency' }, { key: 'paymentStatus', label: 'Payment', format: 'status' }, { key: 'status', label: 'Status', format: 'status' }, { key: 'createdAt', label: 'Date', format: 'date' }] },
  medicines: { resource: 'medicines', title: 'Medicines', description: 'Maintain the canonical medicine and category catalogue.', singular: 'medicine', statuses: ['ACTIVE', 'INACTIVE', 'PRESCRIPTION_REQUIRED'], action: { label: 'Deactivate', nextStatus: 'INACTIVE' }, columns: [{ key: 'name', label: 'Medicine' }, { key: 'genericName', label: 'Generic name' }, { key: 'brand', label: 'Brand' }, { key: 'strength', label: 'Strength' }, { key: 'form', label: 'Form' }, { key: 'formula', label: 'Formula' }, { key: 'price', label: 'Price', format: 'currency' }, { key: 'requiresPrescription', label: 'Prescription' }, { key: 'status', label: 'Status', format: 'status' }] },
  payments: { resource: 'payments', title: 'Payments & commissions', description: 'Reconcile payments, earnings, commissions, and refunds.', singular: 'payment', statuses: ['PAID', 'PENDING', 'FAILED', 'REFUNDED'], columns: [{ key: 'id', label: 'Transaction' }, { key: 'orderId', label: 'Order' }, { key: 'pharmacyName', label: 'Pharmacy' }, { key: 'amount', label: 'Gross', format: 'currency' }, { key: 'commission', label: 'Commission', format: 'currency' }, { key: 'method', label: 'Method' }, { key: 'status', label: 'Status', format: 'status' }] },
  reviews: { resource: 'reviews', title: 'Reviews', description: 'Moderate feedback and protect marketplace trust.', singular: 'review', statuses: ['VISIBLE', 'HIDDEN', 'FLAGGED'], action: { label: 'Hide', nextStatus: 'HIDDEN' }, columns: [{ key: 'userName', label: 'Customer' }, { key: 'pharmacyName', label: 'Pharmacy' }, { key: 'rating', label: 'Rating' }, { key: 'comment', label: 'Review' }, { key: 'status', label: 'Status', format: 'status' }, { key: 'createdAt', label: 'Date', format: 'date' }] },
}

const formatCell = (record: AdminListRecord, column: Column) => {
  const value = record[column.key]
  if (value === null || value === undefined || value === '') return '—'
  if (column.format === 'status') return <StatusBadge value={String(value)} />
  if (column.format === 'currency') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value))
  if (column.format === 'date') return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(String(value)))
  if (typeof value === 'boolean') return value ? 'Required' : 'No'
  return String(value)
}

export function ResourcePage({ type }: { type: keyof typeof configs }) {
  const config = configs[type]
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const deferredSearch = useDeferredValue(search)
  const queryClient = useQueryClient()
  const params = useMemo(() => ({ page, search: deferredSearch || undefined, status: status || undefined }), [deferredSearch, page, status])
  const query = useQuery({ queryKey: [config.resource, params], queryFn: () => adminService.getResource(config.resource, params), placeholderData: keepPreviousData })
  const mutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: string }) => adminService.updateResourceStatus(config.resource, id, nextStatus),
    onSuccess: () => { toast.success(`${config.singular} updated successfully.`); queryClient.invalidateQueries({ queryKey: [config.resource] }) },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const runAction = useCallback((id: string) => {
    if (config.action) mutation.mutate({ id, nextStatus: config.action.nextStatus })
    else toast.info(`Detailed ${config.singular} management is not enabled yet.`)
  }, [config, mutation])
  const creatable = ['users', 'pharmacies', 'medicines'].includes(config.resource)

  return (
    <div className="page">
      <header className="page-header"><div><span className="page-kicker">MARKETPLACE MANAGEMENT</span><h1>{config.title}</h1><p>{config.description}</p></div>{creatable && <Button onClick={() => setCreateOpen(true)}>Add {config.singular}</Button>}</header>
      <Card className="resource-card">
        <div className="resource-toolbar">
          <label className="resource-search"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder={`Search ${config.title.toLowerCase()}...`} /></label>
          <label className="filter-select"><Filter size={16} /><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">All statuses</option>{config.statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        {query.isLoading ? <PageSkeleton /> : query.isError ? <ErrorState title={`Unable to load ${config.title.toLowerCase()}`} message={getErrorMessage(query.error)} onRetry={() => query.refetch()} /> : !query.data?.data.length ? <EmptyState title={`No ${config.title.toLowerCase()} found`} message="Try changing your search or filters." /> : (
          <>
            <div className="table-scroll"><table><thead><tr>{config.columns.map((column) => <th key={column.key}>{column.label}</th>)}<th aria-label="Actions" /></tr></thead>
              <tbody>{query.data.data.map((record) => <tr key={record.id}>{config.columns.map((column) => <td key={column.key}>{formatCell(record, column)}</td>)}<td><button className="row-action" onClick={() => runAction(record.id)} title={config.action?.label ?? 'More actions'}><MoreHorizontal /></button></td></tr>)}</tbody>
            </table></div>
            <footer className="pagination"><span>Page {query.data.meta.page} of {query.data.meta.totalPages} · {query.data.meta.total} results</span><div><Button variant="secondary" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft /></Button><Button variant="secondary" disabled={page >= query.data.meta.totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight /></Button></div></footer>
          </>
        )}
      </Card>
      {createOpen && (
        <CreateResourceModal
          resource={config.resource as CreatableResource}
          onClose={() => setCreateOpen(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: [config.resource] })}
        />
      )}
    </div>
  )
}
