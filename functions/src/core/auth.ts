import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'

export type AppRole = 'USER' | 'PHARMACY' | 'DRIVER' | 'admin' | 'ADMIN' | 'SUPER_ADMIN'

interface AuthContext {
  uid: string
  role: AppRole
  pharmacyId?: string
}

export function requireAuth(request: CallableRequest<unknown>): AuthContext {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication is required.')
  }

  const role = request.auth.token.role as AppRole | undefined
  if (!role) {
    throw new HttpsError('permission-denied', 'Your account does not have an application role.')
  }

  return {
    uid: request.auth.uid,
    role,
    pharmacyId: request.auth.token.pharmacyId as string | undefined,
  }
}

export function requireRole(
  request: CallableRequest<unknown>,
  allowedRoles: AppRole[],
): AuthContext {
  const context = requireAuth(request)
  if (!allowedRoles.includes(context.role)) {
    throw new HttpsError('permission-denied', 'You cannot perform this action.')
  }
  return context
}
