import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  Loader,
  Shield,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { useLang } from '../contexts/LangContext.js';
import { api, type ComplaintDto, type DepartmentCode, type CategoryCode } from '../lib/api.js';
import {
  DEPARTMENTS,
  COMPLAINT_CATEGORIES,
  URGENCY_LEVELS,
  type UrgencyLevel,
} from '@jansetu/shared';

export default function SubmitComplaintView() {
  const { user } = useAuth();
  const { T, lang } = useLang();
  const navigate = useNavigate();

  const [description, setDescription] = useState('');
  const [departmentCode, setDepartmentCode] = useState<DepartmentCode>(DEPARTMENTS[1] ?? 'Public Works Department (PWD)');
  const [category, setCategory] = useState<CategoryCode>(COMPLAINT_CATEGORIES[1] ?? 'Road Damage');
  const [urgency, setUrgency] = useState<UrgencyLevel>('MEDIUM');
  const [latitude, setLatitude] = useState(28.628);
  const [longitude, setLongitude] = useState(77.3649);
  const [locationName, setLocationName] = useState('Indirapuram, Ghaziabad');
  const wardId = 'ward-ghz-01-indirapuram';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdComplaint, setCreatedComplaint] = useState<ComplaintDto | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.complaints.create({
        description,
        departmentCode,
        category,
        urgency,
        latitude,
        longitude,
        wardId,
        reporterName: user?.name,
        reporterPhone: user?.phone ?? undefined,
        language: lang === 'hi' ? 'hi' : 'en',
      });
      setCreatedComplaint(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit complaint. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdComplaint) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl border border-emerald-100 shadow-xl p-8 text-center animate-fade-up">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Complaint Successfully Filed!</h2>
          <p className="text-sm text-gray-600 mb-6">
            Your grievance has been logged into the JanSetu civic intelligence graph and queued for AI verification.
          </p>

          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-6 text-left space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 font-medium">Tracking Number:</span>
              <span className="font-mono font-bold text-orange-600 text-base">{createdComplaint.trackingCode}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 font-medium">Department:</span>
              <span className="font-semibold text-gray-800">{createdComplaint.departmentCode}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 font-medium">SLA Resolution Target:</span>
              <span className="font-semibold text-gray-800">
                {new Date(createdComplaint.slaDueAt).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate(`/track?code=${createdComplaint.trackingCode}`)}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm transition-all"
            >
              Track Live Status
            </button>
            <button
              onClick={() => {
                setCreatedComplaint(null);
                setDescription('');
              }}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-all"
            >
              Submit Another Grievance
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6 text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
          {T['nav_file'] || 'File a Civic Complaint'}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Submit your complaint with automatic AI categorization, PostGIS spatial clustering, and SLA tracking
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={18} />
            <span className="font-bold text-xs uppercase tracking-wider">Citizen Grievance Form</span>
          </div>
          <span className="text-[11px] font-semibold bg-white/20 px-2.5 py-0.5 rounded-full">
            {lang === 'hi' ? 'हिन्दी में भरें' : 'English / Hindi'}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Complaint Description (शिकायत का विवरण)
            </label>
            <textarea
              rows={4}
              placeholder="Describe the issue clearly (e.g. Streetlight broken near Shipra Mall for 3 days, causing nighttime safety hazard)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-4 bg-gray-50/50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 input-premium transition-all"
              required
            />
          </div>

          {/* Department & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                Department (विभाग)
              </label>
              <select
                value={departmentCode}
                onChange={(e) => setDepartmentCode(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                Urgency (प्राथमिकता)
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
              >
                {URGENCY_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Category (श्रेणी)
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
            >
              {COMPLAINT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Location details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                Ward / Locality (वार्ड)
              </label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                Coordinates (GPS)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.0001"
                  value={latitude}
                  onChange={(e) => setLatitude(parseFloat(e.target.value))}
                  className="w-1/2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                />
                <input
                  type="number"
                  step="0.0001"
                  value={longitude}
                  onChange={(e) => setLongitude(parseFloat(e.target.value))}
                  className="w-1/2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold rounded-xl shadow-lg shadow-green-900/20 btn-premium transition-all text-sm"
          >
            {isSubmitting ? (
              <>
                <Loader size={16} className="animate-spin" /> Submitting & Clustering...
              </>
            ) : (
              <>
                <Shield size={16} /> Submit Grievance
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
