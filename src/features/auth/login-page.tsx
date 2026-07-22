import { useCallback, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, LockKeyhole, Pill, ShieldCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '../../components/ui'
import { adminService } from '../../services/admin-service'
import { getErrorMessage } from '../../services/api'
import { useAuthStore } from '../../store/auth-store'

const schema = z.object({
  email: z.email('Enter a valid work email'),
  password: z.string().min(8, 'Password must contain at least 8 characters'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const admin = useAuthStore((state) => state.admin)
  const setSession = useAuthStore((state) => state.setSession)
  const navigate = useNavigate()
  const location = useLocation()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = useCallback(async (values: FormValues) => {
    try {
      const session = await adminService.login(values)
      setSession(session.accessToken, session.admin)
      toast.success(`Welcome back, ${session.admin.name}`)
      const destination = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(destination, { replace: true })
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }, [location.state, navigate, setSession])

  if (admin) return <Navigate to="/" replace />

  return (
    <main className="login-page">
      <section className="login-showcase">
        <div className="brand brand--light">
          <span className="brand__mark"><Pill size={21} /></span>
          <div><strong>Pharma<span>Flow</span></strong><small>ADMIN CONSOLE</small></div>
        </div>
        <div className="login-showcase__content">
          <span className="eyebrow"><ShieldCheck size={15} /> Secure operations platform</span>
          <h1>Healthcare operations,<br /><em>beautifully managed.</em></h1>
          <p>One trusted workspace for pharmacy verification, order oversight, payments, and marketplace growth.</p>
        </div>
        <div className="login-trust"><LockKeyhole size={17} /><span><strong>Enterprise-grade security</strong>Protected by encrypted sessions and role-based access.</span></div>
      </section>
      <section className="login-panel">
        <div className="login-form">
          <span className="login-form__icon"><ShieldCheck /></span>
          <h2>Welcome back</h2>
          <p>Sign in to your administration workspace.</p>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <label>
              Work email
              <input {...register('email')} type="email" autoComplete="email" placeholder="admin@pharmaflow.com" />
              {errors.email && <small className="field-error">{errors.email.message}</small>}
            </label>
            <label>
              <span className="label-row">Password<button type="button" onClick={() => toast.info('Password recovery requires the backend email service.')}>Forgot password?</button></span>
              <span className="password-field">
                <input {...register('password')} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </span>
              {errors.password && <small className="field-error">{errors.password.message}</small>}
            </label>
            <Button type="submit" loading={isSubmitting}>Sign in securely</Button>
          </form>
          <small className="login-help">Having trouble? Contact your system administrator.</small>
        </div>
      </section>
    </main>
  )
}
