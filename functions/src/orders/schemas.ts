import { z } from 'zod'

export const orderItemSchema = z.object({
  medicineId: z.string().min(1).max(128),
  quantity: z.number().int().min(1).max(99),
  prescriptionId: z.string().min(1).max(128).optional(),
})

export const createOrderSchema = z.object({
  idempotencyKey: z.string().min(16).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  items: z.array(orderItemSchema).min(1).max(50),
  addressId: z.string().min(1).max(128),
  deliveryType: z.enum(['DELIVERY', 'PICKUP']),
  paymentMethod: z.enum(['CASH_ON_DELIVERY', 'CARD', 'WALLET']),
})

export const acceptOrderSchema = z.object({
  orderId: z.string().min(1).max(128),
  requestId: z.string().min(1).max(256),
  confirmedItems: z.array(z.object({
    medicineId: z.string().min(1).max(128),
    quantity: z.number().int().min(1).max(99),
    unitPrice: z.number().nonnegative().finite(),
  })).min(1).max(50),
})
