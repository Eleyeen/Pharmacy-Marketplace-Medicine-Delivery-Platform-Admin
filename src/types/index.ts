export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATIONS' | 'FINANCE' | 'SUPPORT'

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

export interface Metric {
  label: string
  value: number
  change: number
  format: 'number' | 'currency'
}

export interface ChartPoint {
  date: string
  orders: number
  revenue: number
}

export interface RecentOrder {
  id: string
  userName: string
  pharmacyName?: string
  amount: number
  status: OrderStatus
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  createdAt: string
}

export interface DashboardData {
  metrics: Metric[]
  performance: ChartPoint[]
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

export interface ApiError {
  message: string
  code?: string
  fieldErrors?: Record<string, string>
}
