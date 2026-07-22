import { logger } from 'firebase-functions'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { db, messaging } from '../core/firebase'

const notificationCopy: Record<string, { title: string; body: string }> = {
  PHARMACY_REQUESTED: {
    title: 'Finding your pharmacy',
    body: 'Verified pharmacies are checking your medicines.',
  },
  PHARMACY_CONFIRMED: {
    title: 'Order confirmed',
    body: 'A pharmacy has confirmed your medicines.',
  },
  PREPARING: {
    title: 'Order being prepared',
    body: 'Your pharmacy is preparing your medicines.',
  },
  READY_FOR_PICKUP: {
    title: 'Order ready',
    body: 'Your medicines are ready for pickup.',
  },
  OUT_FOR_DELIVERY: {
    title: 'On the way',
    body: 'Your medicines are out for delivery.',
  },
  DELIVERED: {
    title: 'Order delivered',
    body: 'Your delivery is complete.',
  },
  CANCELLED: {
    title: 'Order cancelled',
    body: 'Your order has been cancelled.',
  },
}

export const sendOrderStatusNotification = onDocumentUpdated(
  'orders/{orderId}',
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after || before.status === after.status) return

    const copy = notificationCopy[after.status]
    if (!copy || typeof after.userId !== 'string') return

    const devices = await db.collection('users').doc(after.userId).collection('devices')
      .where('notificationsEnabled', '==', true)
      .limit(500)
      .get()
    const tokens = devices.docs.map((snapshot) => snapshot.get('token') as string).filter(Boolean)
    if (tokens.length === 0) return

    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: copy,
      data: {
        type: 'ORDER_STATUS_UPDATED',
        orderId: event.params.orderId,
        status: after.status,
        deepLink: `pharmaflow://order/${event.params.orderId}`,
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    })

    logger.info('Order status notification sent', {
      orderId: event.params.orderId,
      successCount: result.successCount,
      failureCount: result.failureCount,
    })
  },
)
