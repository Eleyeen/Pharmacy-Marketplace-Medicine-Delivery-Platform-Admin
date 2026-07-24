import { useCallback, useDeferredValue, useMemo, useState, type FormEvent } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Filter, Plus, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, StatusBadge } from '../../components/ui'
import { adminService } from '../../services/admin-service'
import { getErrorMessage } from '../../services/api'
import type { Medicine, MedicineForm, MedicineStatus } from '../../types'

const FORMS: MedicineForm[] = ['TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'CREAM', 'OTHER']

const emptyMedicine = (): Omit<Medicine, 'id'> => ({
  name: '',
  genericName: '',
  brand: '',
  categoryId: '',
  categoryName: '',
  strength: '',
  form: 'TABLET',
  requiresPrescription: false,
  description: '',
  imageUrl: '',
  status: 'ACTIVE',
})

export function MedicinesPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyMedicine)
  const [categoryName, setCategoryName] = useState('')
  const deferredSearch = useDeferredValue(search)
  const queryClient = useQueryClient()

  const params = useMemo(
    () => ({ page, search: deferredSearch || undefined, status: status || undefined }),
    [deferredSearch, page, status],
  )

  const medicinesQuery = useQuery({
    queryKey: ['medicines', params],
    queryFn: () => adminService.getResource('medicines', params),
    placeholderData: keepPreviousData,
  })
  const categoriesQuery = useQuery({
    queryKey: ['medicineCategories'],
    queryFn: adminService.listCategories,
  })

  const openCreate = useCallback(() => {
    setEditingId(null)
    setForm(emptyMedicine())
    setEditorOpen(true)
  }, [])

  const openEdit = useCallback(async (id: string) => {
    try {
      const medicine = await adminService.getMedicine(id)
      setEditingId(id)
      setForm({
        name: medicine.name,
        genericName: medicine.genericName,
        brand: medicine.brand,
        categoryId: medicine.categoryId,
        categoryName: medicine.categoryName,
        strength: medicine.strength,
        form: medicine.form as MedicineForm,
        requiresPrescription: medicine.requiresPrescription,
        description: medicine.description ?? '',
        imageUrl: medicine.imageUrl ?? '',
        status: medicine.status,
      })
      setEditorOpen(true)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }, [])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const category = categoriesQuery.data?.find((item) => item.id === form.categoryId)
      return adminService.saveMedicine(editingId, {
        ...form,
        categoryName: category?.name ?? form.categoryName,
        status: form.status as MedicineStatus,
      })
    },
    onSuccess: () => {
      toast.success(editingId ? 'Medicine updated.' : 'Medicine created.')
      setEditorOpen(false)
      queryClient.invalidateQueries({ queryKey: ['medicines'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminService.deleteMedicine(id),
    onSuccess: () => {
      toast.success('Medicine deleted.')
      queryClient.invalidateQueries({ queryKey: ['medicines'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const categoryMutation = useMutation({
    mutationFn: () => {
      if (categoryName.trim().length < 2) throw new Error('Enter a category name.')
      return adminService.saveCategory(null, categoryName.trim())
    },
    onSuccess: () => {
      toast.success('Category created.')
      setCategoryName('')
      queryClient.invalidateQueries({ queryKey: ['medicineCategories'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteCategory = useMutation({
    mutationFn: (id: string) => adminService.deleteCategory(id),
    onSuccess: () => {
      toast.success('Category deleted.')
      queryClient.invalidateQueries({ queryKey: ['medicineCategories'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const submit = useCallback((event: FormEvent) => {
    event.preventDefault()
    if (!form.categoryId) {
      toast.error('Select a medicine category.')
      return
    }
    saveMutation.mutate()
  }, [form.categoryId, saveMutation])

  return (
    <div className="page">
      <PageHeader
        kicker="Catalogue"
        title="Medicines"
        description="Maintain the canonical medicine catalogue and categories shared with the apps."
        actions={<Button onClick={openCreate}><Plus size={16} /> Add medicine</Button>}
      />

      <div className="detail-grid">
        <Card className="resource-card span-all">
          <div className="resource-toolbar">
            <label className="resource-search">
              <Search size={17} />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search medicines..." />
            </label>
            <label className="filter-select">
              <Filter size={16} />
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
                <option value="">All statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
          </div>
          {medicinesQuery.isLoading ? <PageSkeleton /> : medicinesQuery.isError ? (
            <ErrorState title="Unable to load medicines" message={getErrorMessage(medicinesQuery.error)} onRetry={() => medicinesQuery.refetch()} />
          ) : !medicinesQuery.data?.data.length ? (
            <EmptyState title="No medicines found" message="Add medicines to populate the shared catalogue." />
          ) : (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Generic</th>
                      <th>Brand</th>
                      <th>Category</th>
                      <th>Strength</th>
                      <th>Form</th>
                      <th>Rx</th>
                      <th>Status</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {medicinesQuery.data.data.map((record) => (
                      <tr key={record.id}>
                        <td><button className="link-button" onClick={() => openEdit(record.id)}><strong>{record.name}</strong></button></td>
                        <td>{record.genericName ?? '—'}</td>
                        <td>{record.brand ?? '—'}</td>
                        <td>{record.categoryName ?? record.categoryId ?? '—'}</td>
                        <td>{record.strength ?? '—'}</td>
                        <td>{record.form ?? '—'}</td>
                        <td>{record.requiresPrescription ? 'Yes' : 'No'}</td>
                        <td><StatusBadge value={String(record.status ?? 'ACTIVE')} /></td>
                        <td>
                          <button
                            className="row-action"
                            title="Delete"
                            onClick={() => {
                              if (window.confirm('Delete this medicine from the catalogue?')) {
                                deleteMutation.mutate(record.id)
                              }
                            }}
                          >
                            <Trash2 />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="pagination">
                <span>Page {medicinesQuery.data.meta.page} of {medicinesQuery.data.meta.totalPages}</span>
                <div>
                  <Button variant="secondary" disabled={page === 1} onClick={() => setPage((v) => v - 1)}><ChevronLeft /></Button>
                  <Button variant="secondary" disabled={page >= medicinesQuery.data.meta.totalPages} onClick={() => setPage((v) => v + 1)}><ChevronRight /></Button>
                </div>
              </footer>
            </>
          )}
        </Card>

        <Card className="detail-card">
          <h2>Categories</h2>
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault()
              categoryMutation.mutate()
            }}
          >
            <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="New category name" />
            <Button type="submit" loading={categoryMutation.isPending}>Add</Button>
          </form>
          {categoriesQuery.isLoading ? <PageSkeleton rows={3} /> : !categoriesQuery.data?.length ? (
            <EmptyState title="No categories" message="Create categories before adding medicines." />
          ) : (
            <ul className="category-list">
              {categoriesQuery.data.map((category) => (
                <li key={category.id}>
                  <span>{category.name}</span>
                  <button
                    className="row-action"
                    onClick={() => {
                      if (window.confirm(`Delete category “${category.name}”?`)) {
                        deleteCategory.mutate(category.id)
                      }
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {editorOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditorOpen(false)}>
          <section className="modal-card" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <div>
                <h2>{editingId ? 'Edit medicine' : 'Add medicine'}</h2>
                <p>Canonical catalogue fields shared with the user and pharmacy apps.</p>
              </div>
              <button onClick={() => setEditorOpen(false)} aria-label="Close"><X /></button>
            </header>
            <form className="resource-form" onSubmit={submit}>
              <div className="resource-form__grid">
                <label>Name<input required value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} /></label>
                <label>Generic name<input required value={form.genericName} onChange={(e) => setForm((c) => ({ ...c, genericName: e.target.value }))} /></label>
                <label>Brand<input required value={form.brand} onChange={(e) => setForm((c) => ({ ...c, brand: e.target.value }))} /></label>
                <label>
                  Category
                  <select required value={form.categoryId} onChange={(e) => setForm((c) => ({ ...c, categoryId: e.target.value }))}>
                    <option value="">Select category</option>
                    {categoriesQuery.data?.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label>Strength<input required value={form.strength} onChange={(e) => setForm((c) => ({ ...c, strength: e.target.value }))} /></label>
                <label>
                  Form
                  <select value={form.form} onChange={(e) => setForm((c) => ({ ...c, form: e.target.value }))}>
                    {FORMS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label className="span-2">Description<textarea value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} rows={3} /></label>
                <label className="span-2">Image URL<input value={form.imageUrl} onChange={(e) => setForm((c) => ({ ...c, imageUrl: e.target.value }))} placeholder="https://…" /></label>
                <label className="checkbox-field">
                  <input type="checkbox" checked={form.requiresPrescription} onChange={(e) => setForm((c) => ({ ...c, requiresPrescription: e.target.checked }))} />
                  Requires prescription
                </label>
                <label>
                  Active status
                  <select value={form.status} onChange={(e) => setForm((c) => ({ ...c, status: e.target.value as MedicineStatus }))}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </label>
              </div>
              <footer className="modal-footer">
                <Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>Cancel</Button>
                <Button type="submit" loading={saveMutation.isPending}>Save</Button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
