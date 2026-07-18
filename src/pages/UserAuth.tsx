import { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, LogIn, UserPlus, AlertTriangle, Loader, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLang } from '../lib/langContext';

interface UserAuthProps {
  onAuthSuccess: () => void;
  onBack: () => void;
}

export default function UserAuth({ onAuthSuccess, onBack }: UserAuthProps) {
  const { T } = useLang();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!name.trim()) { setError(T.auth_error_name); setLoading(false); return; }
        if (!phone.trim()) { setError(T.auth_error_phone); setLoading(false); return; }
        if (!/^[6-9]\d{9}$/.test(phone.trim())) { setError(T.auth_error_phone_invalid); setLoading(false); return; }
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name, phone: phone.trim() } },
        });
        if (signUpError) throw signUpError;
        onAuthSuccess();
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        onAuthSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : T.auth_error_failed;
      if (msg.includes('Invalid login')) setError(T.auth_error_credentials);
      else if (msg.includes('already registered')) setError(T.auth_error_registered);
      else if (msg.includes('Password should')) setError(T.auth_error_password);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50 flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-lg">JS</span>
            </div>
            <div className="text-left">
              <div className="font-black text-2xl text-gray-900">JanSetu</div>
              <div className="text-xs text-orange-500 font-bold uppercase tracking-widest">Graph AI</div>
            </div>
          </div>
          <p className="text-gray-500 text-sm">{T.auth_subtitle}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Tab Switch */}
          <div className="flex">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-4 text-sm font-bold transition-all ${mode === 'login' ? 'bg-orange-500 text-white' : 'bg-gray-50 text-gray-500 hover:text-gray-700'}`}
            >
              <LogIn size={15} className="inline mr-2" />
              {T.auth_login}
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-4 text-sm font-bold transition-all ${mode === 'register' ? 'bg-orange-500 text-white' : 'bg-gray-50 text-gray-500 hover:text-gray-700'}`}
            >
              <UserPlus size={15} className="inline mr-2" />
              {T.auth_register}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{T.auth_full_name}</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{T.auth_mobile} <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                    <input
                      type="tel"
                      placeholder={T.auth_mobile_placeholder}
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      maxLength={10}
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{T.auth_mobile_hint}</p>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{T.auth_email}</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type="email"
                  placeholder={T.auth_email_placeholder}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{T.auth_password}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder={T.auth_password_placeholder}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                <AlertTriangle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <><Loader size={17} className="animate-spin" /> {mode === 'login' ? T.auth_signing_in : T.auth_creating}</>
              ) : mode === 'login' ? (
                <><LogIn size={17} /> {T.auth_sign_in}</>
              ) : (
                <><UserPlus size={17} /> {T.auth_create_account}</>
              )}
            </button>

            <button type="button" onClick={onBack} className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              {T.auth_back_home}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            {T.auth_secured}
          </div>
        </div>
      </div>
    </div>
  );
}
