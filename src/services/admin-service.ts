import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getAggregateFromServer,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  sum,
  where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { cloudFunctions, firebaseAuth, firestore } from './firebase'
import type {
  AdminListRecord,
  AdminRole,
  AuthResponse,
  DashboardData,
  PaginatedResponse,
} from '../types'

export interface ListParams {
  page: number
  search?: string
  status?: string
}

const countCollection = (path: string, status?: { field: string; value: unknown }) => {
  const reference = collection(firestore, path)
  const target = status ? query(reference, where(status.field, '==', status.value)) : reference
  return getCountFromServer(target).then((result) => result.data().count)
}

const getDashboard = async (): Promise<DashboardData> => {
  const orders = collection(firestore, 'orders')
  const [
    totalUsers,
    totalPharmacies,
    pendingPharmacies,
    totalOrders,
    completedOrders,
    cancelledOrders,
    activeDrivers,
    revenueResult,
    commissionResult,
    recentSnapshot,
  ] = await Promise.all([
    countCollection('users'),
    countCollection('pharmacies'),
    countCollection('pharmacies', { field: 'verificationStatus', value: 'PENDING' }),
    countCollection('orders'),
    countCollection('orders', { field: 'status', value: 'DELIVERED' }),
    countCollection('orders', { field: 'status', value: 'CANCELLED' }),
    countCollection('drivers', { field: 'online', value: true }),
    getAggregateFromServer(orders, { revenue: sum('total') }),
    getAggregateFromServer(orders, { commission: sum('platformCommission') }),
    getDocs(query(orders, orderBy('createdAt', 'desc'), limit(10))),
  ])

  const revenue = revenueResult.data().revenue
  const commission = commissionResult.data().commission
  return {
    metrics: [
      { label: 'Total Users', value: totalUsers, change: 0, format: 'number' },
      { label: 'Total Pharmacies', value: totalPharmacies, change: 0, format: 'number' },
      { label: 'Pending Pharmacy Approvals', value: pendingPharmacies, change: 0, format: 'number' },
      { label: 'Total Orders', value: totalOrders, change: 0, format: 'number' },
      { label: 'Completed Orders', value: completedOrders, change: 0, format: 'number' },
      { label: 'Cancelled Orders', value: cancelledOrders, change: 0, format: 'number' },
      { label: 'Total Revenue', value: Number(revenue ?? 0), change: 0, format: 'currency' },
      { label: 'Platform Commission', value: Number(commission ?? 0), change: 0, format: 'currency' },
      { label: 'Active Drivers', value: activeDrivers, change: 0, format: 'number' },
    ],
    performance: [],
    recentOrders: recentSnapshot.docs.map((snapshot) => {
      const order = snapshot.data()
      return {
        id: snapshot.id,
        userName: order.userName ?? 'Customer',
        pharmacyName: order.pharmacyName,
        amount: Number(order.total ?? order.subtotal ?? 0),
        status: order.status ?? 'PENDING',
        paymentStatus: order.paymentStatus ?? 'PENDING',
        createdAt: order.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      }
    }),
  }
}

export type CreateResourceInput = Record<string, string | boolean> & {
  resource: 'users' | 'pharmacies' | 'medicines'
}

const normalizeRecord = (id: string, data: Record<string, unknown>): AdminListRecord => {
  const record: AdminListRecord = { id }
  Object.entries(data).forEach(([key, value]) => {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      record[key] = value as string | number | boolean | null
    } else if (typeof value === 'object' && value && 'toDate' in value) {
      record[key] = (value as { toDate: () => Date }).toDate().toISOString()
    }
  })
  return record
}

const getResource = async (
  resource: string,
  params: ListParams,
): Promise<PaginatedResponse<AdminListRecord>> => {
  const statusField = resource === 'pharmacies' ? 'verificationStatus' : 'status'
  const base = collection(firestore, resource)
  const target = params.status
    ? query(base, where(statusField, '==', params.status), limit(100))
    : query(base, limit(100))
  const snapshot = await getDocs(target)
  const search = params.search?.trim().toLowerCase()
  const filtered = snapshot.docs
    .map((item) => normalizeRecord(item.id, item.data()))
    .filter((record) => !search || Object.values(record).some(
      (value) => String(value ?? '').toLowerCase().includes(search),
    ))
  const pageSize = 20
  const start = (params.page - 1) * pageSize

  return {
    data: filtered.slice(start, start + pageSize),
    meta: {
      page: params.page,
      pageSize,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    },
  }
}

const createAdminSession = async (user: User): Promise<AuthResponse> => {
  const tokenResult = await user.getIdTokenResult(true)
  const role = tokenResult.claims.role as AdminRole | undefined
  const allowedRoles: AdminRole[] = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'FINANCE', 'SUPPORT']

  if (!role || !allowedRoles.includes(role)) {
    await signOut(firebaseAuth)
    throw new Error('This Firebase account does not have admin access.')
  }

  return {
    accessToken: tokenResult.token,
    admin: {
      id: user.uid,
      name: user.displayName ?? user.email?.split('@')[0] ?? 'Administrator',
      email: user.email ?? '',
      role,
      avatarUrl: user.photoURL ?? undefined,
    },
  }
}

export const adminService = {
  login: async (credentials: { email: string; password: string }) => {
    const credential = await signInWithEmailAndPassword(
      firebaseAuth,
      credentials.email.trim(),
      credentials.password,
    )
    return createAdminSession(credential.user)
  },

  logout: async () => {
    await signOut(firebaseAuth)
  },

  restoreSession: async () => new Promise<AuthResponse>((resolve, reject) => {
    let unsubscribe: () => void = () => {}
    unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      unsubscribe()
      if (!user) {
        reject(new Error('No active Firebase session.'))
        return
      }
      createAdminSession(user).then(resolve).catch(reject)
    }, reject)
  }),

  getDashboard,

  getResource,

  createResource: async (input: CreateResourceInput) => {
    const callable = httpsCallable<CreateResourceInput, { id: string }>(
      cloudFunctions,
      'adminCreateResource',
    )
    return (await callable(input)).data
  },

  updateResourceStatus: async (resource: string, id: string, status: string) => {
    const callable = httpsCallable<
      { resource: string; id: string; status: string },
      { id: string; status: string }
    >(cloudFunctions, 'adminUpdateResourceStatus')
    await callable({ resource, id, status })
    const updated = await getDoc(doc(firestore, resource, id))
    if (!updated.exists()) throw new Error('The updated record could not be loaded.')
    return normalizeRecord(updated.id, updated.data())
  },
}
