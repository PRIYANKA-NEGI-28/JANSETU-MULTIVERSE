import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  Loader,
  Shield,
  Mic,
  MicOff,
  MapPin,
  Camera,
  Copy,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { useLang } from '../contexts/LangContext.js';
import { api, type ComplaintDto, type DepartmentCode, type CategoryCode, ApiClientError } from '../lib/api.js';
import { compressCivicImage } from '../lib/imageCompression.js';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder.js';
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

  // Form Fields
  const [text, setText] = useState('');
  const [departmentCode, setDepartmentCode] = useState<DepartmentCode>(
    DEPARTMENTS[1] ?? 'Public Works Department (PWD)'
  );
  const [category, setCategory] = useState<CategoryCode>(COMPLAINT_CATEGORIES[1] ?? 'Road Damage');
  const [urgency, setUrgency] = useState<UrgencyLevel>('MEDIUM');
  const [latitude, setLatitude] = useState(28.628);
  const [longitude, setLongitude] = useState(77.3649);
  const [area, setArea] = useState('Indirapuram, Ghaziabad');
  const [wardId, setWardId] = useState('ward-ghz-01-indirapuram');
  const [wardName, setWardName] = useState('Indirapuram Ward 01');

  // Media & Geolocation
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionRatio, setCompressionRatio] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdComplaint, setCreatedComplaint] = useState<ComplaintDto | null>(null);
  const [copiedTrackingCode, setCopiedTrackingCode] = useState(false);

  // Form Validation Errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Voice Recording hook
  const {
    isRecording,
    recordingTimeSec,
    isTranscribing,
    error: voiceError,
    startRecording,
    stopRecording,
    detectedLang,
  } = useVoiceRecorder(lang);

  // Auto-reverse geocode coordinates to ward
  const resolveWardForCoords = useCallback(async (lat: number, lng: number) => {
    try {
      const geo = await api.geo.resolveWard(lat, lng);
      if (geo?.wardId) {
        setWardId(geo.wardId);
        setWardName(geo.wardName || geo.wardId);
        setArea(`${geo.wardName || 'Ward Area'}, Ghaziabad`);
      }
    } catch {
      // Retain fallback ward
    }
  }, []);

  // Request browser geolocation
  const handleGetLocation = () => {
    setIsLocating(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(5));
        const lng = parseFloat(pos.coords.longitude.toFixed(5));
        setLatitude(lat);
        setLongitude(lng);
        void resolveWardForCoords(lat, lng);
        setIsLocating(false);
      },
      (err) => {
        setLocationError(`Location request failed: ${err.message}. Using default NCR coordinates.`);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Image Selection & Client-Side Compression (strips EXIF, max 1280px WebP)
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      const compressed = await compressCivicImage(file, {
        maxSizeMB: 1.0,
        maxWidthOrHeight: 1280,
        fileType: 'image/webp',
      });

      setSelectedFile(compressed);
      const previewUrl = URL.createObjectURL(compressed);
      setImagePreview(previewUrl);

      const savedPercent = Math.round((1 - compressed.size / file.size) * 100);
      setCompressionRatio(
        `${(compressed.size / 1024).toFixed(0)} KB (${savedPercent > 0 ? `-${savedPercent}%` : 'optimized'}, EXIF stripped)`
      );
    } catch {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
    } finally {
      setIsCompressing(false);
    }
  };

  // Toggle voice recording
  const handleVoiceToggle = async () => {
    if (isRecording) {
      const res = await stopRecording();
      if (res?.transcript) {
        setText((prev) => (prev ? `${prev} ${res.transcript}` : res.transcript));
      }
    } else {
      await startRecording();
    }
  };

  // Form submission with idempotency key
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    // Client-side validation
    const errors: Record<string, string> = {};
    if (!text.trim() || text.trim().length < 5) {
      errors.text = 'Complaint description must be at least 5 characters long';
    }
    if (!area.trim()) {
      errors.area = 'Locality or area name is required';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedPhotoUrl: string | null = null;
      if (selectedFile) {
        const uploaded = await api.media.upload(selectedFile);
        uploadedPhotoUrl = uploaded.publicUrl;
      }

      const res = await api.complaints.create({
        text: text.trim(),
        departmentCode,
        category,
        urgency,
        latitude,
        longitude,
        wardId,
        area: area.trim(),
        reporterName: user?.name,
        reporterPhone: user?.phone ?? undefined,
        photo_url: uploadedPhotoUrl,
        language: lang === 'hi' ? 'hi' : 'en',
      });

      setCreatedComplaint(res);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.fieldErrors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.fieldErrors)) {
          mapped[k] = v[0] || 'Invalid field';
        }
        setFieldErrors(mapped);
      }
      const msg = err instanceof Error ? err.message : 'Failed to file complaint. Please retry.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedTrackingCode(true);
    setTimeout(() => setCopiedTrackingCode(false), 2000);
  };

  // Success Confirmation Screen
  if (createdComplaint) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 animate-fade-up">
        <div className="bg-white rounded-3xl border border-emerald-100 shadow-xl p-6 sm:p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={36} />
          </div>

          <h2 className="text-2xl font-black text-gray-900 mb-2">Complaint Successfully Filed!</h2>
          <p className="text-sm text-gray-600 mb-6">
            Your grievance is registered with an immutable tracking code and dispatched to the spatial clustering graph.
          </p>

          {/* Tracking Ticket Card */}
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 mb-6 text-left space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Tracking Code</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-orange-600 text-lg">
                  {createdComplaint.trackingCode}
                </span>
                <button
                  onClick={() => handleCopyCode(createdComplaint.trackingCode)}
                  className="p-1.5 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 transition-all text-xs font-bold"
                  title="Copy Tracking Code"
                >
                  {copiedTrackingCode ? <CheckCircle size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-gray-500 font-semibold block">Target Department</span>
                <span className="font-bold text-gray-900">{createdComplaint.departmentCode || departmentCode}</span>
              </div>
              <div>
                <span className="text-gray-500 font-semibold block">Urgency Level</span>
                <span className="font-bold text-orange-600">{createdComplaint.urgency}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 font-semibold block">Guaranteed SLA Target</span>
                <span className="font-bold text-gray-900">
                  {new Date(createdComplaint.slaDueAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate(`/track?code=${createdComplaint.trackingCode}`)}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-orange-500/20 flex items-center justify-center gap-1.5"
            >
              Track Live Timeline <ArrowRight size={16} />
            </button>
            <button
              onClick={() => {
                setCreatedComplaint(null);
                setText('');
                setSelectedFile(null);
                setImagePreview(null);
              }}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-all"
            >
              File Another Grievance
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
          {T['nav_file'] || 'File a Civic Complaint'}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Submit your issue with browser voice transcription, location-to-ward resolution, and client-side photo compression
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
        {/* Saffron/Green Header */}
        <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={18} />
            <span className="font-bold text-xs uppercase tracking-wider">Citizen Grievance Submission</span>
          </div>
          <span className="text-[11px] font-semibold bg-white/20 px-2.5 py-0.5 rounded-full">
            {lang === 'hi' ? 'हिन्दी / English' : 'English / हिन्दी'}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6" noValidate>
          {/* Complaint Text & Voice Recording Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="complaint-text"
                className="block text-xs font-bold uppercase tracking-wider text-gray-700"
              >
                Complaint Details (शिकायत का विवरण) <span className="text-red-500">*</span>
              </label>

              {/* Voice Input Button */}
              <button
                type="button"
                onClick={() => void handleVoiceToggle()}
                disabled={isTranscribing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100'
                }`}
                title="Speak your complaint in Hindi or English"
              >
                {isRecording ? (
                  <>
                    <MicOff size={14} /> Stop ({recordingTimeSec}s)
                  </>
                ) : isTranscribing ? (
                  <>
                    <Loader size={14} className="animate-spin text-orange-600" /> Transcribing...
                  </>
                ) : (
                  <>
                    <Mic size={14} className="text-orange-600" /> Speak / बोलें
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <textarea
                id="complaint-text"
                rows={4}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (fieldErrors.text) {
                    setFieldErrors((prev) => ({ ...prev, text: '' }));
                  }
                }}
                placeholder="Describe the issue clearly (e.g. Streetlight broken near Shipra Mall, causing safety hazard at night)..."
                className={`w-full p-4 bg-gray-50/50 border rounded-2xl text-sm focus:outline-none focus:ring-2 transition-all ${
                  fieldErrors.text
                    ? 'border-red-400 focus:ring-red-200'
                    : 'border-gray-200 focus:ring-orange-500/20 focus:border-orange-500'
                }`}
                aria-invalid={Boolean(fieldErrors.text)}
                aria-describedby={fieldErrors.text ? 'text-error' : undefined}
                required
              />
            </div>

            {detectedLang && (
              <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md w-fit">
                <Sparkles size={12} /> Detected Language: {detectedLang.toUpperCase()}
              </div>
            )}

            {voiceError && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle size={12} /> {voiceError}
              </p>
            )}

            {fieldErrors.text && (
              <p id="text-error" role="alert" className="text-xs text-red-600 font-medium">
                {fieldErrors.text}
              </p>
            )}
          </div>

          {/* Department & Urgency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="department"
                className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5"
              >
                Department (विभाग)
              </label>
              <select
                id="department"
                value={departmentCode}
                onChange={(e) => setDepartmentCode(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-500"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="urgency"
                className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5"
              >
                Urgency (प्राथमिकता)
              </label>
              <select
                id="urgency"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-500"
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
            <label
              htmlFor="category"
              className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5"
            >
              Category (श्रेणी)
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-500"
            >
              {COMPLAINT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Location & Reverse Ward Resolution */}
          <div className="bg-gray-50/70 rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
                  Geographic Location & Ward
                </span>
                <span className="text-[11px] text-gray-500">
                  Resolved: <span className="font-bold text-gray-800">{wardName}</span> ({wardId})
                </span>
              </div>

              {/* Browser Geolocation Trigger */}
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={isLocating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-all shrink-0"
              >
                {isLocating ? (
                  <>
                    <Loader size={14} className="animate-spin" /> Locating...
                  </>
                ) : (
                  <>
                    <MapPin size={14} /> Detect Current GPS
                  </>
                )}
              </button>
            </div>

            {locationError && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                {locationError}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="area" className="block text-[11px] font-bold text-gray-600 mb-1">
                  Area / Landmark Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="area"
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className={`w-full px-3 py-2 bg-white border rounded-xl text-xs focus:outline-none ${
                    fieldErrors.area ? 'border-red-400' : 'border-gray-200 focus:border-blue-500'
                  }`}
                  required
                />
                {fieldErrors.area && (
                  <p role="alert" className="text-[11px] text-red-600 mt-0.5">
                    {fieldErrors.area}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">
                  GPS Coordinates (Lat / Lng)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.0001"
                    value={latitude}
                    onChange={(e) => {
                      const lat = parseFloat(e.target.value);
                      setLatitude(lat);
                      void resolveWardForCoords(lat, longitude);
                    }}
                    className="w-1/2 px-2.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono"
                    title="Latitude"
                  />
                  <input
                    type="number"
                    step="0.0001"
                    value={longitude}
                    onChange={(e) => {
                      const lng = parseFloat(e.target.value);
                      setLongitude(lng);
                      void resolveWardForCoords(latitude, lng);
                    }}
                    className="w-1/2 px-2.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono"
                    title="Longitude"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Photo Upload with Client-Side Compression */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Photographic Evidence (Optional / फोटो संलग्न करें)
            </label>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-xl cursor-pointer text-xs font-bold text-gray-700 transition-all active:scale-95 shadow-xs">
                <Camera size={16} className="text-orange-600" />
                <span>{selectedFile ? 'Change Photo' : 'Attach Photo'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => void handleImageChange(e)}
                  className="hidden"
                />
              </label>

              {isCompressing && (
                <div className="flex items-center gap-1.5 text-xs text-orange-600 font-semibold animate-pulse">
                  <Loader size={14} className="animate-spin" /> Compressing & stripping EXIF...
                </div>
              )}

              {compressionRatio && !isCompressing && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  {compressionRatio}
                </span>
              )}
            </div>

            {imagePreview && (
              <div className="relative mt-2 w-32 h-32 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                <img src={imagePreview} alt="Upload Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setImagePreview(null);
                    setCompressionRatio(null);
                  }}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 text-[10px] hover:bg-black/80"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {submitError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-red-500" />
                <span>{submitError}</span>
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                className="text-xs font-bold text-red-800 underline hover:no-underline ml-2"
              >
                Retry
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || isCompressing}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold rounded-xl shadow-lg shadow-green-900/20 btn-premium active:scale-98 transition-all text-sm"
          >
            {isSubmitting ? (
              <>
                <Loader size={16} className="animate-spin" /> Registering with Idempotency Key...
              </>
            ) : (
              <>
                <Shield size={16} /> Submit Grievance (शिकायत दर्ज करें)
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
