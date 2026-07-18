import { useState } from 'react';
import { Lock, Mail, AlertTriangle, Loader, LogIn, Shield, User } from 'lucide-react';
import { authenticate } from '../lib/auth';
import type { AuthUser } from '../lib/auth';
import ScrollReveal from '../components/ScrollReveal';
import TricolorWaves from '../components/TricolorWaves';

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate a brief network delay for UX
    await new Promise(r => setTimeout(r, 500));

    const user = authenticate(username, password);
    if (user) {
      onLogin(user);
    } else {
      setError('Invalid email or password. Please try again.');
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50 flex items-center justify-center px-4 bg-dot-mesh">
      <TricolorWaves />
      <div className="w-full max-w-md relative z-10">
        {/* Logo & Branding */}
        <ScrollReveal direction="down" delay={100}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg transition-transform duration-300 hover:rotate-12">
                <span className="text-white font-black text-xl">JS</span>
              </div>
              <div className="text-left">
                <div className="font-black text-3xl text-gray-900">JanSetu</div>
                <div className="text-xs text-orange-500 font-bold uppercase tracking-widest">Multiverse</div>
              </div>
            </div>
            <p className="text-gray-500 text-sm mt-2">Sign in to access the civic intelligence platform</p>
          </div>
        </ScrollReveal>

        {/* Login Card */}
        <ScrollReveal direction="up" delay={250}>
          <div className={`bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-2xl ${
            shouldShake ? 'animate-shake' : ''
          }`}>
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-5">
              <div className="flex items-center gap-2 text-white">
                <Shield size={18} className="animate-pulse" />
                <span className="font-bold text-sm uppercase tracking-wide">Secure Login</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username</label>
                <div className="relative group">
                  <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-400 transition-colors duration-200 group-focus-within:text-orange-500" />
                  <input
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-transparent input-premium"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                <div className="relative group">
                  <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-400 transition-colors duration-200 group-focus-within:text-orange-500" />
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-transparent input-premium"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm animate-fade-up">
                  <AlertTriangle size={14} className="animate-bounce" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-xl shadow-lg hover:shadow-xl btn-premium active:scale-95 transition-all"
              >
                {loading ? (
                  <><Loader size={17} className="animate-spin" /> Signing in...</>
                ) : (
                  <><LogIn size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" /> Sign In</>
                )}
              </button>
            </form>
          </div>
        </ScrollReveal>

        {/* Demo credentials hint */}
        <ScrollReveal direction="up" delay={400}>
          <div className="mt-6 bg-white/80 rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow duration-300">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Demo Credentials</p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center transition-transform duration-300 hover:scale-105">
                  <User size={14} className="text-blue-600" />
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Citizen:</span>{' '}
                  <span className="text-gray-500 font-mono text-xs">citizen / 123456</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center transition-transform duration-300 hover:scale-105">
                  <Shield size={14} className="text-purple-600" />
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Admin:</span>{' '}
                  <span className="text-gray-500 font-mono text-xs">admin / 123456</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <div className="mt-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Secured with local authentication
          </div>
        </div>
      </div>
    </div>
  );
}
