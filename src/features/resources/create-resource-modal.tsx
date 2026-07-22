import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Building2, Pill, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui'
import {
  adminService,
  type CreateResourceInput,
} from '../../services/admin-service'
import { getErrorMessage } from '../../services/api'

export type CreatableResource = 'users' | 'pharmacies' | 'medicines'

interface Field {
  key: string
  label: string
  type?: 'email' | 'password' | 'checkbox'
  placeholder?: string
}

const fields: Record<CreatableResource, Field[]> = {
  users: [
    { key: 'name', label: 'Full name', placeholder: 'Customer name' },
    { key: 'email', label: 'Email', type: 'email', placeholder: 'customer@example.com' },
    { key: 'phone', label: 'Phone', placeholder: '+923001234567' },
    { key: 'password', label: 'Temporary password', type: 'password', placeholder: 'Minimum 12 characters' },
  ],
  pharmacies: [
    { key: 'pharmacyName', label: 'Pharmacy name', placeholder: 'HealthPlus Pharmacy' },
    { key: 'name', label: 'Owner name', placeholder: 'Legal owner name' },
    { key: 'email', label: 'Owner email', type: 'email', placeholder: 'owner@example.com' },
    { key: 'phone', label: 'Phone', placeholder: '+923001234567' },
    { key: 'password', label: 'Temporary password', type: 'password', placeholder: 'Minimum 12 characters' },
    { key: 'licenseNumber', label: 'License number', placeholder: 'License identifier' },
    { key: 'city', label: 'Service city', placeholder: 'Lahore' },
    { key: 'address', label: 'Pharmacy address', placeholder: 'Complete street address' },
  ],
  medicines: [
    { key: 'name', label: 'Medicine name', placeholder: 'Medicine name' },
    { key: 'genericName', label: 'Generic name', placeholder: 'Generic name' },
    { key: 'brand', label: 'Brand', placeholder: 'Manufacturer or brand' },
    { key: 'category', label: 'Category', placeholder: 'Pain Relief' },
    { key: 'strength', label: 'Strength', placeholder: '500 mg' },
    { key: 'form', label: 'Form', placeholder: 'Tablet' },
    { key: 'requiresPrescription', label: 'Requires prescription', type: 'checkbox' },
  ],
}

const titles = {
  users: { title: 'Add customer', description: 'Create a Firebase customer account.', icon: UserPlus },
  pharmacies: { title: 'Add pharmacy', description: 'Create an owner account and pending pharmacy.', icon: Building2 },
  medicines: { title: 'Add medicine', description: 'Add a medicine to the canonical catalogue.', icon: Pill },
}

export function CreateResourceModal({
  resource,
  onClose,
  onCreated,
}: {
  resource: CreatableResource
  onClose: () => void
  onCreated: () => void
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>({
    requiresPrescription: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const definition = useMemo(() => titles[resource], [resource])
  const Icon = definition.icon

  const updateValue = useCallback((key: string, value: string | boolean) => {
    setValues((current) => ({ ...current, [key]: value }))
  }, [])

  const submit = useCallback(async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      await adminService.createResource({
        ...values,
        resource,
      } as CreateResourceInput)
      toast.success(`${definition.title.replace('Add ', '')} created successfully.`)
      onCreated()
      onClose()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }, [definition.title, onClose, onCreated, resource, values])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-resource-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <span><Icon /></span>
          <div><h2 id="create-resource-title">{definition.title}</h2><p>{definition.description}</p></div>
          <button onClick={onClose} aria-label="Close"><X /></button>
        </header>
        <form onSubmit={submit} className="resource-form">
          <div className="resource-form__grid">
            {fields[resource].map((field) => field.type === 'checkbox' ? (
              <label className="checkbox-field" key={field.key}>
                <input
                  type="checkbox"
                  checked={Boolean(values[field.key])}
                  onChange={(event) => updateValue(field.key, event.target.checked)}
                />
                <span>{field.label}</span>
              </label>
            ) : (
              <label key={field.key}>
                {field.label}
                <input
                  required
                  type={field.type ?? 'text'}
                  minLength={field.type === 'password' ? 12 : undefined}
                  value={String(values[field.key] ?? '')}
                  placeholder={field.placeholder}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                />
              </label>
            ))}
          </div>
          <footer className="modal-footer">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={submitting}>Create</Button>
          </footer>
        </form>
      </section>
    </div>
  )
}
