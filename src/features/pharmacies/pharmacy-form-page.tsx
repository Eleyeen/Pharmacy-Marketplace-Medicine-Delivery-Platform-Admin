import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Upload } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Card, ErrorState, PageHeader, PageSkeleton } from '../../components/ui'
import { adminService } from '../../services/admin-service'
import { getErrorMessage } from '../../services/api'
import type { BusinessHours, DeliveryMode } from '../../types'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const defaultHours = (): Record<string, BusinessHours> =>
  Object.fromEntries(DAYS.map((day) => [day, {
    open: '09:00',
    close: '21:00',
    closed: day === 'sunday',
  }]))

interface FormState {
  pharmacyName: string
  ownerName: string
  email: string
  phone: string
  password: string
  cnic: string
  licenseNumber: string
  licenseDocumentUrl: string
  address: string
  city: string
  latitude: string
  longitude: string
  deliveryMode: DeliveryMode
  businessHours: Record<string, BusinessHours>
}

const emptyForm = (): FormState => ({
  pharmacyName: '',
  ownerName: '',
  email: '',
  phone: '',
  password: '',
  cnic: '',
  licenseNumber: '',
  licenseDocumentUrl: '',
  address: '',
  city: '',
  latitude: '',
  longitude: '',
  deliveryMode: 'OWN_RIDER',
  businessHours: defaultHours(),
})

