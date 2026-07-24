import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { cloudFunctions, firebaseAuth, firebaseStorage, firestore } from './firebase'
import type {
  AdminListRecord,
  AdminRole,
  AuthResponse,
  DashboardData,
  Medicine,
  MedicineCategory,
  Order,
  OrderItem,
  PaginatedResponse,
  Pharmacy,
  Review,
  AppUser,
  StatusEvent,
} from '../types'

export interface ListParams {
  page: number
  search?: string
  status?: string
  pageSize?: number
}

const ADMIN_ROLES: AdminRole[] = ['admin', 'ADMIN', 'SUPER_ADMIN']

const countCollection = (path: string, filters: QueryConstraint[] = []) => {
  const reference = collection(firestore, path)
  const target = filters.length ? query(reference, ...filters) : reference
  return getCountFromServer(target).then((result) => result.data().count)
}

const settledValue = <T>(result: PromiseSettledResult<T>, fallback: T) =>
  result.status === 'fulfilled' ? result.value : fallback

const toIso = (value: unknown) => {
  if (!value) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  return undefined
}

const mapPharmacy = (id: string, data: DocumentData): Pharmacy => ({
  id,
  name: String(data.name ?? ''),
  normalizedName: data.normalizedName,
  ownerUid: data.ownerUid,
  ownerName: String(data.ownerName ?? ''),
  ownerEmail: data.email,
  phone: String(data.phone ?? ''),
  cnic: data.cnic,
  licenseNumber: String(data.licenseNumber ?? ''),
  licenseDocumentUrl: data.licenseDocumentUrl,
  documents: data.documents,
  address: String(data.address ?? ''),
  city: String(data.city ?? ''),
  latitude: typeof data.latitude === 'number' ? data.latitude : data.location?.latitude,
  longitude: typeof data.longitude === 'number' ? data.longitude : data.location?.longitude,
  verificationStatus: data.verificationStatus ?? 'PENDING',
  status: data.status ?? 'PENDING',
  rating: Number(data.rating ?? 0),
  reviewCount: Number(data.reviewCount ?? 0),
  totalOrders: Number(data.totalOrders ?? 0),
  deliveryMode: data.deliveryMode,
  deliveryEnabled: data.deliveryEnabled,
  pickupEnabled: data.pickupEnabled,
  businessHours: data.businessHours,
  rejectionReason: data.rejectionReason,
  documentsRequestedNote: data.documentsRequestedNote,
  createdAt: toIso(data.createdAt),
  updatedAt: toIso(data.updatedAt),
})

const mapOrderItems = (items: unknown): OrderItem[] => {
  if (!Array.isArray(items)) return []
  return items.map((item) => ({
    medicineId: String(item.medicineId ?? ''),
    medicineName: item.medicineName ?? item.name,
    quantity: Number(item.quantity ?? 0),
    unitPrice: item.unitPrice !== undefined ? Number(item.unitPrice) : undefined,
    lineTotal: item.lineTotal !== undefined
      ? Number(item.lineTotal)
      : Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0),
  }))
}

const mapStatusHistory = (history: unknown): StatusEvent[] => {
  if (!Array.isArray(history)) return []
  return history.map((event) => ({
    status: String(event.status ?? ''),
    at: toIso(event.at) ?? String(event.at ?? ''),
    note: event.note,
  }))
}

const mapOrder = (id: string, data: DocumentData): Order => ({
  id,
  userId: String(data.userId ?? ''),
  userName: String(data.userName ?? 'Customer'),
  userPhone: data.userPhone,
  userEmail: data.userEmail,
  pharmacyId: data.pharmacyId,
  pharmacyName: data.pharmacyName,
  pharmacyPhone: data.pharmacyPhone,
  items: mapOrderItems(data.items ?? data.confirmedItems),
  subtotal: data.subtotal !== undefined ? Number(data.subtotal) : undefined,
  deliveryFee: data.deliveryFee !== undefined ? Number(data.deliveryFee) : undefined,
  total: Number(data.total ?? data.subtotal ?? 0),
  status: data.status ?? 'PENDING',
  paymentStatus: data.paymentStatus ?? 'PENDING',
  deliveryType: data.deliveryType,
  statusHistory: mapStatusHistory(data.statusHistory),
  createdAt: toIso(data.createdAt) ?? new Date().toISOString(),
  updatedAt: toIso(data.updatedAt),
})

