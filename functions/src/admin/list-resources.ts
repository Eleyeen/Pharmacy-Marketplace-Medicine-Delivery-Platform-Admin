import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireRole } from '../core/auth'
import { db } from '../core/firebase'

const listSchema = z.object({
  resource: z.enum(['users', 'pharmacies', 'orders', 'medicines', 'payments', 'reviews']),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(20),
  search: z.union([z.string().max(120), z.null(), z.undefined()]).optional(),
  status: z.union([z.string().max(40), z.null(), z.undefined()]).optional(),
})

const statusFields: Record<string, string> = {
  pharmacies: 'verificationStatus',
  users: 'status',
  orders: 'status',
  medicines: 'status',
  payments: 'status',
  reviews: 'status',
}

const toPlainValue = (value: unknown): string | number | boolean | null | undefined => {
  if (value === null || value === undefined) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'object' && value && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  return undefined
}

export const adminListResource = onCall(
  { enforceAppCheck: false, timeoutSeconds: 30, memory: '256MiB' },
  async (request) => {
    requireRole(request, ['admin', 'ADMIN', 'SUPER_ADMIN'])
    const parsed = listSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'List filters are invalid.', {
        issues: parsed.error.flatten(),
      })
    }

    const { resource, page, pageSize } = parsed.data
    const status = parsed.data.status?.trim() || undefined
    const search = parsed.data.search?.trim() || undefined
    const statusField = statusFields[resource]
    const orderStatusGroups: Record<string, string[]> = {
      SEARCHING: ['PENDING', 'SEARCHING_PHARMACY', 'PHARMACY_REQUESTED', 'PHARMACY_CHECKING'],
      CONFIRMED: ['PHARMACY_CONFIRMED'],
      PREPARING: ['PREPARING'],
      READY: ['READY_FOR_PICKUP'],
      OUT_FOR_DELIVERY: ['DRIVER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'],
      DELIVERED: ['DELIVERED'],
      CANCELLED: ['CANCELLED'],
      REFUNDED: ['REFUNDED'],
    }
    const statusGroup = resource === 'orders' && status ? orderStatusGroups[status] : undefined
    let query = db.collection(resource).limit(200)

    if (status && !statusGroup) {
      query = db.collection(resource).where(statusField, '==', status).limit(200)
    }

    const snapshot = await query.get()
    const normalizedSearch = search?.toLowerCase()
    const filtered = snapshot.docs
      .map((document) => {
        const record: Record<string, string | number | boolean | null | undefined> = {
          id: document.id,
        }
        Object.entries(document.data()).forEach(([key, value]) => {
          const plain = toPlainValue(value)
          if (plain !== undefined) record[key] = plain
        })
        return record
      })
      .filter((record) => {
        if (statusGroup && !statusGroup.includes(String(record.status ?? ''))) return false
        if (!normalizedSearch) return true
        return Object.values(record).some(
          (value) => String(value ?? '').toLowerCase().includes(normalizedSearch),
        )
      })

    const start = (page - 1) * pageSize
    return {
      data: filtered.slice(start, start + pageSize),
      meta: {
        page,
        pageSize,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      },
    }
  },
)
