import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireRole } from '../core/auth'
import { db } from '../core/firebase'
import { acceptOrderSchema } from './schemas'

export const acceptPharmacyOrder = onCall(
  { enforceAppCheck: true, timeoutSeconds: 30, memory: '256MiB' },
  async (request) => {
    const auth = requireRole(request, ['PHARMACY'])
    if (!auth.pharmacyId) {
      throw new HttpsError('permission-denied', 'No pharmacy is assigned to this account.')
    }

    const parsed = acceptOrderSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'Availability confirmation is invalid.', {
        issues: parsed.error.flatten(),
      })
    }

    const input = parsed.data
    const orderRef = db.collection('orders').doc(input.orderId)
    const requestRef = db.collection('pharmacyOrderRequests').doc(input.requestId)

    return db.runTransaction(async (transaction) => {
      const [orderSnapshot, requestSnapshot] = await Promise.all([
        transaction.get(orderRef),
        transaction.get(requestRef),
      ])

      if (!orderSnapshot.exists || !requestSnapshot.exists) {
        throw new HttpsError('not-found', 'The order request no longer exists.')
      }

      const order = orderSnapshot.data()!
      const pharmacyRequest = requestSnapshot.data()!
      if (pharmacyRequest.pharmacyId !== auth.pharmacyId || pharmacyRequest.orderId !== input.orderId) {
        throw new HttpsError('permission-denied', 'This request belongs to another pharmacy.')
      }
      if (order.status !== 'PHARMACY_REQUESTED' || pharmacyRequest.status !== 'PENDING') {
        throw new HttpsError('aborted', 'Another pharmacy has already accepted this order.')
      }
      if (pharmacyRequest.expiresAt.toMillis() <= Date.now()) {
        throw new HttpsError('deadline-exceeded', 'This pharmacy request has expired.')
      }

      const requestedIds = new Set<string>(
        (order.items as Array<{ medicineId: string }>).map((item) => item.medicineId),
      )
      const confirmedIds = new Set(input.confirmedItems.map((item) => item.medicineId))
      if (confirmedIds.size !== input.confirmedItems.length ||
          input.confirmedItems.some((item) => !requestedIds.has(item.medicineId))) {
        throw new HttpsError('invalid-argument', 'Confirmed medicines must be unique requested items.')
      }

      const competingRequests = await transaction.get(
        db.collection('pharmacyOrderRequests')
          .where('orderId', '==', input.orderId)
          .where('status', '==', 'PENDING'),
      )
      const subtotal = input.confirmedItems.reduce(
        (total, item) => total + item.quantity * item.unitPrice,
        0,
      )

      transaction.update(orderRef, {
        pharmacyId: auth.pharmacyId,
        confirmedItems: input.confirmedItems,
        isPartialOrder: confirmedIds.size < requestedIds.size,
        subtotal,
        status: 'PHARMACY_CONFIRMED',
        updatedAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion({
          status: 'PHARMACY_CONFIRMED',
          actorId: auth.uid,
          createdAt: Timestamp.now(),
        }),
      })

      competingRequests.docs.forEach((snapshot) => {
        transaction.update(snapshot.ref, {
          status: snapshot.id === input.requestId ? 'ACCEPTED' : 'EXPIRED',
          updatedAt: FieldValue.serverTimestamp(),
        })
      })

      return {
        orderId: input.orderId,
        status: 'PHARMACY_CONFIRMED',
        isPartialOrder: confirmedIds.size < requestedIds.size,
      }
    })
  },
)