const mapUser = (id: string, data: DocumentData): AppUser => ({
  id,
  name: String(data.name ?? ''),
  email: String(data.email ?? ''),
  phone: String(data.phone ?? ''),
  totalOrders: Number(data.totalOrders ?? 0),
  status: data.status ?? 'ACTIVE',
  createdAt: toIso(data.createdAt),
  addresses: Array.isArray(data.addresses)
    ? data.addresses.map((address: DocumentData, index: number) => ({
        id: String(address.id ?? index),
        label: address.label,
        line1: String(address.line1 ?? address.address ?? ''),
        city: address.city,
      }))
    : undefined,
})

const mapMedicine = (id: string, data: DocumentData): Medicine => ({
  id,
  name: String(data.name ?? ''),
  genericName: String(data.genericName ?? ''),
  brand: String(data.brand ?? ''),
  categoryId: String(data.categoryId ?? ''),
  categoryName: data.categoryName,
  strength: String(data.strength ?? ''),
  form: data.form ?? 'OTHER',
  requiresPrescription: Boolean(data.requiresPrescription),
  description: data.description,
  imageUrl: data.imageUrl,
  status: data.status ?? 'ACTIVE',
  createdAt: toIso(data.createdAt),
  updatedAt: toIso(data.updatedAt),
})

const mapReview = (id: string, data: DocumentData): Review => ({
  id,
  userId: data.userId,
  userName: String(data.userName ?? 'Customer'),
  pharmacyId: data.pharmacyId,
  pharmacyName: String(data.pharmacyName ?? 'Pharmacy'),
  orderId: data.orderId,
  rating: Number(data.rating ?? 0),
  comment: String(data.comment ?? data.text ?? ''),
  status: data.status ?? 'VISIBLE',
  createdAt: toIso(data.createdAt),
})

const startOfToday = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

const IN_PROGRESS = [
  'PENDING',
  'SEARCHING_PHARMACY',
  'PHARMACY_REQUESTED',
  'PHARMACY_CHECKING',
  'PHARMACY_CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'DRIVER_ASSIGNED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
]

const getDashboard = async (): Promise<DashboardData> => {
  const orders = collection(firestore, 'orders')
  const results = await Promise.allSettled([
    countCollection('pharmacies'),
    countCollection('pharmacies', [where('verificationStatus', '==', 'PENDING')]),
    countCollection('pharmacies', [where('status', '==', 'ACTIVE')]),
    countCollection('orders'),
    countCollection('orders', [where('createdAt', '>=', startOfToday())]),
    getDocs(query(orders, where('status', 'in', IN_PROGRESS.slice(0, 10)), limit(500))),
    getDocs(query(orders, orderBy('createdAt', 'desc'), limit(10))),
  ])

  const totalPharmacies = settledValue(results[0], 0)
  const pendingPharmacies = settledValue(results[1], 0)
  const activePharmacies = settledValue(results[2], 0)
  const totalOrders = settledValue(results[3], 0)
  const ordersToday = settledValue(results[4], 0)
  const inProgressSnap = settledValue(results[5], null)
  const recentSnapshot = settledValue(results[6], null)

  return {
    metrics: [
      { label: 'Total Pharmacies', value: totalPharmacies, format: 'number' },
      { label: 'Pending Pharmacy Approvals', value: pendingPharmacies, format: 'number' },
      { label: 'Active Pharmacies', value: activePharmacies, format: 'number' },
      { label: 'Orders Today', value: ordersToday, format: 'number', hint: 'Created since midnight' },
      { label: 'Orders All-time', value: totalOrders, format: 'number' },
      { label: 'Orders In Progress', value: inProgressSnap?.size ?? 0, format: 'number' },
    ],
    recentOrders: recentSnapshot?.docs.map((snapshot) => {
      const order = snapshot.data()
      return {
        id: snapshot.id,
        userName: order.userName ?? 'Customer',
        pharmacyName: order.pharmacyName,
        amount: Number(order.total ?? order.subtotal ?? 0),
        status: order.status ?? 'PENDING',
        paymentStatus: order.paymentStatus ?? 'PENDING',
        createdAt: toIso(order.createdAt) ?? new Date().toISOString(),
      }
    }) ?? [],
  }
}

