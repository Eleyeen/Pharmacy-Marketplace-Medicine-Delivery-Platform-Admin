import { getAuth } from 'firebase-admin/auth'
import { FieldValue, GeoPoint } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireRole } from '../core/auth'
import { db, messaging } from '../core/firebase'

const accountFields = {
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  phone: z.string().trim().min(7).max(24),
  password: z.string().min(12).max(128),
}

const businessHoursSchema = z.record(
  z.string(),
  z.object({
    open: z.string().max(8),
    close: z.string().max(8),
    closed: z.boolean(),
  }),
).optional()

const createSchema = z.discriminatedUnion('resource', [
  z.object({ resource: z.literal('users'), ...accountFields }),
  z.object({
    resource: z.literal('pharmacies'),
    ...accountFields,
    pharmacyName: z.string().trim().min(2).max(140),
    cnic: z.string().trim().min(5).max(40).optional(),
    licenseNumber: z.string().trim().min(3).max(80),
    licenseDocumentUrl: z.string().url().optional().or(z.literal('')),
    city: z.string().trim().min(2).max(80),
    address: z.string().trim().min(5).max(250),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    deliveryMode: z.enum(['OWN_RIDER', 'PICKUP_ONLY']).default('OWN_RIDER'),
    businessHours: businessHoursSchema,
  }),
  z.object({
    resource: z.literal('medicines'),
    name: z.string().trim().min(2).max(140),
    genericName: z.string().trim().min(2).max(140),
    brand: z.string().trim().min(2).max(140),
    categoryId: z.string().trim().min(1).max(128),
    strength: z.string().trim().min(1).max(60),
    form: z.enum(['TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'CREAM', 'OTHER']),
    requiresPrescription: z.boolean(),
    description: z.string().trim().max(2000).optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
  }),
])

const normalize = (value: string) => value.trim().toLocaleLowerCase()

async function notifyPharmacyOwner(
  ownerUid: string | undefined,
  title: string,
  body: string,
  data: Record<string, string>,
) {
  if (!ownerUid) return
  const devices = await db.collection('users').doc(ownerUid).collection('devices')
    .where('notificationsEnabled', '==', true)
    .limit(200)
    .get()
  const tokens = devices.docs.map((doc) => doc.get('token') as string).filter(Boolean)
  if (!tokens.length) return
  await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  })
}

