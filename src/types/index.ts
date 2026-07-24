export type AdminRole = 'admin' | 'ADMIN' | 'SUPER_ADMIN'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: AdminRole
  avatarUrl?: string
}

export interface AuthResponse {
  accessToken: string
  admin: AdminUser
}

/** Canonical Firestore order statuses (shared with mobile apps). */
export type OrderStatus =
  | 'PENDING'
  | 'SEARCHING_PHARMACY'
  | 'PHARMACY_REQUESTED'
  | 'PHARMACY_CHECKING'
  | 'PHARMACY_CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'DRIVER_ASSIGNED'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED'

/** Simplified admin UI filter labels → underlying statuses. */
export const ORDER_STATUS_FILTERS = [
  { label: 'Searching', value: 'SEARCHING', statuses: ['PENDING', 'SEARCHING_PHARMACY', 'PHARMACY_REQUESTED', 'PHARMACY_CHECKING'] },
  { label: 'Confirmed', value: 'CONFIRMED', statuses: ['PHARMACY_CONFIRMED'] },
  { label: 'Preparing', value: 'PREPARING', statuses: ['PREPARING'] },
  { label: 'Ready', value: 'READY', statuses: ['READY_FOR_PICKUP'] },
  { label: 'Out for Delivery', value: 'OUT_FOR_DELIVERY', statuses: ['DRIVER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'] },
  { label: 'Delivered', value: 'DELIVERED', statuses: ['DELIVERED'] },
  { label: 'Cancelled', value: 'CANCELLED', statuses: ['CANCELLED'] },
  { label: 'Refunded', value: 'REFUNDED', statuses: ['REFUNDED'] },
] as const

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
export type PharmacyStatus = 'ACTIVE' | 'BLOCKED' | 'PENDING'
export type UserStatus = 'ACTIVE' | 'BLOCKED'
export type MedicineStatus = 'ACTIVE' | 'INACTIVE'
export type MedicineForm = 'TABLET' | 'CAPSULE' | 'SYRUP' | 'INJECTION' | 'CREAM' | 'OTHER'
export type ReviewStatus = 'VISIBLE' | 'HIDDEN' | 'FLAGGED'
export type DeliveryMode = 'OWN_RIDER' | 'PICKUP_ONLY'

export interface BusinessHours {
  open: string
  close: string
  closed: boolean
}

export interface Metric {
  label: string
  value: number
  format: 'number' | 'currency'
  hint?: string
}

export interface RecentOrder {
  id: string
  userName: string
  pharmacyName?: string
  amount: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  createdAt: string
}

export interface DashboardData {
  metrics: Metric[]
  recentOrders: RecentOrder[]
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface AdminListRecord {
  id: string
  [key: string]: string | number | boolean | null | undefined
}

export interface PharmacyDocument {
  type: 'LICENSE' | 'CNIC' | 'OTHER'
  url: string
  fileName?: string
  uploadedAt?: string
}

export interface Pharmacy {
  id: string
  name: string
  normalizedName?: string
  ownerUid?: string
  ownerName: string
  ownerEmail?: string
  phone: string
  cnic?: string
  licenseNumber: string
  licenseDocumentUrl?: string
  documents?: PharmacyDocument[]
  address: string
  city: string
  latitude?: number
  longitude?: number
  verificationStatus: VerificationStatus
  status: PharmacyStatus
  rating?: number
  reviewCount?: number
  totalOrders?: number
  deliveryMode?: DeliveryMode
  deliveryEnabled?: boolean
  pickupEnabled?: boolean
  businessHours?: Record<string, BusinessHours>
  rejectionReason?: string
  documentsRequestedNote?: string
  createdAt?: string
  updatedAt?: string
}

export interface OrderItem {
  medicineId: string
  medicineName?: string
  quantity: number
  unitPrice?: number
  lineTotal?: number
}

export interface StatusEvent {
  status: string
  at: string
  note?: string
}

export interface Order {
  id: string
  userId: string
  userName: string
  userPhone?: string
  userEmail?: string
  pharmacyId?: string
  pharmacyName?: string
  pharmacyPhone?: string
  items: OrderItem[]
  subtotal?: number
  deliveryFee?: number
  total: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  deliveryType?: 'DELIVERY' | 'PICKUP'
  statusHistory?: StatusEvent[]
  createdAt: string
  updatedAt?: string
}

export interface AppUser {
  id: string
  name: string
  email: string
  phone: string
  totalOrders?: number
  status: UserStatus
  createdAt?: string
  addresses?: Array<{
    id: string
    label?: string
    line1: string
    city?: string
  }>
}

export interface Medicine {
  id: string
  name: string
  genericName: string
  brand: string
  categoryId: string
  categoryName?: string
  strength: string
  form: MedicineForm | string
  requiresPrescription: boolean
  description?: string
  imageUrl?: string
  status: MedicineStatus
  createdAt?: string
  updatedAt?: string
}

export interface MedicineCategory {
  id: string
  name: string
  normalizedName?: string
  status?: MedicineStatus
}

export interface Review {
  id: string
  userId?: string
  userName: string
  pharmacyId?: string
  pharmacyName: string
  orderId?: string
  rating: number
  comment: string
  status: ReviewStatus
  createdAt?: string
}

export interface ApiError {
  message: string
  code?: string
  fieldErrors?: Record<string, string>
}
