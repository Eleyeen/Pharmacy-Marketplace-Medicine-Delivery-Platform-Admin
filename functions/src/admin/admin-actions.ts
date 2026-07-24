import { getAuth } from 'firebase-admin/auth'
import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireRole } from '../core/auth'
import { db } from '../core/firebase'

const idSchema = z.object({
  id: z.string().min(1).max(256),
  reason: z.string().trim().max(500).optional(),
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

export const cancelOrder = onCall(
  { enforceAppCheck: false, timeoutSeconds: 30 },
  async (request) => {
    const admin = requireRole(request, ['admin', 'ADMIN', 'SUPER_ADMIN'])
    const parsed = idSchema.safeParse({ id: request.data?.orderId ?? request.data?.id, reason: request.data?.reason })
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Order id is required.')

    const orderRef = db.collection('orders').doc(parsed.data.id)
    await db.runTransaction(async (tx) => {
      const order = await tx.get(orderRef)
      if (!order.exists) throw new HttpsError('not-found', 'Order was not found.')
      const status = order.get('status') as string
      if (['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(status)) {
        throw new HttpsError('failed-precondition', `Cannot cancel an order in ${status} status.`)
      }

      tx.update(orderRef, {
        status: 'CANCELLED',
        cancelledAt: FieldValue.serverTimestamp(),
        cancelledBy: admin.uid,
        cancellationReason: parsed.data.reason || 'Cancelled by admin',
        updatedAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion({
          status: 'CANCELLED',
          at: new Date().toISOString(),
          note: parsed.data.reason || 'Cancelled by admin',
        }),
      })

      const paymentId = order.get('paymentId') as string | undefined
      if (paymentId) {
        tx.update(db.collection('payments').doc(paymentId), {
          status: 'CANCELLED',
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: admin.uid,
        })
      }
    })

    await writeAudit('ORDER_CANCELLED', 'orders', parsed.data.id, admin.uid, {
      reason: parsed.data.reason,
    })
    return { id: parsed.data.id, status: 'CANCELLED' }
  },
)

export const refundOrder = onCall(
  { enforceAppCheck: false, timeoutSeconds: 30 },
  async (request) => {
    const admin = requireRole(request, ['admin', 'ADMIN', 'SUPER_ADMIN'])
    const parsed = idSchema.safeParse({ id: request.data?.orderId ?? request.data?.id, reason: request.data?.reason })
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Order id is required.')

    const orderRef = db.collection('orders').doc(parsed.data.id)
    const orderSnap = await orderRef.get()
    if (!orderSnap.exists) throw new HttpsError('not-found', 'Order was not found.')

    let paymentRef = orderSnap.get('paymentId')
      ? db.collection('payments').doc(String(orderSnap.get('paymentId')))
      : null
    if (!paymentRef) {
      const payments = await db.collection('payments')
        .where('orderId', '==', parsed.data.id)
        .limit(1)
        .get()
      paymentRef = payments.empty ? null : payments.docs[0].ref
    }

    await db.runTransaction(async (tx) => {
      const order = await tx.get(orderRef)
      if (!order.exists) throw new HttpsError('not-found', 'Order was not found.')

      tx.update(orderRef, {
        status: 'REFUNDED',
        paymentStatus: 'REFUNDED',
        refundedAt: FieldValue.serverTimestamp(),
        refundedBy: admin.uid,
        refundReason: parsed.data.reason || 'Refunded by admin',
        updatedAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion({
          status: 'REFUNDED',
          at: new Date().toISOString(),
          note: parsed.data.reason || 'Refunded by admin',
        }),
      })

      if (paymentRef) {
        tx.update(paymentRef, {
          status: 'REFUNDED',
          refundedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: admin.uid,
        })
      }
    })

    await writeAudit('ORDER_REFUNDED', 'orders', parsed.data.id, admin.uid, {
      reason: parsed.data.reason,
    })
    return { id: parsed.data.id, status: 'REFUNDED', paymentStatus: 'REFUNDED' }
  },
)

export const blockUser = onCall(
  { enforceAppCheck: false, timeoutSeconds: 30 },
  async (request) => {
    const admin = requireRole(request, ['admin', 'ADMIN', 'SUPER_ADMIN'])
    const parsed = z.object({
      userId: z.string().min(1).max(128),
      blocked: z.boolean(),
      reason: z.string().trim().max(500).optional(),
    }).safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'User id is required.')

    const { userId, blocked, reason } = parsed.data
    const ref = db.collection('users').doc(userId)
    const snap = await ref.get()
    if (!snap.exists) throw new HttpsError('not-found', 'User was not found.')

    await getAuth().updateUser(userId, { disabled: blocked })
    await ref.update({
      status: blocked ? 'BLOCKED' : 'ACTIVE',
      blockReason: blocked ? (reason || '') : FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
    })
    await writeAudit(blocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED', 'users', userId, admin.uid, { reason })
    return { id: userId, status: blocked ? 'BLOCKED' : 'ACTIVE' }
  },
)

export const hideReview = onCall(
  { enforceAppCheck: false, timeoutSeconds: 30 },
  async (request) => {
    const admin = requireRole(request, ['admin', 'ADMIN', 'SUPER_ADMIN'])
    const parsed = z.object({
      reviewId: z.string().min(1).max(128),
      hidden: z.boolean().default(true),
      reason: z.string().trim().max(500).optional(),
    }).safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Review id is required.')

    const ref = db.collection('reviews').doc(parsed.data.reviewId)
    const snap = await ref.get()
    if (!snap.exists) throw new HttpsError('not-found', 'Review was not found.')

    await ref.update({
      status: parsed.data.hidden ? 'HIDDEN' : 'VISIBLE',
      moderationReason: parsed.data.reason || '',
      moderatedAt: FieldValue.serverTimestamp(),
      moderatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    })
    await writeAudit(
      parsed.data.hidden ? 'REVIEW_HIDDEN' : 'REVIEW_RESTORED',
      'reviews',
      parsed.data.reviewId,
      admin.uid,
      { reason: parsed.data.reason },
    )
    return { id: parsed.data.reviewId, status: parsed.data.hidden ? 'HIDDEN' : 'VISIBLE' }
  },
)
