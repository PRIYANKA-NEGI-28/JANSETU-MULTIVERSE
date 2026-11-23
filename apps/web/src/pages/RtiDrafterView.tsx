import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Scale,
  CheckCircle,
  Download,
  Copy,
  Loader,
  AlertTriangle,
  Sparkles,
  FileText,
  Search,
} from 'lucide-react';
import { api, type RtiDraftDto, type ComplaintDto } from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useLang } from '../contexts/LangContext.js';

export default function RtiDrafterView() {
  const { user } = useAuth();
  const { T, lang } = useLang();
  const [searchParams] = useSearchParams();
  const prefillCode = searchParams.get('complaint') || '';

  // Prefill Search State
  const [complaintLookupCode, setComplaintLookupCode] = useState(prefillCode);
  const [isLookingUpComplaint, setIsLookingUpComplaint] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  // Form Fields
  const [applicantName, setApplicantName] = useState(user?.name || 'Ramesh Sharma');
  const [address, setAddress] = useState('Flat 402, Gyan Khand 1, Indirapuram, Ghaziabad - 201014');
  const [contactNumber, setContactNumber] = useState(user?.phone || '+91 98765 43210');
  const [authorityName, setAuthorityName] = useState('Public Information Officer, Ghaziabad Nagar Nigam');
  const [subject, setSubject] = useState(
    'Enquiry on delayed municipal road repair, streetlight outage, and contractor sanctions'
  );
  const [questions, setQuestions] = useState(
    '1. What is the approved budgetary sanction and tender allocation for road and streetlight works in Indirapuram Ward 01?\n2. Please provide the name and registered address of the contractor awarded this civic contract.\n3. What is the stipulated SLA completion deadline and daily penalty clause for project delay?\n4. Kindly provide certified copies of site inspection reports conducted by municipal engineers.'
  );
  const [isBplExempt, setIsBplExempt] = useState(false);
  const [bplCardNo, setBplCardNo] = useState('');
  const [clusterId, setClusterId] = useState<string | undefined>(undefined);

  // Generation & Editing State
  const [isDrafting, setIsDrafting] = useState(false);
  const [draft, setDraft] = useState<RtiDraftDto | null>(null);
  const [editableEnglish, setEditableEnglish] = useState('');
  const [editableHindi, setEditableHindi] = useState('');
  const [activePreviewLang, setActivePreviewLang] = useState<'en' | 'hi'>(lang === 'hi' ? 'hi' : 'en');

  // Persistence & PDF Download State
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [savedRtiId, setSavedRtiId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Pre-fill from an existing complaint
  const handlePrefillFromComplaint = useCallback(async (code: string) => {
    if (!code.trim()) return;
    setIsLookingUpComplaint(true);
    setLookupMessage(null);
    setError(null);

    try {
      const c: ComplaintDto = await api.complaints.getByTrackingCode(code.trim());
      setSubject(`Statutory RTI enquiry regarding grievance ref: ${c.trackingCode} (${c.category})`);
      setAuthorityName(
        c.departmentCode?.includes('Electricity')
          ? 'Public Information Officer, Paschimanchal Vidyut Vitran Nigam (PVVNL)'
          : c.departmentCode?.includes('Water')
            ? 'Public Information Officer, Jal Board'
            : 'Public Information Officer, Ghaziabad Nagar Nigam'
      );
      setQuestions(
        `1. What is the current official status of complaint ${c.trackingCode} filed regarding "${c.description.slice(0, 80)}"?\n2. Name and designation of the civic officer to whom this grievance was assigned.\n3. Certified copy of the action-taken report (ATR) filed by the inspecting team.\n4. Reasons on record for exceeding the prescribed civic resolution deadline (${new Date(c.slaDueAt).toLocaleDateString()}).`
      );
      if (c.clusterId) {
        setClusterId(c.clusterId);
      }
      setLookupMessage(`Successfully pre-filled RTI fields from Complaint ${c.trackingCode}!`);
    } catch {
      setLookupMessage(`Could not locate complaint '${code}'. You can still draft from scratch.`);
    } finally {
      setIsLookingUpComplaint(false);
    }
  }, []);

  useEffect(() => {
    if (prefillCode) {
      void handlePrefillFromComplaint(prefillCode);
    }
  }, [prefillCode, handlePrefillFromComplaint]);

  // AI-Assisted Statutory Drafting
  const handleGenerateAiDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDrafting(true);
    setError(null);

    const questionsList = questions
      .split('\n')
      .map((q) => q.trim())
      .filter((q) => q.length > 0);

    try {
      const res = await api.ai.draftRti({
        subject: subject.trim(),
        authorityName: authorityName.trim(),
        language: lang === 'hi' ? 'hi' : 'en',
        specificQuestions: questionsList,
        isBplExempt,
        bplCardNumber: isBplExempt ? bplCardNo : undefined,
        complaintDetails: `Applicant: ${applicantName}, Address: ${address}`,
      });

      setDraft(res.draft);
      setEditableEnglish(res.draft.englishDraft);
      setEditableHindi(res.draft.hindiDraft);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate statutory RTI draft.';
      setError(msg);
    } finally {
      setIsDrafting(false);
    }
  };

  // Submit Application & Download Statutory Form A PDF
  const handleSaveAndDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    setError(null);

    const questionsList = questions
      .split('\n')
      .map((q) => q.trim())
      .filter((q) => q.length > 0);

    try {
      let rtiId = savedRtiId;

      if (!rtiId) {
        // 1. Persist application in database
        const res = await api.rti.create({
          applicantName: applicantName.trim(),
          address: address.trim(),
          contactNumber: contactNumber.trim(),
          authorityName: authorityName.trim(),
          subject: subject.trim(),
          description: activePreviewLang === 'hi' ? editableHindi : editableEnglish,
          clusterId,
          specificQuestions: questionsList,
          isBplExempt,
          bplCardNo: isBplExempt ? bplCardNo : undefined,
        });
        rtiId = res.rti.id;
        setSavedRtiId(rtiId);
      }

      // 2. Download the binary statutory PDF
      await api.rti.downloadPdf(rtiId, `JanSetu-RTI-${rtiId.slice(0, 8)}.pdf`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to download statutory PDF.';
      setError(msg);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleCopyDraft = () => {
    const textToCopy = activePreviewLang === 'hi' ? editableHindi : editableEnglish;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
          {T['nav_rti'] || 'Statutory Section 6(1) RTI Application Builder'}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Draft legally compliant Right to Information applications under RTI Act 2005 with statutory query formulation and one-click PDF export
        </p>
      </div>

      {/* Prefill from Unresolved Complaint Bar */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <FileText className="text-blue-600 shrink-0" size={18} />
          <div>
            <span className="text-xs font-bold text-blue-900 block">Pre-fill from Existing Complaint</span>
            <span className="text-[11px] text-blue-700">
              Escalate overdue complaints into formal statutory RTI queries
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. JS-2026-IND-001"
            value={complaintLookupCode}
            onChange={(e) => setComplaintLookupCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handlePrefillFromComplaint(complaintLookupCode)}
            className="px-3 py-1.5 bg-white border border-blue-300 rounded-xl text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-44"
          />
          <button
            type="button"
            onClick={() => void handlePrefillFromComplaint(complaintLookupCode)}
            disabled={isLookingUpComplaint || !complaintLookupCode.trim()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1 shadow-xs"
          >
            {isLookingUpComplaint ? <Loader size={12} className="animate-spin" /> : <Search size={12} />}
            <span>Pre-fill</span>
          </button>
        </div>
      </div>

      {lookupMessage && (
        <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-800 text-xs flex items-center gap-2">
          <Sparkles size={14} className="text-blue-500" />
          <span>{lookupMessage}</span>
        </div>
      )}

      {/* Main 2-Column Workspace: Form on Left, Live Editable Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Form Fields */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale size={18} />
              <span className="font-bold text-xs uppercase tracking-wider">Statutory Form A Questionnaire</span>
            </div>
            <span className="text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">
              Section 6(1)
            </span>
          </div>

          <form onSubmit={handleGenerateAiDraft} className="p-6 space-y-4">
            {/* Applicant Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Applicant Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Postal Address of Applicant <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            {/* Public Authority Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Public Authority / PIO Designation <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={authorityName}
                onChange={(e) => setAuthorityName(e.target.value)}
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Subject Matter <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            {/* Specific Questions */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Specific Information Sought (One per line) <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={5}
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs leading-relaxed font-sans focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            {/* BPL Fee Waiver Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="bpl"
                checked={isBplExempt}
                onChange={(e) => setIsBplExempt(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300"
              />
              <label htmlFor="bpl" className="text-xs font-bold text-gray-700">
                Claim Below Poverty Line (BPL) Fee Exemption (₹10 statutory fee waived)
              </label>
            </div>

            {isBplExempt && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  BPL Ration Card Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bplCardNo}
                  onChange={(e) => setBplCardNo(e.target.value)}
                  placeholder="e.g. BPL-2024-UP-8849"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono"
                  required
                />
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* AI Drafting Button */}
            <button
              type="submit"
              disabled={isDrafting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-900/20 transition-all"
            >
              {isDrafting ? (
                <>
                  <Loader size={14} className="animate-spin" /> Formulating Statutory Clauses...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> AI-Assist Statutory Draft (Generate)
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Live Editable Preview & One-Click PDF Download */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden flex flex-col justify-between">
          <div>
            {/* Header with Bilingual Tab Selector */}
            <div className="bg-gray-50 px-6 py-3.5 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Live Editable Preview
              </span>

              <div className="flex bg-gray-200/80 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActivePreviewLang('en')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activePreviewLang === 'en'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewLang('hi')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activePreviewLang === 'hi'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  हिन्दी (Hindi)
                </button>
              </div>
            </div>

            {/* Editable Draft Preview Textarea */}
            <div className="p-6">
              {draft || editableEnglish || editableHindi ? (
                <div className="space-y-2">
                  <textarea
                    rows={16}
                    value={activePreviewLang === 'hi' ? editableHindi : editableEnglish}
                    onChange={(e) => {
                      if (activePreviewLang === 'hi') {
                        setEditableHindi(e.target.value);
                      } else {
                        setEditableEnglish(e.target.value);
                      }
                    }}
                    className="w-full p-4 bg-gray-50/50 border border-gray-200 rounded-2xl text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y"
                    placeholder="Statutory draft will appear here..."
                  />
                  <div className="flex justify-between items-center text-[11px] text-gray-400">
                    <span>Directly editable statutory text</span>
                    <span>Ready for Form A compliance</span>
                  </div>
                </div>
              ) : (
                <div className="h-[360px] flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-200 rounded-2xl">
                  <Scale size={40} className="text-gray-300 mb-3" />
                  <p className="text-xs font-bold text-gray-500 mb-1">No Draft Generated Yet</p>
                  <p className="text-xs text-gray-400 max-w-xs">
                    Fill the form on the left or pre-fill from an existing complaint, then click "AI-Assist Statutory Draft".
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Footer: Copy Draft & One-Click PDF Download */}
          <div className="p-6 bg-gray-50/80 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleCopyDraft}
              disabled={!editableEnglish && !editableHindi}
              className="flex-1 py-3 bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50 text-gray-700 font-bold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              {copied ? <CheckCircle size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Draft Text'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSaveAndDownloadPdf()}
              disabled={isDownloadingPdf}
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-green-900/20 flex items-center justify-center gap-1.5"
            >
              {isDownloadingPdf ? (
                <>
                  <Loader size={14} className="animate-spin" /> Rendering PDF Document...
                </>
              ) : (
                <>
                  <Download size={14} /> One-Click Statutory PDF Download
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
