import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Phone, Shield, Loader, UserPlus, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import ScrollReveal from '../components/ScrollReveal.js';
import type { Role } from '@jansetu/shared';

export default function RegisterView() {
  const { register, error, clearError, isLoading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('citizen');
  const [wardId, setWardId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError('');
    setIsSubmitting(true);

    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        phone: phone.trim() || undefined,
        wardId: wardId.trim() || undefined,
        departmentId: departmentId.trim() || undefined,
      });
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please check inputs.';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg relative z-10">
        <ScrollReveal direction="down" delay={50}>
          <div className="text-center mb-6">
            <h1 className="font-black text-2xl sm:text-3xl text-gray-900 tracking-tight">Create Account</h1>
            <p className="text-gray-600 text-sm mt-1">Join the JanSetu civic intelligence and grievance network</p>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={150}>
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={18} />
                <span className="font-bold text-xs uppercase tracking-wider">Citizen & Officer Registration</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-7 space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Full Name
                </label>
                <div className="relative group">
                  <User size={16} className="absolute left-3.5 top-3.5 text-gray-400 group-focus-within:text-orange-500" />
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 input-premium transition-all"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative group">
                  <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-400 group-focus-within:text-orange-500" />
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 input-premium transition-all"
                    required
                  />
                </div>
              </div>

              {/* Phone & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative group">
                    <Phone size={16} className="absolute left-3.5 top-3.5 text-gray-400 group-focus-within:text-orange-500" />
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 input-premium transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Civic Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-full px-3 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  >
                    <option value="citizen">Citizen (नागरिक)</option>
                    <option value="ward_officer">Ward Officer (वार्ड अधिकारी)</option>
                    <option value="dept_head">Department Head (विभागाध्यक्ष)</option>
                    <option value="admin">District Administrator (प्रशासक)</option>
                  </select>
                </div>
              </div>

              {/* Ward / Dept optional fields */}
              {role === 'ward_officer' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Assigned Ward ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ward-ghz-01-indirapuram"
                    value={wardId}
                    onChange={(e) => setWardId(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  />
                </div>
              )}

              {role === 'dept_head' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Assigned Department Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. dept-pwd or dept-electricity"
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  />
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative group">
                  <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-400 group-focus-within:text-orange-500" />
                  <input
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 input-premium transition-all"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              {(localError || error) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                  {localError || error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-xl shadow-lg shadow-orange-500/25 btn-premium active:scale-98 transition-all text-sm mt-2"
              >
                {isSubmitting || isLoading ? (
                  <>
                    <Loader size={16} className="animate-spin" /> Registering...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} /> Create Account
                  </>
                )}
              </button>
            </form>

            <div className="px-7 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
              <Link to="/login" className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900">
                <ArrowLeft size={12} /> Back to Sign In
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
