'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2, Zap } from 'lucide-react'
import { loginAction } from '@/app/actions/auth'

const DEMO_ACCOUNTS = [
  { label: 'Admin',        email: 'admin@coastaleats.com',           password: 'password123', color: 'bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200', dot: 'bg-violet-400' },
  { label: 'Mgr · Harbor',   email: 'manager.harbor@coastaleats.com',  password: 'password123', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200',     dot: 'bg-blue-400'   },
  { label: 'Mgr · Downtown', email: 'manager.downtown@coastaleats.com',password: 'password123', color: 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border-cyan-200',     dot: 'bg-cyan-400'   },
  { label: 'Mgr · Bayfront', email: 'manager.bayfront@coastaleats.com',password: 'password123', color: 'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200',     dot: 'bg-teal-400'   },
  { label: 'Staff · Alice',  email: 'staff.alice@coastaleats.com',     password: 'password123', color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
  { label: 'Staff · Dan',    email: 'staff.dan@coastaleats.com',       password: 'password123', color: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200',  dot: 'bg-amber-400'  },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function doLogin(e: string, p: string) {
    setLoading(true)
    setError('')
    const result = await loginAction(e, p)
    if (result?.error) { setError(result.error); setLoading(false) }
    else { router.push('/dashboard'); router.refresh() }
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    doLogin(email, password)
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #312e81 100%)' }}>

      {/* Background decorative orbs */}
      <div className="absolute top-[-120px] left-[-120px] h-[500px] w-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)' }} />
      <div className="absolute bottom-[-100px] right-[-80px] h-[400px] w-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15), transparent 70%)' }} />
      <div className="absolute top-[40%] right-[25%] h-[200px] w-[200px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(67,56,202,0.2), transparent 70%)' }} />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-[900px] mx-4 rounded-3xl overflow-hidden flex shadow-2xl"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)' }}>

        {/* Left branding panel — desktop only */}
        <div className="hidden lg:flex flex-col justify-between w-[380px] shrink-0 p-10 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)' }}>

          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-60px] left-[-60px] h-[280px] w-[280px] rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.3), transparent 70%)' }} />
            <div className="absolute bottom-[-40px] right-[-40px] h-[200px] w-[200px] rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.2), transparent 70%)' }} />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-10">
              <div className="h-11 w-11 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.08))', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}>
                <Zap className="h-5 w-5 fill-white text-white" />
              </div>
              <div>
                <p className="font-bold text-lg tracking-tight leading-none">ShiftSync</p>
                <p className="text-indigo-300 text-[11px] font-medium tracking-widest uppercase mt-0.5">Coastal Eats</p>
              </div>
            </div>

            <h2 className="text-[2rem] font-bold leading-[1.15] tracking-tight mb-4 text-white">
              Smarter<br />scheduling for<br />your whole team
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Multi-location shift management across time zones, with real-time updates and fairness analytics.
            </p>
          </div>

          <div className="relative z-10 space-y-3">
            {[
              { icon: '⚡', label: 'Real-time updates', desc: 'Live shift changes via SSE' },
              { icon: '🔒', label: 'Constraint engine', desc: 'Auto-checks 10+ scheduling rules' },
              { icon: '🌍', label: 'Cross-timezone',    desc: 'ET & PT handled automatically' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="text-base shrink-0">{f.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-white leading-none">{f.label}</p>
                  <p className="text-xs text-indigo-300 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right form panel */}
        <div className="flex-1 flex flex-col" style={{ background: '#ffffff' }}>

          {/* Mobile hero — hidden on desktop */}
          <div className="lg:hidden relative overflow-hidden px-6 pt-10 pb-8 text-white"
            style={{ background: 'linear-gradient(160deg, #1e1b4b 0%, #4338ca 100%)' }}>
            <div className="absolute top-[-50px] right-[-50px] h-40 w-40 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(129,140,248,0.3), transparent)' }} />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.08))', border: '1px solid rgba(255,255,255,0.25)' }}>
                  <Zap className="h-4 w-4 fill-white text-white" />
                </div>
                <div>
                  <p className="font-bold text-base leading-none">ShiftSync</p>
                  <p className="text-indigo-300 text-[10px] tracking-widest uppercase mt-0.5">Coastal Eats</p>
                </div>
              </div>
              <h1 className="text-2xl font-bold leading-tight tracking-tight mb-1">
                Smarter scheduling<br />for your whole team
              </h1>
              <p className="text-indigo-200 text-xs opacity-80">Multi-location · Real-time · Cross-timezone</p>
            </div>
            <div className="relative z-10 flex flex-wrap gap-2 mt-5">
              {['Real-time', 'Constraint engine', 'Cross-timezone'].map((f) => (
                <span key={f} className="text-[11px] font-medium px-3 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Form area */}
          <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
            <div className="w-full max-w-sm">

              {/* Desktop heading — shown inside white panel */}
              <div className="hidden lg:block mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
                <p className="text-slate-500 text-sm mt-1">Sign in to your ShiftSync account</p>
              </div>

              {/* Mobile heading */}
              <div className="lg:hidden mb-6">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Sign in</h2>
                <p className="text-slate-500 text-sm mt-0.5">Enter your credentials to continue</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 mb-6">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@coastaleats.com"
                    required
                    className="h-11 rounded-xl bg-slate-50 border-slate-200 focus:bg-white text-sm"
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
                    className="h-11 rounded-xl bg-slate-50 border-slate-200 focus:bg-white text-sm"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl font-semibold text-sm text-white border-0"
                  style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {loading ? 'Signing in…' : 'Sign In'}
                </Button>
              </form>

              {/* Demo accounts */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-[11px] text-slate-400 font-medium px-1">Demo accounts</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    onClick={() => doLogin(acc.email, acc.password)}
                    disabled={loading}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-all hover:shadow-sm active:scale-[0.98] disabled:opacity-50 ${acc.color}`}
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