export const adminCreateResource = onCall(
  { enforceAppCheck: false, timeoutSeconds: 30 },
  async (request) => {
    const admin = requireRole(request, ['admin', 'ADMIN', 'SUPER_ADMIN'])
    const parsed = createSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'The submitted details are invalid.', {
        issues: parsed.error.flatten(),
      })
    }

    const input = parsed.data
    if (input.resource === 'medicines') {
      const category = await db.collection('medicineCategories').doc(input.categoryId).get()
      if (!category.exists) {
        throw new HttpsError('not-found', 'Medicine category was not found.')
      }

      const reference = db.collection('medicines').doc()
      await reference.create({
        name: input.name,
        normalizedName: normalize(input.name),
        genericName: input.genericName,
        normalizedGenericName: normalize(input.genericName),
        brand: input.brand,
        categoryId: input.categoryId,
        categoryName: category.get('name') ?? '',
        strength: input.strength,
        form: input.form,
        requiresPrescription: input.requiresPrescription,
        description: input.description || '',
        imageUrl: input.imageUrl || '',
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
        const deliveryMode = input.deliveryMode ?? 'OWN_RIDER'
        const hasCoords = typeof input.latitude === 'number' && typeof input.longitude === 'number'
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
          normalizedName: normalize(input.pharmacyName),
          ownerName: input.name,
          ownerUid: user.uid,
          email: input.email.toLowerCase(),
          phone: input.phone,
          cnic: input.cnic || '',
          licenseNumber: input.licenseNumber,
          licenseDocumentUrl: input.licenseDocumentUrl || '',
          city: input.city,
          address: input.address,
          ...(hasCoords
            ? {
                location: new GeoPoint(input.latitude!, input.longitude!),
                latitude: input.latitude,
                longitude: input.longitude,
              }
            : {}),
          serviceCities: [input.city],
          deliveryMode,
          deliveryEnabled: deliveryMode === 'OWN_RIDER',
          pickupEnabled: true,
          businessHours: input.businessHours ?? {},
          verificationStatus: 'PENDING',
          status: 'PENDING',
          rating: 0,
          reviewCount: 0,
          totalOrders: 0,
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
        totalOrders: 0,
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

const pharmacyActionSchema = z.object({
  pharmacyId: z.string().min(1).max(128),
  reason: z.string().trim().min(3).max(500).optional(),
  note: z.string().trim().min(3).max(500).optional(),
})

async function writeAudit(
  action: string,
  resource: string,
  resourceId: string,
  adminId: string,
  extra: Record<string, unknown> = {},
) {
  await db.collection('auditLogs').add({
    action,
    resource,
    resourceId,
    adminId,
    ...extra,
    createdAt: FieldValue.serverTimestamp(),
  })
}

export const approvePharmacy = onCall(
  { enforceAppCheck: false, timeoutSeconds: 30 },
  async (request) => {
    const admin = requireRole(request, ['admin', 'ADMIN', 'SUPER_ADMIN'])
    const parsed = pharmacyActionSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Pharmacy id is required.')

    const ref = db.collection('pharmacies').doc(parsed.data.pharmacyId)
    const snap = await ref.get()
    if (!snap.exists) throw new HttpsError('not-found', 'Pharmacy was not found.')

    await ref.update({
      verificationStatus: 'APPROVED',
      status: 'ACTIVE',
      rejectionReason: FieldValue.delete(),
      documentsRequestedNote: FieldValue.delete(),
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
    })
    await writeAudit('PHARMACY_APPROVED', 'pharmacies', parsed.data.pharmacyId, admin.uid)
    await notifyPharmacyOwner(
      snap.get('ownerUid'),
      'Pharmacy approved',
      'Your pharmacy has been approved and is now live on PharmaFlow.',
      { type: 'PHARMACY_APPROVED', pharmacyId: parsed.data.pharmacyId },
    )
    return { id: parsed.data.pharmacyId, verificationStatus: 'APPROVED' }
  },
)

export const rejectPharmacy = onCall(
  { enforceAppCheck: false, timeoutSeconds: 30 },
  async (request) => {
    const admin = requireRole(request, ['admin', 'ADMIN', 'SUPER_ADMIN'])
    const parsed = pharmacyActionSchema.safeParse(request.data)
    if (!parsed.success || !parsed.data.reason) {
      throw new HttpsError('invalid-argument', 'A rejection reason is required.')
    }

    const ref = db.collection('pharmacies').doc(parsed.data.pharmacyId)
    const snap = await ref.get()
    if (!snap.exists) throw new HttpsError('not-found', 'Pharmacy was not found.')

    await ref.update({
      verificationStatus: 'REJECTED',
      status: 'BLOCKED',
      rejectionReason: parsed.data.reason,
      rejectedAt: FieldValue.serverTimestamp(),
      rejectedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
    })
    await writeAudit('PHARMACY_REJECTED', 'pharmacies', parsed.data.pharmacyId, admin.uid, {
      reason: parsed.data.reason,
    })
    await notifyPharmacyOwner(
      snap.get('ownerUid'),
      'Pharmacy application rejected',
      parsed.data.reason,
      { type: 'PHARMACY_REJECTED', pharmacyId: parsed.data.pharmacyId },
    )
    return { id: parsed.data.pharmacyId, verificationStatus: 'REJECTED' }
  },
)

export const requestPharmacyDocuments = onCall(
  { enforceAppCheck: false, timeoutSeconds: 30 },
  async (request) => {
    const admin = requireRole(request, ['admin', 'ADMIN', 'SUPER_ADMIN'])
    const parsed = pharmacyActionSchema.safeParse(request.data)
    if (!parsed.success || !parsed.data.note) {
      throw new HttpsError('invalid-argument', 'A document request note is required.')
    }

    const ref = db.collection('pharmacies').doc(parsed.data.pharmacyId)
    const snap = await ref.get()
    if (!snap.exists) throw new HttpsError('not-found', 'Pharmacy was not found.')

    await ref.update({
      verificationStatus: 'PENDING',
      documentsRequestedNote: parsed.data.note,
      documentsRequestedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
    })
    await writeAudit('PHARMACY_DOCUMENTS_REQUESTED', 'pharmacies', parsed.data.pharmacyId, admin.uid, {
      note: parsed.data.note,
    })
    await notifyPharmacyOwner(
      snap.get('ownerUid'),
      'More documents required',
      parsed.data.note,
      { type: 'PHARMACY_DOCUMENTS_REQUESTED', pharmacyId: parsed.data.pharmacyId },
    )
    return { id: parsed.data.pharmacyId, verificationStatus: 'PENDING' }
  },
)

export const suspendPharmacy = onCall(
  { enforceAppCheck: false, timeoutSeconds: 30 },
  async (request) => {
    const admin = requireRole(request, ['admin', 'ADMIN', 'SUPER_ADMIN'])
    const parsed = pharmacyActionSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Pharmacy id is required.')

    const ref = db.collection('pharmacies').doc(parsed.data.pharmacyId)
    const snap = await ref.get()
    if (!snap.exists) throw new HttpsError('not-found', 'Pharmacy was not found.')

    await ref.update({
      verificationStatus: 'SUSPENDED',
      status: 'BLOCKED',
      suspensionReason: parsed.data.reason || '',
      suspendedAt: FieldValue.serverTimestamp(),
      suspendedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
    })
    await writeAudit('PHARMACY_SUSPENDED', 'pharmacies', parsed.data.pharmacyId, admin.uid, {
      reason: parsed.data.reason,
    })
    await notifyPharmacyOwner(
      snap.get('ownerUid'),
      'Pharmacy suspended',
      parsed.data.reason || 'Your pharmacy has been suspended by PharmaFlow admin.',
      { type: 'PHARMACY_SUSPENDED', pharmacyId: parsed.data.pharmacyId },
    )
    return { id: parsed.data.pharmacyId, verificationStatus: 'SUSPENDED' }
  },
)

export const reactivatePharmacy = onCall(
  { enforceAppCheck: false, timeoutSeconds: 30 },
  async (request) => {
    const admin = requireRole(request, ['admin', 'ADMIN', 'SUPER_ADMIN'])
    const parsed = pharmacyActionSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Pharmacy id is required.')

    const ref = db.collection('pharmacies').doc(parsed.data.pharmacyId)
    const snap = await ref.get()
    if (!snap.exists) throw new HttpsError('not-found', 'Pharmacy was not found.')

    await ref.update({
      verificationStatus: 'APPROVED',
      status: 'ACTIVE',
      suspensionReason: FieldValue.delete(),
      reactivatedAt: FieldValue.serverTimestamp(),
      reactivatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
    })
    await writeAudit('PHARMACY_REACTIVATED', 'pharmacies', parsed.data.pharmacyId, admin.uid)
    await notifyPharmacyOwner(
      snap.get('ownerUid'),
      'Pharmacy reactivated',
      'Your pharmacy is active again on PharmaFlow.',
      { type: 'PHARMACY_REACTIVATED', pharmacyId: parsed.data.pharmacyId },
    )
    return { id: parsed.data.pharmacyId, verificationStatus: 'APPROVED', status: 'ACTIVE' }
  },
)