export type CreateResourceInput = Record<string, string | number | boolean | object | undefined> & {
  resource: 'users' | 'pharmacies' | 'medicines'
}

const createAdminSession = async (user: User): Promise<AuthResponse> => {
  const tokenResult = await user.getIdTokenResult(true)
  const role = tokenResult.claims.role as AdminRole | undefined

  if (!role || !ADMIN_ROLES.includes(role)) {
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

const call = <TReq, TRes>(name: string, data: TReq) =>
  httpsCallable<TReq, TRes>(cloudFunctions, name)(data).then((result) => result.data)

export const adminService = {
  login: async (credentials: { email: string; password: string }) => {
    const credential = await signInWithEmailAndPassword(
      firebaseAuth,
      credentials.email.trim(),
      credentials.password,
    )
    return createAdminSession(credential.user)
  },

  sendPasswordReset: async (email: string) => {
    await sendPasswordResetEmail(firebaseAuth, email.trim())
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

  getResource: async (
    resource: string,
    params: ListParams,
  ): Promise<PaginatedResponse<AdminListRecord>> => {
    const payload: ListParams & { resource: string; pageSize: number } = {
      resource,
      page: params.page,
      pageSize: params.pageSize ?? 20,
    }
    if (params.search?.trim()) payload.search = params.search.trim()
    if (params.status?.trim()) payload.status = params.status.trim()
    return call('adminListResource', payload)
  },

  createResource: async (input: CreateResourceInput) =>
    call<CreateResourceInput, { id: string }>('adminCreateResource', input),

  getPharmacy: async (id: string) => {
    const snapshot = await getDoc(doc(firestore, 'pharmacies', id))
    if (!snapshot.exists()) throw new Error('Pharmacy was not found.')
    return mapPharmacy(snapshot.id, snapshot.data())
  },

  updatePharmacy: async (id: string, data: Partial<Pharmacy> & Record<string, unknown>) => {
    const { id: _id, createdAt: _c, updatedAt: _u, documents: _d, ...payload } = data
    await updateDoc(doc(firestore, 'pharmacies', id), {
      ...payload,
      ...(payload.name ? { normalizedName: String(payload.name).trim().toLocaleLowerCase() } : {}),
      updatedAt: serverTimestamp(),
    })
    return adminService.getPharmacy(id)
  },

  approvePharmacy: (pharmacyId: string) => call('approvePharmacy', { pharmacyId }),
  rejectPharmacy: (pharmacyId: string, reason: string) =>
    call('rejectPharmacy', { pharmacyId, reason }),
  requestPharmacyDocuments: (pharmacyId: string, note: string) =>
    call('requestPharmacyDocuments', { pharmacyId, note }),
  suspendPharmacy: (pharmacyId: string, reason?: string) =>
    call('suspendPharmacy', { pharmacyId, reason }),
  reactivatePharmacy: (pharmacyId: string) => call('reactivatePharmacy', { pharmacyId }),

  getPharmacyOrders: async (pharmacyId: string) => {
    const snapshot = await getDocs(
      query(
        collection(firestore, 'orders'),
        where('pharmacyId', '==', pharmacyId),
        orderBy('createdAt', 'desc'),
        limit(50),
      ),
    )
    return snapshot.docs.map((item) => mapOrder(item.id, item.data()))
  },

  getPharmacyReviews: async (pharmacyId: string) => {
    const snapshot = await getDocs(
      query(
        collection(firestore, 'reviews'),
        where('pharmacyId', '==', pharmacyId),
        orderBy('createdAt', 'desc'),
        limit(50),
      ),
    )
    return snapshot.docs.map((item) => mapReview(item.id, item.data()))
  },

  getOrder: async (id: string) => {
    const snapshot = await getDoc(doc(firestore, 'orders', id))
    if (!snapshot.exists()) throw new Error('Order was not found.')
    return mapOrder(snapshot.id, snapshot.data())
  },

  cancelOrder: (orderId: string, reason?: string) => call('cancelOrder', { orderId, reason }),
  refundOrder: (orderId: string, reason?: string) => call('refundOrder', { orderId, reason }),

  getUser: async (id: string) => {
    const snapshot = await getDoc(doc(firestore, 'users', id))
    if (!snapshot.exists()) throw new Error('User was not found.')
    const user = mapUser(snapshot.id, snapshot.data())
    if (!user.addresses) {
      const addresses = await getDocs(collection(firestore, 'users', id, 'addresses'))
      user.addresses = addresses.docs.map((item) => {
        const data = item.data()
        return {
          id: item.id,
          label: data.label,
          line1: String(data.line1 ?? data.address ?? ''),
          city: data.city,
        }
      })
    }
    return user
  },

  getUserOrders: async (userId: string) => {
    const snapshot = await getDocs(
      query(
        collection(firestore, 'orders'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50),
      ),
    )
    return snapshot.docs.map((item) => mapOrder(item.id, item.data()))
  },

  blockUser: (userId: string, blocked: boolean, reason?: string) =>
    call('blockUser', { userId, blocked, reason }),

  getMedicine: async (id: string) => {
    const snapshot = await getDoc(doc(firestore, 'medicines', id))
    if (!snapshot.exists()) throw new Error('Medicine was not found.')
    return mapMedicine(snapshot.id, snapshot.data())
  },

  saveMedicine: async (id: string | null, data: Omit<Medicine, 'id' | 'createdAt' | 'updatedAt'>) => {
    const payload = {
      name: data.name,
      normalizedName: data.name.trim().toLocaleLowerCase(),
      genericName: data.genericName,
      normalizedGenericName: data.genericName.trim().toLocaleLowerCase(),
      brand: data.brand,
      categoryId: data.categoryId,
      categoryName: data.categoryName ?? '',
      strength: data.strength,
      form: data.form,
      requiresPrescription: data.requiresPrescription,
      description: data.description ?? '',
      imageUrl: data.imageUrl ?? '',
      status: data.status,
      updatedAt: serverTimestamp(),
    }
    if (id) {
      await updateDoc(doc(firestore, 'medicines', id), payload)
      return id
    }
    const reference = doc(collection(firestore, 'medicines'))
    await setDoc(reference, { ...payload, createdAt: serverTimestamp() })
    return reference.id
  },

  deleteMedicine: async (id: string) => {
    await deleteDoc(doc(firestore, 'medicines', id))
  },

  listCategories: async (): Promise<MedicineCategory[]> => {
    const snapshot = await getDocs(query(collection(firestore, 'medicineCategories'), orderBy('name')))
    return snapshot.docs.map((item) => ({
      id: item.id,
      name: String(item.data().name ?? ''),
      normalizedName: item.data().normalizedName,
      status: item.data().status ?? 'ACTIVE',
    }))
  },

  saveCategory: async (id: string | null, name: string) => {
    const payload = {
      name: name.trim(),
      normalizedName: name.trim().toLocaleLowerCase(),
      status: 'ACTIVE' as const,
      updatedAt: serverTimestamp(),
    }
    if (id) {
      await updateDoc(doc(firestore, 'medicineCategories', id), payload)
      return id
    }
    const created = await addDoc(collection(firestore, 'medicineCategories'), {
      ...payload,
      createdAt: serverTimestamp(),
    })
    return created.id
  },

  deleteCategory: async (id: string) => {
    await deleteDoc(doc(firestore, 'medicineCategories', id))
  },

  hideReview: (reviewId: string, hidden = true, reason?: string) =>
    call('hideReview', { reviewId, hidden, reason }),

  uploadDocument: async (path: string, file: File) => {
    const storageRef = ref(firebaseStorage, path)
    await uploadBytes(storageRef, file, { contentType: file.type })
    return getDownloadURL(storageRef)
  },
}
