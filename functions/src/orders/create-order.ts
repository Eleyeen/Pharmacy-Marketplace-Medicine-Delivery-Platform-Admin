import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireRole } from '../core/auth'
import { db } from '../core/firebase'
import { createOrderSchema } from './schemas'

export const createOrder = onCall(
  { enforceAppCheck: true, timeoutSeconds: 30, memory: '256MiB' },
  async (request) => {
    const { uid } = requireRole(request, ['USER'])
    const parsed = createOrderSchema.safeParse(request.data)

    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'Order details are invalid.', {
        issues: parsed.error.flatten(),
      })
    }

    const input = parsed.data
    const idempotencyRef = db.collection('orderIdempotency').doc(`${uid}_${input.idempotencyKey}`)
    const orderRef = db.collection('orders').doc()
    const addressRef = db.collection('users').doc(uid).collection('addresses').doc(input.addressId)

    return db.runTransaction(async (transaction) => {
      const [existing, address] = await Promise.all([
        transaction.get(idempotencyRef),
        transaction.get(addressRef),
      ])

      if (existing.exists) {
        return { orderId: existing.get('orderId') as string, duplicated: true }
      }
      if (!address.exists || address.get('active') === false) {
        throw new HttpsError('failed-precondition', 'Select a valid delivery address.')
      }

      transaction.create(orderRef, {
        userId: uid,
        items: input.items,
        deliveryAddress: {
          addressId: address.id,
          label: address.get('label'),
          line1: address.get('line1'),
          city: address.get('city'),
          location: address.get('location'),
        },
        deliveryType: input.deliveryType,
        paymentMethod: input.paymentMethod,
        paymentStatus: 'PENDING',
        status: 'SEARCHING_PHARMACY',
        pharmacyId: null,
        statusHistory: [{
          status: 'SEARCHING_PHARMACY',
          actorId: uid,
          createdAt: Timestamp.now(),
        }],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      transaction.create(idempotencyRef, {
        orderId: orderRef.id,
        userId: uid,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })

      return { orderId: orderRef.id, duplicated: false }
    })
  },
)