export function PharmacyFormPage() {
  const { pharmacyId } = useParams()
  const isEdit = Boolean(pharmacyId && pharmacyId !== 'new')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [uploading, setUploading] = useState(false)

  const pharmacyQuery = useQuery({
    queryKey: ['pharmacy', pharmacyId],
    queryFn: () => adminService.getPharmacy(pharmacyId!),
    enabled: isEdit,
  })

  useEffect(() => {
    if (!pharmacyQuery.data) return
    const pharmacy = pharmacyQuery.data
    setForm({
      pharmacyName: pharmacy.name,
      ownerName: pharmacy.ownerName,
      email: pharmacy.ownerEmail ?? '',
      phone: pharmacy.phone,
      password: '',
      cnic: pharmacy.cnic ?? '',
      licenseNumber: pharmacy.licenseNumber,
      licenseDocumentUrl: pharmacy.licenseDocumentUrl ?? '',
      address: pharmacy.address,
      city: pharmacy.city,
      latitude: pharmacy.latitude?.toString() ?? '',
      longitude: pharmacy.longitude?.toString() ?? '',
      deliveryMode: pharmacy.deliveryMode ?? (pharmacy.deliveryEnabled === false ? 'PICKUP_ONLY' : 'OWN_RIDER'),
      businessHours: pharmacy.businessHours && Object.keys(pharmacy.businessHours).length
        ? pharmacy.businessHours
        : defaultHours(),
    })
  }, [pharmacyQuery.data])

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }, [])

  const updateHours = useCallback((day: string, patch: Partial<BusinessHours>) => {
    setForm((current) => ({
      ...current,
      businessHours: {
        ...current.businessHours,
        [day]: { ...current.businessHours[day], ...patch },
      },
    }))
  }, [])

  const uploadLicense = useCallback(async (file: File | null) => {
    if (!file) return
    setUploading(true)
    try {
      const url = await adminService.uploadDocument(
        `pharmacy-documents/${pharmacyId ?? 'new'}/${Date.now()}-${file.name}`,
        file,
      )
      updateField('licenseDocumentUrl', url)
      toast.success('License document uploaded.')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setUploading(false)
    }
  }, [pharmacyId, updateField])

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit && pharmacyId) {
        return adminService.updatePharmacy(pharmacyId, {
          name: form.pharmacyName,
          ownerName: form.ownerName,
          phone: form.phone,
          cnic: form.cnic,
          licenseNumber: form.licenseNumber,
          licenseDocumentUrl: form.licenseDocumentUrl,
          address: form.address,
          city: form.city,
          latitude: form.latitude ? Number(form.latitude) : undefined,
          longitude: form.longitude ? Number(form.longitude) : undefined,
          deliveryMode: form.deliveryMode,
          deliveryEnabled: form.deliveryMode === 'OWN_RIDER',
          pickupEnabled: true,
          businessHours: form.businessHours,
        })
      }
      return adminService.createResource({
        resource: 'pharmacies',
        pharmacyName: form.pharmacyName,
        name: form.ownerName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        cnic: form.cnic,
        licenseNumber: form.licenseNumber,
        licenseDocumentUrl: form.licenseDocumentUrl,
        address: form.address,
        city: form.city,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        deliveryMode: form.deliveryMode,
        businessHours: form.businessHours,
      })
    },
    onSuccess: (result) => {
      toast.success(isEdit ? 'Pharmacy updated.' : 'Pharmacy created and pending verification.')
      queryClient.invalidateQueries({ queryKey: ['pharmacies'] })
      const id = isEdit ? pharmacyId! : result.id
      navigate(`/pharmacies/${id}`)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const mapLink = useMemo(() => {
    if (!form.latitude || !form.longitude) return null
    return `https://www.google.com/maps?q=${form.latitude},${form.longitude}`
  }, [form.latitude, form.longitude])

  const submit = useCallback((event: FormEvent) => {
    event.preventDefault()
    mutation.mutate()
  }, [mutation])

  if (isEdit && pharmacyQuery.isLoading) return <PageSkeleton rows={8} />
  if (isEdit && pharmacyQuery.isError) {
    return <ErrorState title="Pharmacy unavailable" message={getErrorMessage(pharmacyQuery.error)} onRetry={() => pharmacyQuery.refetch()} />
  }

  return (
    <div className="page">
      <PageHeader
        kicker={isEdit ? 'Edit pharmacy' : 'Manual onboarding'}
        title={isEdit ? 'Edit pharmacy' : 'Add pharmacy'}
        description="Create or update pharmacy profile details used for verification and discovery."
        actions={<Button variant="secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</Button>}
      />

      <form onSubmit={submit}>
        <div className="detail-grid">
          <Card className="detail-card">
            <h2>Identity</h2>
            <div className="resource-form__grid">
              <label>Pharmacy name<input required value={form.pharmacyName} onChange={(e) => updateField('pharmacyName', e.target.value)} /></label>
              <label>Owner name<input required value={form.ownerName} onChange={(e) => updateField('ownerName', e.target.value)} /></label>
              {!isEdit && (
                <>
                  <label>Owner email<input required type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} /></label>
                  <label>Temporary password<input required type="password" minLength={12} value={form.password} onChange={(e) => updateField('password', e.target.value)} /></label>
                </>
              )}
              <label>Contact phone<input required value={form.phone} onChange={(e) => updateField('phone', e.target.value)} /></label>
              <label>CNIC / ID<input value={form.cnic} onChange={(e) => updateField('cnic', e.target.value)} /></label>
              <label>License number<input required value={form.licenseNumber} onChange={(e) => updateField('licenseNumber', e.target.value)} /></label>
              <label>
                License document
                <span className="file-field">
                  <input type="file" accept="image/*,.pdf" onChange={(e) => uploadLicense(e.target.files?.[0] ?? null)} />
                  <Button type="button" variant="secondary" loading={uploading} onClick={() => undefined}><Upload size={15} /> Upload</Button>
                </span>
                {form.licenseDocumentUrl && <a href={form.licenseDocumentUrl} target="_blank" rel="noreferrer">View uploaded document</a>}
              </label>
            </div>
          </Card>

          <Card className="detail-card">
            <h2>Location & delivery</h2>
            <div className="resource-form__grid">
              <label>City<input required value={form.city} onChange={(e) => updateField('city', e.target.value)} /></label>
              <label className="span-2">Address<input required value={form.address} onChange={(e) => updateField('address', e.target.value)} /></label>
              <label>Latitude<input type="number" step="any" value={form.latitude} onChange={(e) => updateField('latitude', e.target.value)} /></label>
              <label>Longitude<input type="number" step="any" value={form.longitude} onChange={(e) => updateField('longitude', e.target.value)} /></label>
              <label>
                Delivery mode
                <select value={form.deliveryMode} onChange={(e) => updateField('deliveryMode', e.target.value as DeliveryMode)}>
                  <option value="OWN_RIDER">Own rider</option>
                  <option value="PICKUP_ONLY">Pickup only</option>
                </select>
              </label>
              {mapLink && <a className="map-link span-2" href={mapLink} target="_blank" rel="noreferrer">Open map pin</a>}
            </div>
          </Card>

          <Card className="detail-card span-all">
            <h2>Opening hours</h2>
            <div className="hours-grid">
              {DAYS.map((day) => {
                const hours = form.businessHours[day]
                return (
                  <div className="hours-row" key={day}>
                    <strong>{day}</strong>
                    <label className="checkbox-field">
                      <input type="checkbox" checked={hours.closed} onChange={(e) => updateHours(day, { closed: e.target.checked })} />
                      Closed
                    </label>
                    <input type="time" disabled={hours.closed} value={hours.open} onChange={(e) => updateHours(day, { open: e.target.value })} />
                    <input type="time" disabled={hours.closed} value={hours.close} onChange={(e) => updateHours(day, { close: e.target.value })} />
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Create pharmacy'}</Button>
        </div>
      </form>
    </div>
  )
}
