import { getAuth } from 'firebase-admin/auth'
import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireRole } from '../core/auth'
import { db } from '../core/firebase'

const accountFields = {
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  phone: z.string().trim().min(7).max(24),
  password: z.string().min(12).max(128),
}

const createSchema = z.discriminatedUnion('resource', [
  z.object({ resource: z.literal('users'), ...accountFields }),
  z.object({
    resource: z.literal('pharmacies'),
    ...accountFields,
    pharmacyName: z.string().trim().min(2).max(140),
    licenseNumber: z.string().trim().min(3).max(80),
    city: z.string().trim().min(2).max(80),
    address: z.string().trim().min(5).max(250),
  }),
  z.object({
    resource: z.literal('medicines'),
    name: z.string().trim().min(2).max(140),
    genericName: z.string().trim().min(2).max(140),
    brand: z.string().trim().min(2).max(140),
    category: z.string().trim().min(2).max(100),
    strength: z.string().trim().min(1).max(60),
    form: z.string().trim().min(2).max(60),
    formula: z.string().trim().min(1).max(160),
    price: z.coerce.number().nonnegative().finite(),
    requiresPrescription: z.boolean(),
  }),
])

const statusSchema = z.object({
  resource: z.enum(['users', 'pharmacies', 'orders', 'medicines', 'payments', 'reviews']),
  id: z.string().min(1).max(256),
  status: z.string().min(2).max(40).regex(/^[A-Z_]+$/),
})

const statusFields: Record<string, string> = {
  pharmacies: 'verificationStatus',
  users: 'status',
  orders: 'status',
  medicines: 'status',
  payments: 'status',
  reviews: 'status',
}

export const adminCreateResource = onCall(
  { enforceAppCheck: false, timeoutSeconds: 30 },
  async (request) => {
    const admin = requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
    const parsed = createSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'The submitted details are invalid.', {
        issues: parsed.error.flatten(),
      })
    }

    const input = parsed.data
    if (input.resource === 'medicines') {
      const reference = db.collection('medicines').doc()
      await reference.create({
        name: input.name,
        genericName: input.genericName,
        brand: input.brand,
        category: input.category,
        strength: input.strength,
        form: input.form,
        formula: input.formula,
        price: input.price,
        requiresPrescription: input.requiresPrescription,
        status: 'ACTIVE',
        createdBy: admin.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      return { id: reference.id }
    }

    const role = input.resource === 'pharmacies' ? 'PHARMACY' : 'USER'
    const user = await getAuth().createUser({
      email: input.email.toLowerCase(),
      password: input.password,
      displayName: input.name,
      phoneNumber: input.phone.startsWith('+') ? input.phone : undefined,
      emailVerified: false,
      disabled: false,
    })

    try {
      if (input.resource === 'pharmacies') {
        const pharmacyRef = db.collection('pharmacies').doc()
        await getAuth().setCustomUserClaims(user.uid, { role, pharmacyId: pharmacyRef.id })
        const batch = db.batch()
        batch.create(db.collection('users').doc(user.uid), {
          name: input.name,
          email: input.email.toLowerCase(),
          phone: input.phone,
          role,
          pharmacyId: pharmacyRef.id,
          status: 'ACTIVE',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })
        batch.create(pharmacyRef, {
          name: input.pharmacyName,
          ownerName: input.name,
          ownerUid: user.uid,
          email: input.email.toLowerCase(),
          phone: input.phone,
          licenseNumber: input.licenseNumber,
          city: input.city,
          address: input.address,
          serviceCities: [input.city],
          verificationStatus: 'PENDING',
          status: 'PENDING',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })
        await batch.commit()
        return { id: pharmacyRef.id, uid: user.uid }
      }

      await getAuth().setCustomUserClaims(user.uid, { role })
      await db.collection('users').doc(user.uid).create({
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone,
        role,
        status: 'ACTIVE',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      return { id: user.uid, uid: user.uid }
    } catch (error) {
      await getAuth().deleteUser(user.uid).catch(() => undefined)
      throw error
    }
  },
)

export const adminUpdateResourceStatus = onCall(
  { enforceAppCheck: false, timeoutSeconds: 30 },
  async (request) => {
    const admin = requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
    const parsed = statusSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'The status change is invalid.')
    }

    const { resource, id, status } = parsed.data
    const reference = db.collection(resource).doc(id)
    if (!(await reference.get()).exists) {
      throw new HttpsError('not-found', 'The requested record was not found.')
    }

    const batch = db.batch()
    batch.update(reference, {
      [statusFields[resource]]: status,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
    })
    batch.create(db.collection('auditLogs').doc(), {
      action: 'RESOURCE_STATUS_UPDATED',
      resource,
      resourceId: id,
      status,
      adminId: admin.uid,
      createdAt: FieldValue.serverTimestamp(),
    })
    await batch.commit()
    return { id, status }
  },
)
