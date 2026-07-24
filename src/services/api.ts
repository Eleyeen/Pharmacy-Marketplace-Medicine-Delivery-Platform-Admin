import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { FirebaseError } from 'firebase/app'
import { useAuthStore } from '../store/auth-store'
import type { ApiError } from '../types'
import { firebaseAuth } from './firebase'

const baseURL = import.meta.env.VITE_API_URL

export const api = axios.create({
  baseURL: baseURL ?? '/api/v1',
  timeout: 15_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshPromise: Promise<string> | null = null

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const user = firebaseAuth.currentUser
      const admin = useAuthStore.getState().admin
      if (!user || !admin) throw new Error('Your session has expired.')
      const token = await user.getIdToken(true)
      useAuthStore.getState().setSession(token, admin)
      return token
    })()
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const request = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
  const isAuthenticationRequest = request?.url?.includes('/auth/')
  if (error.response?.status === 401 && request && !request._retried && !isAuthenticationRequest) {
    request._retried = true
    try {
      request.headers.Authorization = `Bearer ${await refreshAccessToken()}`
      return api(request)
    } catch {
      useAuthStore.getState().clearSession()
    }
  }
  return Promise.reject(error)
})

export const getErrorMessage = (error: unknown) => {
  if (error instanceof FirebaseError) {
    if (error.code === 'auth/invalid-credential') return 'Incorrect email or password.'
    if (error.code === 'auth/user-not-found') return 'No account found for that email.'
    if (error.code === 'auth/invalid-email') return 'Enter a valid email address.'
    if (error.code === 'auth/too-many-requests') return 'Too many attempts. Try again later.'
    if (error.code === 'auth/network-request-failed') return 'Check your internet connection.'
    if (error.code === 'functions/already-exists') return 'An account with this email already exists.'
    if (error.code === 'functions/invalid-argument') return error.message
    if (error.code === 'functions/failed-precondition') return error.message
    if (error.code === 'functions/permission-denied') return 'Your admin account cannot perform this action.'
    if (error.code === 'functions/not-found') return 'The requested record was not found.'
    return error.message || 'Firebase could not complete the request.'
  }
  if (axios.isAxiosError<ApiError>(error)) {
    return error.response?.data?.message ?? 'The service is temporarily unavailable.'
  }
  return error instanceof Error ? error.message : 'Something went wrong.'
}
