'use client'
import { useState } from 'react'
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await loginAction(email, password)
    if (result?.error) { setError(result.error); setLoading(false) }
    // On success the server action redirects — page navigates away, no need to setLoading(false)
  }

  async function loginAs(demoEmail: string, demoPassword: string) {
    setLoading(true)
    setError('')
    const result = await loginAction(demoEmail, demoPassword)
    if (result?.error) { setError(result.error); setLoading(false) }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #f8fafc 60%, #f0fdf4 100%)' }}>
      {/* Left branding panel — hidden on small screens */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-12 text-white"
        style={{ background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)' }}>
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
              <Zap className="h-5 w-5 fill-white text-white" />
            </div>
            <div>
              <p className="font-bold text-lg tracking-tight">ShiftSync</p>
              <p className="text-indigo-300 text-xs font-medium">Coastal Eats</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold leading-tight mb-4 text-white">
            Smarter scheduling<br />for your whole team
          </h2>
          <p className="text-indigo-200 text-sm leading-relaxed">
            Multi-location shift management across time zones, with real-time updates, constraint enforcement, and fairness analytics.
          </p>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Real-time updates', desc: 'Live shift changes via SSE' },
            { label: 'Constraint engine', desc: 'Auto-checks 10+ scheduling rules' },
            { label: 'Cross-timezone', desc: 'ET & PT handled automatically' },
          ].map((f) => (
            <div key={f.label} className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-indigo-400/30 flex items-center justify-center shrink-0 mt-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{f.label}</p>
                <p className="text-xs text-indigo-300">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
              <Zap className="h-4 w-4 fill-white" />
            </div>
            <div>
              <p className="font-bold text-base">ShiftSync</p>
              <p className="text-xs text-muted-foreground">Coastal Eats</p>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
            <p className="text-muted-foreground text-sm mt-1">Enter your credentials to continue</p>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@coastaleats.com"
                required
                className="bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-white"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <Button type="submit" className="w-full shadow-sm" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Sign In
            </Button>
          </form>

          {/* Demo accounts */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium">Demo accounts</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  onClick={() => loginAs(acc.email, acc.password)}
                  disabled={loading}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors disabled:opacity-50 ${acc.color}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${acc.dot}`} />
                  <span className="truncate">{acc.label}</span>
                </button>
              ))}
            </div>
            <p className="text-center text-[11px] text-muted-foreground mt-3">All passwords: <span className="font-mono font-semibold">password123</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}
