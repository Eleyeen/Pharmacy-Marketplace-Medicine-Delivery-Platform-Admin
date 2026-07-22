import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { db } from '../core/firebase'

export const dispatchOrderToPharmacies = onDocumentCreated(
  { document: 'orders/{orderId}', retry: true, timeoutSeconds: 60 },
  async (event) => {
    const snapshot = event.data
    if (!snapshot) return

    const order = snapshot.data()
    if (order.status !== 'SEARCHING_PHARMACY') return

    const city = order.deliveryAddress?.city
    if (typeof city !== 'string' || !city) {
      logger.error('Order has no searchable city', { orderId: snapshot.id })
      await snapshot.ref.update({
        dispatchError: 'DELIVERY_CITY_MISSING',
        updatedAt: FieldValue.serverTimestamp(),
      })
      return
    }

    const pharmacies = await db.collection('pharmacies')
      .where('verificationStatus', '==', 'APPROVED')
      .where('serviceCities', 'array-contains', city)
      .limit(10)
      .get()

    if (pharmacies.empty) {
      await snapshot.ref.update({
        dispatchError: 'NO_MATCHING_PHARMACY',
        updatedAt: FieldValue.serverTimestamp(),
      })
      return
    }

    const expiresAt = Timestamp.fromMillis(Date.now() + 5 * 60 * 1000)

    await db.runTransaction(async (transaction) => {
      const currentOrder = await transaction.get(snapshot.ref)
      if (!currentOrder.exists || currentOrder.get('status') !== 'SEARCHING_PHARMACY') return

      pharmacies.docs.forEach((pharmacy) => {
        const requestRef = db.collection('pharmacyOrderRequests').doc(`${snapshot.id}_${pharmacy.id}`)
        transaction.create(requestRef, {
          orderId: snapshot.id,
          pharmacyId: pharmacy.id,
          userId: order.userId,
          requestedItems: order.items,
          status: 'PENDING',
          expiresAt,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })
      })

      transaction.update(snapshot.ref, {
        status: 'PHARMACY_REQUESTED',
        requestedPharmacyCount: pharmacies.size,
        updatedAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion({
          status: 'PHARMACY_REQUESTED',
          actorId: 'SYSTEM',
          createdAt: Timestamp.now(),
        }),
      })
    })
  },
)
