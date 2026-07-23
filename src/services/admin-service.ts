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

const settledValue = <T>(result: PromiseSettledResult<T>, fallback: T) =>
  result.status === 'fulfilled' ? result.value : fallback

const getDashboard = async (): Promise<DashboardData> => {
  const orders = collection(firestore, 'orders')
  const results = await Promise.allSettled([
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

  const totalUsers = settledValue(results[0], 0)
  const totalPharmacies = settledValue(results[1], 0)
  const pendingPharmacies = settledValue(results[2], 0)
  const totalOrders = settledValue(results[3], 0)
  const completedOrders = settledValue(results[4], 0)
  const cancelledOrders = settledValue(results[5], 0)
  const activeDrivers = settledValue(results[6], 0)
  const revenueResult = settledValue(results[7], null)
  const commissionResult = settledValue(results[8], null)
  const recentSnapshot = settledValue(results[9], null)

  return {
    metrics: [
      { label: 'Total Users', value: totalUsers, change: 0, format: 'number' },
      { label: 'Total Pharmacies', value: totalPharmacies, change: 0, format: 'number' },
      { label: 'Pending Pharmacy Approvals', value: pendingPharmacies, change: 0, format: 'number' },
      { label: 'Total Orders', value: totalOrders, change: 0, format: 'number' },
      { label: 'Completed Orders', value: completedOrders, change: 0, format: 'number' },
      { label: 'Cancelled Orders', value: cancelledOrders, change: 0, format: 'number' },
      { label: 'Total Revenue', value: Number(revenueResult?.data().revenue ?? 0), change: 0, format: 'currency' },
      { label: 'Platform Commission', value: Number(commissionResult?.data().commission ?? 0), change: 0, format: 'currency' },
      { label: 'Active Drivers', value: activeDrivers, change: 0, format: 'number' },
    ],
    performance: [],
    recentOrders: recentSnapshot?.docs.map((snapshot) => {
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
    }) ?? [],
  }
}

export type CreateResourceInput = Record<string, string | number | boolean> & {
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
  const callable = httpsCallable<
    ListParams & { resource: string; pageSize: number },
    PaginatedResponse<AdminListRecord>
  >(cloudFunctions, 'adminListResource')

  const payload: ListParams & { resource: string; pageSize: number } = {
    resource,
    page: params.page,
    pageSize: 20,
  }
  if (params.search?.trim()) payload.search = params.search.trim()
  if (params.status?.trim()) payload.status = params.status.trim()

  const response = await callable(payload)
  return response.data
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
