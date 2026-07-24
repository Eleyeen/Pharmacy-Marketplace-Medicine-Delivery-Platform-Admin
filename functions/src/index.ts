import { setGlobalOptions } from 'firebase-functions/v2'

setGlobalOptions({
  region: 'asia-south1',
  maxInstances: 10,
  concurrency: 40,
  memory: '256MiB',
})

export { createOrder } from './orders/create-order'
export { dispatchOrderToPharmacies } from './orders/dispatch-order'
export { acceptPharmacyOrder } from './orders/accept-order'
export { sendOrderStatusNotification } from './notifications/order-notifications'
export { adminCreateResource } from './admin/manage-resources'
export {
  approvePharmacy,
  rejectPharmacy,
  requestPharmacyDocuments,
  suspendPharmacy,
  reactivatePharmacy,
} from './admin/manage-resources'
export {
  cancelOrder,
  refundOrder,
  blockUser,
  hideReview,
} from './admin/admin-actions'
export { adminListResource } from './admin/list-resources'
