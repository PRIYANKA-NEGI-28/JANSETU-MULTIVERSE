import { useState } from 'react';
import { Lock, Eye, EyeOff, Shield, AlertTriangle, Loader } from 'lucide-react';
import { useLang } from '../lib/langContext';

const ADMIN_PASSWORD = 'JanSetu@Admin2026';

interface AdminLoginProps {
  onSuccess: () => void;
  onBack: () => void;
}

export default function AdminLogin({ onSuccess, onBack }: AdminLoginProps) {
  const { T } = useLang();
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));

    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('jansetu_admin_auth', 'true');
      onSuccess();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setError(newAttempts >= 3
        ? T.admin_login_attempts
        : T.admin_login_incorrect);
      setPassword('');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Shield icon */}
        <div className="text-center mb-8">
          <div className="inline-flex w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-700 items-center justify-center mb-4 border border-gray-700">
            <Shield size={36} className="text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{T.admin_login_title}</h1>
          <p className="text-gray-500 text-sm">{T.admin_login_subtitle}</p>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">{T.admin_login_password}</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-3.5 text-gray-500" />
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder={T.admin_login_placeholder}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  disabled={attempts >= 3}
                  className="w-full pl-10 pr-10 py-3 bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-3.5 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-950 border border-red-900 rounded-xl text-red-400 text-sm">
                <AlertTriangle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || attempts >= 3 || !password}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
            >
              {loading ? <><Loader size={16} className="animate-spin" /> {T.admin_login_verifying}</> : <><Shield size={16} /> {T.admin_login_enter}</>}
            </button>

            <button type="button" onClick={onBack} className="w-full py-2 text-sm text-gray-600 hover:text-gray-400 transition-colors">
              {T.admin_login_back}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-700 mt-6">
          {T.admin_login_unauthorized}
        </p>
      </div>
    </div>
  );
}
