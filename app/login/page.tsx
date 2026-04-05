'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2, Zap } from 'lucide-react'
import { loginAction } from '@/app/actions/auth'

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@coastaleats.com', password: 'password123', color: 'bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200', dot: 'bg-violet-400' },
  { label: 'Mgr · Harbor', email: 'manager.harbor@coastaleats.com', password: 'password123', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
  { label: 'Mgr · Downtown', email: 'manager.downtown@coastaleats.com', password: 'password123', color: 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border-cyan-200', dot: 'bg-cyan-400' },
  { label: 'Mgr · Bayfront', email: 'manager.bayfront@coastaleats.com', password: 'password123', color: 'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200', dot: 'bg-teal-400' },
  { label: 'Staff · Alice', email: 'staff.alice@coastaleats.com', password: 'password123', color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
  { label: 'Staff · Dan', email: 'staff.dan@coastaleats.com', password: 'password123', color: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function doLogin(e: string, p: string) {
    setLoading(true)
    setError('')
    const result = await loginAction(e, p)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    doLogin(email, password)
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)' }}>

      {/* Left branding panel — desktop only */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-12 text-white relative overflow-hidden">
        {/* Subtle background orbs */}
        <div className="absolute top-[-80px] left-[-80px] h-[300px] w-[300px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
        <div className="absolute bottom-[-60px] right-[-60px] h-[240px] w-[240px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-14">
            <div className="h-11 w-11 rounded-2xl flex items-center justify-center shadow-xl"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 0 24px rgba(99,102,241,0.4)' }}>
              <Zap className="h-5 w-5 fill-white text-white" />
            </div>
            <div>
              <p className="font-bold text-lg tracking-tight">ShiftSync</p>
              <p className="text-indigo-400 text-xs font-medium tracking-wide uppercase">Coastal Eats</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-5 text-white tracking-tight">
            Smarter<br />scheduling for<br />your whole team
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Multi-location shift management across time zones, with real-time updates, constraint enforcement, and fairness analytics.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          {[
            { label: 'Real-time updates', desc: 'Live shift changes via SSE' },
            { label: 'Constraint engine', desc: 'Auto-checks 10+ scheduling rules' },
            { label: 'Cross-timezone', desc: 'ET & PT handled automatically' },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-4 p-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(99,102,241,0.25)' }}>
                <div className="h-2 w-2 rounded-full bg-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{f.label}</p>
                <p className="text-xs text-slate-400">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right / mobile panel */}
      <div className="flex-1 flex flex-col min-h-screen">

        {/* Mobile hero banner */}
        <div className="lg:hidden relative overflow-hidden px-6 pt-12 pb-10 text-white"
          style={{ background: 'linear-gradient(160deg, #1e1b4b 0%, #4338ca 100%)' }}>
          {/* Decorative orb */}
          <div className="absolute top-[-60px] right-[-60px] h-48 w-48 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #818cf8, transparent)' }} />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-11 w-11 rounded-2xl flex items-center justify-center shadow-xl"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 0 20px rgba(99,102,241,0.5)' }}>
                <Zap className="h-5 w-5 fill-white text-white" />
              </div>
              <div>
                <p className="font-bold text-lg tracking-tight">ShiftSync</p>
                <p className="text-indigo-300 text-xs font-medium tracking-wide uppercase">Coastal Eats</p>
              </div>
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight mb-2">
              Smarter scheduling<br />for your whole team
            </h1>
            <p className="text-indigo-200 text-sm leading-relaxed opacity-90">
              Multi-location · Real-time · Cross-timezone
            </p>
          </div>

          {/* Feature pills */}
          <div className="relative z-10 flex flex-wrap gap-2 mt-6">
            {['Real-time updates', 'Constraint engine', 'Cross-timezone'].map((f) => (
              <span key={f} className="text-xs font-medium px-3 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Form card */}
        <div className="flex-1 flex items-start lg:items-center justify-center p-5 lg:p-12">
          <div className="w-full max-w-sm">

            {/* Card wrapper on mobile */}
            <div className="rounded-2xl p-6 lg:p-0"
              style={{ background: 'rgba(255,255,255,0.97)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

              <div className="mb-6">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Sign in</h2>
                <p className="text-slate-500 text-sm mt-0.5">Enter your credentials to continue</p>
              </div>

              {/* Login form */}
              <form onSubmit={handleSubmit} className="space-y-4 mb-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@coastaleats.com"
                    required
                    className="bg-slate-50 border-slate-200 focus:bg-white h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="bg-slate-50 border-slate-200 focus:bg-white h-11 rounded-xl"
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}
                <Button type="submit"
                  className="w-full h-11 rounded-xl font-semibold text-sm shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}
                  disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {loading ? 'Signing in…' : 'Sign In'}
                </Button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs text-slate-400 font-medium">Demo accounts</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              {/* Demo accounts */}
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    onClick={() => doLogin(acc.email, acc.password)}
                    disabled={loading}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-all active:scale-95 disabled:opacity-50 ${acc.color}`}
                  >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${acc.dot}`} />
                    <span className="truncate">{acc.label}</span>
                  </button>
                ))}
              </div>

              <p className="text-center text-[11px] text-slate-400 mt-3">
                All passwords: <span className="font-mono font-semibold text-slate-600">password123</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
