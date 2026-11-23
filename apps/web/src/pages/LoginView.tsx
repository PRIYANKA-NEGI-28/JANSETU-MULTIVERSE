import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Mail, AlertTriangle, Loader, LogIn, Shield, User, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import ScrollReveal from '../components/ScrollReveal.js';
import type { Role } from '@jansetu/shared';

export default function LoginView() {
  const { login, switchDemoRole, error, clearError, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError('');
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate(redirectPath, { replace: true });
    } catch (err: unknown) {
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please try again.';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectDemo = (role: Role) => {
    switchDemoRole(role);
    navigate(redirectPath, { replace: true });
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <ScrollReveal direction="down" delay={50}>
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25 transition-transform duration-300 hover:rotate-6">
                <span className="text-white font-black text-2xl tracking-tighter">JS</span>
              </div>
              <div className="text-left">
                <h1 className="font-black text-3xl text-gray-900 tracking-tight">JanSetu</h1>
                <span className="text-xs text-orange-600 font-extrabold uppercase tracking-widest block">
                  Multiverse Platform
                </span>
              </div>
            </div>
            <p className="text-gray-600 text-sm">
              Sign in to access grievance tracking, RTI drafting, and civic intelligence
            </p>
          </div>
        </ScrollReveal>

        {/* Login Card */}
        <ScrollReveal direction="up" delay={150}>
          <div
            className={`bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-2xl ${
              shouldShake ? 'animate-shake' : ''
            }`}
          >
            {/* Saffron Card Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-4.5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={18} className="animate-pulse" />
                <span className="font-bold text-xs uppercase tracking-wider">Secure Access Portal</span>
              </div>
              <span className="text-[11px] font-semibold bg-white/20 px-2.5 py-0.5 rounded-full">v2.0</span>
            </div>

            <form onSubmit={handleSubmit} className="p-7 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Email or Username
                </label>
                <div className="relative group">
                  <Mail
                    size={16}
                    className="absolute left-3.5 top-3.5 text-gray-400 transition-colors group-focus-within:text-orange-500"
                  />
                  <input
                    type="text"
                    placeholder="e.g. citizen@jansetu.gov.in or citizen"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 input-premium transition-all"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative group">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-3.5 text-gray-400 transition-colors group-focus-within:text-orange-500"
                  />
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 input-premium transition-all"
                    required
                  />
                </div>
              </div>

              {(localError || error) && (
                <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200/60 rounded-xl text-red-700 text-xs animate-fade-up">
                  <AlertTriangle size={16} className="shrink-0 text-red-500 mt-0.5" />
                  <span>{localError || error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-xl shadow-lg shadow-orange-500/25 btn-premium active:scale-98 transition-all text-sm"
              >
                {isSubmitting || isLoading ? (
                  <>
                    <Loader size={16} className="animate-spin" /> Authenticating...
                  </>
                ) : (
                  <>
                    <LogIn size={16} /> Sign In
                  </>
                )}
              </button>
            </form>

            {/* Register link */}
            <div className="px-7 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
              <span>Don't have an account?</span>
              <Link to="/register" className="font-bold text-orange-600 hover:text-orange-700 inline-flex items-center gap-1">
                Register Now <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </ScrollReveal>

        {/* Demo Fast-Login Selector */}
        <ScrollReveal direction="up" delay={250}>
          <div className="mt-5 bg-white/90 backdrop-blur-md rounded-2xl border border-gray-200/80 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Instant Demo Access (1-Click Switch)
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                Pre-Configured
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectDemo('citizen')}
                className="flex items-center gap-2 p-2 rounded-xl border border-blue-100 bg-blue-50/50 hover:bg-blue-100/70 text-left transition-all active:scale-95"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  <User size={13} />
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-blue-900 truncate">Citizen</div>
                  <div className="text-[10px] text-blue-600 truncate">Ramesh Sharma</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectDemo('ward_officer')}
                className="flex items-center gap-2 p-2 rounded-xl border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-100/70 text-left transition-all active:scale-95"
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  <Shield size={13} />
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-indigo-900 truncate">Ward Officer</div>
                  <div className="text-[10px] text-indigo-600 truncate">Ward 01 (Indirapuram)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectDemo('dept_head')}
                className="flex items-center gap-2 p-2 rounded-xl border border-amber-100 bg-amber-50/50 hover:bg-amber-100/70 text-left transition-all active:scale-95"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  <Shield size={13} />
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-amber-900 truncate">Dept Head</div>
                  <div className="text-[10px] text-amber-600 truncate">PWD Department</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectDemo('admin')}
                className="flex items-center gap-2 p-2 rounded-xl border border-purple-100 bg-purple-50/50 hover:bg-purple-100/70 text-left transition-all active:scale-95"
              >
                <div className="w-7 h-7 rounded-lg bg-purple-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  <Shield size={13} />
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-purple-900 truncate">Administrator</div>
                  <div className="text-[10px] text-purple-600 truncate">District Command</div>
                </div>
              </button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
