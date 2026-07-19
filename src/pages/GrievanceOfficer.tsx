import { useState, useRef, useEffect } from 'react';
import {
  Scale, FileText, Copy, Printer, ArrowRight, Loader,
  Mic, MicOff, AlertTriangle, CheckCircle, Shield,
  Languages, ChevronDown, ChevronUp, Sparkles, Download,
  Building2, Calendar, MapPin, User, Phone, Home as HomeIcon
} from 'lucide-react';
import type { Page } from '../types';
import ScrollReveal from '../components/ScrollReveal';

interface GrievanceOfficerProps {
  onNavigate: (page: Page) => void;
}

// Speech Recognition types
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface GrievanceResult {
  section_1_analysis: {
    nature_of_grievance: string;
    incident_date_timeline: string;
    target_department: string;
    target_department_hi: string;
    urgency: string;
    location: string;
    raw_input_cleaned: string;
  };
  section_2_english_draft: string;
  section_3_hindi_draft: string;
  metadata: {
    llm_used: boolean;
    processing_device: string;
    timestamp: string;
  };
}

const URGENCY_CONFIG: Record<string, { label: string; labelHi: string; color: string; bg: string; dot: string }> = {
  LOW: { label: 'Low', labelHi: 'सामान्य', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  MEDIUM: { label: 'Medium', labelHi: 'मध्यम', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500' },
  HIGH: { label: 'High', labelHi: 'उच्च', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  CRITICAL: { label: 'Critical', labelHi: 'अत्यंत गंभीर', color: 'text-red-700', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
};

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export default function GrievanceOfficer({ onNavigate }: GrievanceOfficerProps) {
  // Form state
  const [rawText, setRawText] = useState('');
  const [applicantName, setApplicantName] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [applicantAddress, setApplicantAddress] = useState('');
  const [showOptional, setShowOptional] = useState(false);

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<GrievanceResult | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'analysis' | 'english' | 'hindi'>('analysis');
  const [copied, setCopied] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceLang, setVoiceLang] = useState('hi-IN');
  const [voiceError, setVoiceError] = useState('');
  const [interimText, setInterimText] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_RECORDING_TIME = 120;
  const resultRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to result when generated
  useEffect(() => {
    if (result && resultRef.current) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [result]);

  // ── Voice Recording ─────────────────────────────────────────────────────
  function startRecording() {
    setVoiceError('');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Speech recognition not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = voiceLang;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          final += res[0].transcript + ' ';
        } else {
          interim += res[0].transcript;
        }
      }
      if (final) {
        setRawText(prev => (prev ? prev + ' ' : '') + final.trim());
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setVoiceError(`Voice error: ${event.error}`);
      stopRecording();
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimText('');
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };

    recognition.start();
    setIsRecording(true);
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= MAX_RECORDING_TIME) {
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setIsRecording(false);
    setInterimText('');
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }

  // ── Submit Grievance ────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!rawText.trim()) {
      setError('Please enter or speak your complaint text.');
      return;
    }
    setError('');
    setProcessing(true);
    setResult(null);

    try {
      const body: Record<string, string> = { rawText: rawText.trim() };
      if (applicantName.trim()) body.applicantName = applicantName.trim();
      if (applicantPhone.trim()) body.applicantPhone = applicantPhone.trim();
      if (applicantAddress.trim()) body.applicantAddress = applicantAddress.trim();

      const res = await fetch(`${API_BASE}/api/grievance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to process grievance');
      }

      setResult(data.data);
      setActiveTab('analysis');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error. Is the backend running?');
    } finally {
      setProcessing(false);
    }
  }

  // ── Copy & Print ────────────────────────────────────────────────────────
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handlePrint(content: string, title: string) {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; line-height: 1.8; color: #1a1a1a; }
            pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; font-size: 14px; }
          </style>
        </head>
        <body><pre>${content}</pre></body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }

  function handleDownload(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ──────────────────────────────────────────────────────────────
  const urgencyConfig = result ? URGENCY_CONFIG[result.section_1_analysis.urgency] || URGENCY_CONFIG.MEDIUM : null;

  return (
    <div className="min-h-screen pt-24 md:pt-28 pb-28 px-4">
      <div className="max-w-4xl mx-auto">

        {/* ─── Header ──────────────────────────────────────────────── */}
        <ScrollReveal>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 mb-4">
              <Shield size={14} className="text-indigo-600" />
              <span className="text-xs font-bold text-indigo-700 tracking-wider uppercase">AI Grievance Officer</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-3 tracking-tight">
              Formal Grievance <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Draft Generator</span>
            </h1>
            <p className="text-gray-500 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              Speak or type your complaint in any language. The AI extracts facts and generates legally structured grievance drafts in both <strong>English</strong> and <strong>Hindi</strong>.
            </p>
          </div>
        </ScrollReveal>

        {/* ─── Input Section ───────────────────────────────────────── */}
        <ScrollReveal delay={100}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-100/50 overflow-hidden mb-8">
            {/* Voice Language Selector + Badge */}
            <div className="px-6 pt-6 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Scale size={20} className="text-indigo-600" />
                <h2 className="font-bold text-gray-900">Describe Your Grievance</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">Voice:</span>
                <select
                  value={voiceLang}
                  onChange={(e) => setVoiceLang(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 font-medium text-gray-700 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 outline-none"
                  id="voice-language-select"
                >
                  <option value="hi-IN">हिंदी</option>
                  <option value="en-IN">English</option>
                  <option value="en-US">English (US)</option>
                </select>
              </div>
            </div>

            {/* Textarea */}
            <div className="px-6 pb-3">
              <div className="relative">
                <textarea
                  id="grievance-raw-text"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Type or speak your complaint here... For example: 'Humare mohalle mein 3 hafte se pani nahi aa raha hai, tanker bhi nahi aata. Bacchon ko school jaane mein dikkat ho rahi hai...'"
                  className="w-full h-40 p-4 border border-gray-200 rounded-xl bg-gray-50/50 text-sm text-gray-800 placeholder-gray-400 resize-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 outline-none transition-all"
                  disabled={processing}
                />
                {interimText && (
                  <div className="absolute bottom-3 left-4 right-4 text-xs text-indigo-500 italic animate-pulse truncate">
                    {interimText}
                  </div>
                )}
              </div>

              {/* Voice Controls */}
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={processing}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isRecording
                      ? 'bg-red-500 text-white shadow-lg shadow-red-200 hover:bg-red-600 animate-pulse'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                  id="voice-record-btn"
                >
                  {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                  {isRecording ? `Stop (${recordingTime}s)` : 'Record Voice'}
                </button>
                {voiceError && (
                  <span className="text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle size={12} /> {voiceError}
                  </span>
                )}
                {rawText.length > 0 && !isRecording && (
                  <span className="text-xs text-gray-400 ml-auto">{rawText.length} characters</span>
                )}
              </div>
            </div>

            {/* Optional Applicant Details */}
            <div className="px-6 pb-4">
              <button
                onClick={() => setShowOptional(!showOptional)}
                className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                id="toggle-optional-fields"
              >
                {showOptional ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Applicant Details (Optional — blank fields become placeholders)
              </button>

              {showOptional && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/50 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 outline-none"
                      id="applicant-name"
                    />
                  </div>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      value={applicantPhone}
                      onChange={(e) => setApplicantPhone(e.target.value)}
                      placeholder="Phone Number"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/50 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 outline-none"
                      id="applicant-phone"
                    />
                  </div>
                  <div className="relative">
                    <HomeIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={applicantAddress}
                      onChange={(e) => setApplicantAddress(e.target.value)}
                      placeholder="Address"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/50 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 outline-none"
                      id="applicant-address"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="px-6 pb-6">
              {error && (
                <div className="flex items-center gap-2 mb-3 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                  <AlertTriangle size={14} />
                  {error}
                </div>
              )}
              <button
                onClick={handleSubmit}
                disabled={processing || !rawText.trim()}
                className={`w-full flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm font-bold transition-all ${
                  processing || !rawText.trim()
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 hover:-translate-y-0.5 active:translate-y-0'
                }`}
                id="generate-grievance-btn"
              >
                {processing ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Processing Grievance — Extracting Facts...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Generate Formal Grievance Draft
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </ScrollReveal>

        {/* ─── Results Section ─────────────────────────────────────── */}
        {result && (
          <div ref={resultRef}>
            <ScrollReveal delay={150}>
              {/* Tab Navigation */}
              <div className="flex items-center gap-1 mb-4 bg-white rounded-xl border border-gray-100 p-1 shadow-sm">
                <button
                  onClick={() => setActiveTab('analysis')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'analysis'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                  id="tab-analysis"
                >
                  <AlertTriangle size={14} />
                  Analysis Report
                </button>
                <button
                  onClick={() => setActiveTab('english')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'english'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                  id="tab-english"
                >
                  <FileText size={14} />
                  English Draft
                </button>
                <button
                  onClick={() => setActiveTab('hindi')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'hindi'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                  id="tab-hindi"
                >
                  <Languages size={14} />
                  हिंदी प्रारूप
                </button>
              </div>
            </ScrollReveal>

            {/* ─── Section 1: Analysis Report ────────────────────────── */}
            {activeTab === 'analysis' && (
              <ScrollReveal delay={200}>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-100/50 overflow-hidden">
                  <div className="px-6 pt-6 pb-4 border-b border-gray-50">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                          <AlertTriangle size={16} className="text-indigo-600" />
                        </div>
                        Complaint Analysis Report
                      </h3>
                      {urgencyConfig && (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${urgencyConfig.bg} ${urgencyConfig.color}`}>
                          <span className={`w-2 h-2 rounded-full ${urgencyConfig.dot} animate-pulse`}></span>
                          {urgencyConfig.label} Priority
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    {/* Nature of Grievance */}
                    <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 rounded-xl border border-indigo-100/50">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Scale size={18} className="text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">Nature of Grievance</p>
                        <p className="font-bold text-gray-900">{result.section_1_analysis.nature_of_grievance}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Incident Date/Timeline */}
                      <div className="flex items-start gap-3 p-4 bg-gray-50/80 rounded-xl border border-gray-100">
                        <Calendar size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Incident Date/Timeline</p>
                          <p className="text-sm font-medium text-gray-800">{result.section_1_analysis.incident_date_timeline}</p>
                        </div>
                      </div>

                      {/* Location */}
                      <div className="flex items-start gap-3 p-4 bg-gray-50/80 rounded-xl border border-gray-100">
                        <MapPin size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Location</p>
                          <p className="text-sm font-medium text-gray-800">{result.section_1_analysis.location}</p>
                        </div>
                      </div>

                      {/* Target Department */}
                      <div className="flex items-start gap-3 p-4 bg-gray-50/80 rounded-xl border border-gray-100 md:col-span-2">
                        <Building2 size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Target Department / Authority</p>
                          <p className="text-sm font-medium text-gray-800">{result.section_1_analysis.target_department}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{result.section_1_analysis.target_department_hi}</p>
                        </div>
                      </div>
                    </div>

                    {/* Processing Info */}
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700">
                      <CheckCircle size={14} />
                      <span className="font-medium">
                        Processed via {result.metadata.processing_device}
                        {result.metadata.llm_used && ' • AI-Extracted Facts'}
                      </span>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            )}

            {/* ─── Section 2: English Draft ───────────────────────────── */}
            {activeTab === 'english' && (
              <ScrollReveal delay={200}>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-100/50 overflow-hidden">
                  <div className="px-6 pt-6 pb-4 border-b border-gray-50 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <FileText size={16} className="text-blue-600" />
                      </div>
                      Formal Grievance Draft (English)
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(result.section_2_english_draft)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        id="copy-english-btn"
                      >
                        {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={() => handlePrint(result.section_2_english_draft, 'Grievance Draft - English')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                        id="print-english-btn"
                      >
                        <Printer size={12} /> Print
                      </button>
                      <button
                        onClick={() => handleDownload(result.section_2_english_draft, 'Grievance_Draft_English.txt')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                        id="download-english-btn"
                      >
                        <Download size={12} /> Download
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-6">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-[inherit]">
                        {result.section_2_english_draft}
                      </pre>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            )}

            {/* ─── Section 3: Hindi Draft ─────────────────────────────── */}
            {activeTab === 'hindi' && (
              <ScrollReveal delay={200}>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-100/50 overflow-hidden">
                  <div className="px-6 pt-6 pb-4 border-b border-gray-50 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                        <Languages size={16} className="text-orange-600" />
                      </div>
                      औपचारिक शिकायत प्रारूप (Hindi)
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(result.section_3_hindi_draft)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        id="copy-hindi-btn"
                      >
                        {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={() => handlePrint(result.section_3_hindi_draft, 'शिकायत प्रारूप - हिंदी')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                        id="print-hindi-btn"
                      >
                        <Printer size={12} /> Print
                      </button>
                      <button
                        onClick={() => handleDownload(result.section_3_hindi_draft, 'Shikayat_Prarup_Hindi.txt')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                        id="download-hindi-btn"
                      >
                        <Download size={12} /> Download
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="bg-orange-50/30 border border-orange-100/50 rounded-xl p-6">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-[inherit]" style={{ fontFamily: "'Noto Sans Devanagari', 'Segoe UI', sans-serif" }}>
                        {result.section_3_hindi_draft}
                      </pre>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            )}

            {/* ─── Start New ──────────────────────────────────────────── */}
            <ScrollReveal delay={300}>
              <div className="mt-6 flex items-center justify-center gap-4">
                <button
                  onClick={() => { setResult(null); setRawText(''); setApplicantName(''); setApplicantPhone(''); setApplicantAddress(''); setError(''); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all border border-gray-200"
                  id="new-grievance-btn"
                >
                  <Sparkles size={16} />
                  New Grievance
                </button>
                <button
                  onClick={() => onNavigate('home')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all border border-indigo-200"
                  id="back-home-btn"
                >
                  <HomeIcon size={16} />
                  Back to Home
                </button>
              </div>
            </ScrollReveal>
          </div>
        )}
      </div>
    </div>
  );
}
