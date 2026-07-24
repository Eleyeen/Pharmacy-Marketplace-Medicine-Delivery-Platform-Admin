import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, FileWarning, MapPin, XCircle } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, StatusBadge } from '../../components/ui'
import { adminService } from '../../services/admin-service'
import { getErrorMessage } from '../../services/api'

export function PharmacyVerifyPage() {
  const { pharmacyId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  const query = useQuery({
    queryKey: ['pharmacy', pharmacyId],
    queryFn: () => adminService.getPharmacy(pharmacyId),
    enabled: Boolean(pharmacyId),
  })

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['pharmacy', pharmacyId] })
    queryClient.invalidateQueries({ queryKey: ['pharmacies'] })
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
  }, [pharmacyId, queryClient])

  const approve = useMutation({
    mutationFn: () => adminService.approvePharmacy(pharmacyId),
    onSuccess: () => { toast.success('Pharmacy approved.'); invalidate(); navigate(`/pharmacies/${pharmacyId}`) },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const reject = useMutation({
    mutationFn: () => {
      if (reason.trim().length < 3) throw new Error('Provide a rejection reason for the pharmacy.')
      return adminService.rejectPharmacy(pharmacyId, reason.trim())
    },
    onSuccess: () => { toast.success('Pharmacy rejected.'); invalidate(); navigate('/pharmacies') },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const requestDocs = useMutation({
    mutationFn: () => {
      if (note.trim().length < 3) throw new Error('Describe which documents are needed.')
      return adminService.requestPharmacyDocuments(pharmacyId, note.trim())
    },
    onSuccess: () => { toast.success('Document request sent.'); invalidate() },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  if (query.isLoading) return <PageSkeleton rows={8} />
  if (query.isError) {
    return <ErrorState title="Verification unavailable" message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
  }
  const pharmacy = query.data
  if (!pharmacy) return <EmptyState title="Pharmacy not found" message="This pharmacy may have been removed." />

  const mapUrl = pharmacy.latitude && pharmacy.longitude
    ? `https://www.google.com/maps?q=${pharmacy.latitude},${pharmacy.longitude}`
    : null

  return (
    <div className="page">
      <PageHeader
        kicker="Verification"
        title={pharmacy.name}
        description="Review submitted documents and approve, reject, or request more information."
        actions={
          <div className="header-actions">
            <Button variant="secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</Button>
            <Link to={`/pharmacies/${pharmacyId}`}><Button variant="ghost">Full profile</Button></Link>
          </div>
        }
      />

      <div className="detail-grid">
        <Card className="detail-card">
          <div className="detail-card__title">
            <h2>Submitted details</h2>
            <StatusBadge value={pharmacy.verificationStatus} />
          </div>
          <dl className="detail-list">
            <div><dt>Pharmacy name</dt><dd>{pharmacy.name}</dd></div>
            <div><dt>Owner</dt><dd>{pharmacy.ownerName}</dd></div>
            <div><dt>CNIC / ID</dt><dd>{pharmacy.cnic || '—'}</dd></div>
            <div><dt>License number</dt><dd>{pharmacy.licenseNumber || '—'}</dd></div>
            <div><dt>Contact number</dt><dd>{pharmacy.phone || '—'}</dd></div>
            <div><dt>Address</dt><dd>{pharmacy.address}, {pharmacy.city}</dd></div>
          </dl>
          {mapUrl && (
            <a className="map-link" href={mapUrl} target="_blank" rel="noreferrer">
              <MapPin size={15} /> Open location on map
            </a>
          )}
        </Card>

        <Card className="detail-card">
          <h2>License document</h2>
          {pharmacy.licenseDocumentUrl ? (
            <div className="document-preview">
              {/\.(png|jpe?g|webp|gif)$/i.test(pharmacy.licenseDocumentUrl)
                ? <img src={pharmacy.licenseDocumentUrl} alt="License document" />
                : <a href={pharmacy.licenseDocumentUrl} target="_blank" rel="noreferrer">Open license file</a>}
            </div>
          ) : (
            <EmptyState title="No license uploaded" message="Ask the pharmacy to upload their license document." />
          )}
        </Card>

        <Card className="detail-card span-all">
          <h2>Actions</h2>
          <div className="verify-actions">
            <Button loading={approve.isPending} onClick={() => approve.mutate()}>
              <CheckCircle2 size={16} /> Approve
            </Button>
            <div className="verify-panel">
              <label>
                Reject reason
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Explain why the application is rejected…" />
              </label>
              <Button variant="danger" loading={reject.isPending} onClick={() => reject.mutate()}>
                <XCircle size={16} /> Reject
              </Button>
            </div>
            <div className="verify-panel">
              <label>
                Request more documents
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="List the documents still required…" />
              </label>
              <Button variant="secondary" loading={requestDocs.isPending} onClick={() => requestDocs.mutate()}>
                <FileWarning size={16} /> Request documents
              </Button>
            </div>
          </div>
          {pharmacy.documentsRequestedNote && (
            <p className="inline-note">Last document request: {pharmacy.documentsRequestedNote}</p>
          )}
          {pharmacy.rejectionReason && (
            <p className="inline-note inline-note--danger">Rejection reason: {pharmacy.rejectionReason}</p>
          )}
        </Card>
      </div>
    </div>
  )
}
