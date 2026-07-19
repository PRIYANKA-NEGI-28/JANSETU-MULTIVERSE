import { useState, useRef, useEffect } from 'react';
import {
  Brain, MapPin, AlertTriangle, CheckCircle, ArrowRight, Loader,
  FileText, Copy, Mic, MicOff, Volume2, Download, ChevronDown
} from 'lucide-react';
import { analyzeComplaint } from '../lib/aiAnalyzer';
import { LOCATIONS } from '../lib/locations';
import type { Page } from '../types';
import type { AuthUser } from '../lib/auth';
import { useLang } from '../lib/langContext';
import { useToast } from '../contexts/ToastContext';
import ScrollReveal from '../components/ScrollReveal';

interface SubmitComplaintProps {
  onNavigate: (page: Page) => void;
  user: AuthUser | null;
  location: { lat: number | null; lng: number | null; permission: string };
  onRequestLocation: () => void;
}

const URGENCY_CONFIG = {
  LOW: { label: 'Low', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  MEDIUM: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  HIGH: { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  CRITICAL: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
};

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

export default function SubmitComplaint({ onNavigate, user, location, onRequestLocation }: SubmitComplaintProps) {
  const { T, lang } = useLang();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: '',
    text: '',
    city: 'Delhi',
    area: '',
    ward: '',
  });
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzeComplaint> | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [shouldShake, setShouldShake] = useState(false);
  const [letterVisible, setLetterVisible] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Voice
  const [isRecording, setIsRecording] = useState(false);
  const [voiceLang, setVoiceLang] = useState('hi-IN');
  const [voiceError, setVoiceError] = useState('');
  const [interimText, setInterimText] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_RECORDING_TIME = 60;

  useEffect(() => {
    if (user?.name) {
      setForm(f => ({ ...f, name: user.name }));
    }
    if (user?.phone) {
      setForm(f => ({ ...f, phone: user.phone }));
    }
  }, [user]);

  function handleTextChange(text: string) {
    setForm(f => ({ ...f, text }));
    setAnalysis(null);
  }

  function startVoiceRecording() {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setVoiceError(T.submit_voice_error_unsupported);
      return;
    }

    setVoiceError('');
    setRecordingTime(0);
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = voiceLang;
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);
      if (final) {
        setForm(f => ({ ...f, text: f.text + (f.text ? ' ' : '') + final }));
        setAnalysis(null);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        setVoiceError(T.submit_voice_error_mic);
      } else if (event.error === 'no-speech') {
        setVoiceError(T.submit_voice_error_speech);
      } else {
        setVoiceError(`${T.submit_voice_error_generic} ${event.error}`);
      }
      stopRecording();
    };

    recognition.onend = () => {
      stopRecording();
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);

    recordingTimerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= MAX_RECORDING_TIME - 1) {
          stopVoiceRecording();
          return MAX_RECORDING_TIME;
        }
        return prev + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setInterimText('');
  }

  function stopVoiceRecording() {
    stopRecording();
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  async function runAnalysis() {
    if (!form.text.trim() || form.text.length < 10) return;
    setAnalyzing(true);
    await new Promise(r => setTimeout(r, 900));
    setAnalysis(analyzeComplaint(form.text));
    setAnalyzing(false);
  }

  function generateLetter(): string {
    if (!analysis) return '';
    const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    return `To,
The ${analysis.department}
Local Ward Office, Municipal Authority

Subject: Formal Complaint Regarding ${analysis.issue_type} — Urgent Action Required

Respected Sir/Madam,

I, ${form.name || 'A Concerned Citizen'}, residing in the mentioned area, wish to bring to your notice the following civic issue affecting our locality.

Issue Category: ${analysis.issue_type}
Urgency Level: ${analysis.urgency}
Summary: ${analysis.summary}

Original Complaint:
"${form.text}"

I humbly request your department to take prompt action and resolve the above-mentioned issue at the earliest. This matter is adversely affecting the daily lives of residents and requires immediate attention.

I look forward to a prompt response and timely resolution.

Yours faithfully,
${form.name || 'Concerned Citizen'}
${form.phone ? 'Contact: ' + form.phone : ''}
Date: ${date}`;
  }

  function generateHindiLetter(): string {
    if (!analysis) return '';
    const date = new Date().toLocaleDateString('hi-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const urgencyHindi: Record<string, string> = { LOW: 'कम', MEDIUM: 'मध्यम', HIGH: 'अधिक', CRITICAL: 'अत्यंत आवश्यक' };
    return `सेवा में,
${analysis.department}
स्थानीय वार्ड कार्यालय, नगर पालिका

विषय: ${analysis.issue_type} के संबंध में शिकायत — तत्काल कार्रवाई हेतु

महोदय/महोदया,

मैं, ${form.name || 'एक चिंतित नागरिक'}, उक्त क्षेत्र का/की निवासी, आपके संज्ञान में निम्नलिखित नागरिक समस्या लाना चाहता/चाहती हूँ जो हमारे क्षेत्र को प्रभावित कर रही है।

समस्या का प्रकार: ${analysis.issue_type}
तात्कालिकता: ${urgencyHindi[analysis.urgency] || analysis.urgency}
संक्षिप्त विवरण: ${analysis.summary}

मूल शिकायत:
"${form.text}"

मैं आपसे विनम्र निवेदन करता/करती हूँ कि उपरोक्त समस्या का शीघ्रातिशीघ्र समाधान किया जाए। यह समस्या क्षेत्र के निवासियों के दैनिक जीवन को गंभीर रूप से प्रभावित कर रही है और इस पर तत्काल ध्यान देना अत्यंत आवश्यक है।

आपकी त्वरित प्रतिक्रिया और समय पर समाधान की आशा में,

आपका/आपकी विश्वासपात्र,
${form.name || 'एक नागरिक'}
${form.phone ? 'संपर्क: ' + form.phone : ''}
दिनांक: ${date}`;
  }

  function downloadLetter(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleSubmit() {
    if (!form.name || !form.text || !form.area) {
      setError(T.submit_error_fields);
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
      return;
    }
    if (!analysis) {
      setError(T.submit_error_analyze);
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
      return;
    }
    if (!photoFile) {
      setError('An image is mandatory to file a complaint.');
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('citizenName', form.name);
      formData.append('citizenPhone', form.phone || '');
      formData.append('rawText', form.text);
      formData.append('language', analysis.language);
      formData.append('issueType', analysis.issue_type);
      formData.append('summary', analysis.summary);
      formData.append('urgency', analysis.urgency);
      formData.append('department', analysis.department);
      formData.append('lat', String(location.lat ?? 28.6139));
      formData.append('lng', String(location.lng ?? 77.2090));
      if (form.area) formData.append('area', form.area);
      if (form.ward) formData.append('ward', form.ward);
      if (user?.id) formData.append('userId', user.id);
      
      // We will grab the file from the camera input below (if the user uploaded one here, although in this component, photo wasn't previously in form state. I'll add a file input state and append it.)
      if (photoFile) {
        formData.append('image_file', photoFile);
      }

      const response = await fetch('/api/complaint', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to submit complaint');
      }

      const responseData = await response.json();
      const complaintNumber = responseData?.data?.complaint_number || responseData?.complaintNumber || responseData?.id || 'JS-COMP-OK';
      setSubmitted(complaintNumber);
    } catch {
      setError(T.submit_error_submit);
      toast('Unable to sync with server. Retrying...', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    const complaintNumSafe = submitted.replace(/[^a-zA-Z0-9-]/g, '');
    return (
      <div className="min-h-screen bg-gray-50 pt-8 pb-8 flex items-center justify-center">
        <div className="max-w-lg w-full mx-4">
          <div className="bg-white rounded-3xl shadow-xl p-10 text-center">
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-green-500" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{T.submit_success_title}</h2>
            <p className="text-gray-500 mb-6">{T.submit_success_msg}</p>

            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 mb-6">
              <p className="text-sm text-gray-500 mb-1">{T.submit_your_number}</p>
              <p className="text-2xl font-black text-orange-600 tracking-widest">{submitted}</p>
              <p className="text-xs text-gray-400 mt-2">{T.submit_save_number}</p>
            </div>

            {analysis && (
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-600 mb-3">{T.submit_download_letter}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => downloadLetter(generateLetter(), `Complaint-${complaintNumSafe}-English.txt`)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-sm font-semibold rounded-xl transition-all"
                  >
                    <Download size={15} /> English
                  </button>
                  <button
                    onClick={() => downloadLetter(generateHindiLetter(), `Complaint-${complaintNumSafe}-Hindi.txt`)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 text-sm font-semibold rounded-xl transition-all"
                  >
                    <Download size={15} /> हिंदी
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={() => onNavigate('track')}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all"
              >
                Track Your Complaint <ArrowRight size={16} />
              </button>
              <button
                onClick={() => { setSubmitted(null); setForm({ name: user?.name || '', phone: '', text: '', city: 'Delhi', area: '', ward: '' }); setAnalysis(null); }}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
              >
                {T.submit_file_another}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-4">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <ScrollReveal direction="up" delay={100}>
          <div className="mb-10 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold mb-4">
              <Brain size={13} /> {T.submit_badge}
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-3 tracking-tight">{T.submit_title}</h1>
            <p className="text-gray-500 text-lg">{T.submit_subtitle}</p>
          </div>
        </ScrollReveal>


        <div className="space-y-6">
          {/* Personal Info */}
          <ScrollReveal direction="up" delay={200}>
            <div className={`bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-300 ${shouldShake ? 'animate-shake' : ''}`}>
              <h2 className="font-bold text-gray-900 mb-5 text-lg flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">1</span>
                {T.submit_step1}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{T.submit_full_name} <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder={T.submit_name_placeholder}
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-transparent transition-all input-premium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{T.submit_phone}</label>
                  <input
                    type="tel"
                    placeholder={T.submit_phone_placeholder}
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-transparent transition-all input-premium"
                  />
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Voice + Complaint */}
          <ScrollReveal direction="up" delay={250}>
            <div className={`bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-300 ${shouldShake ? 'animate-shake' : ''}`}>
              <h2 className="font-bold text-gray-900 mb-5 text-lg flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">2</span>
                {T.submit_step2}
              </h2>

            {/* Voice Controls */}
            <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Volume2 size={16} className="text-indigo-600" />
                  <span className="text-sm font-bold text-indigo-700">{T.submit_voice_title}</span>
                  <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full font-medium">{T.submit_voice_lang_label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={voiceLang}
                    onChange={e => setVoiceLang(e.target.value)}
                    className="text-xs border border-indigo-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    disabled={isRecording}
                  >
                    <option value="hi-IN">Hindi — हिंदी</option>
                    <option value="en-IN">English</option>
                    <option value="mr-IN">Marathi — मराठी</option>
                    <option value="bn-IN">Bengali — বাংলা</option>
                    <option value="ta-IN">Tamil — தமிழ்</option>
                    <option value="te-IN">Telugu — తెలుగు</option>
                    <option value="gu-IN">Gujarati — ગુજરાતી</option>
                    <option value="kn-IN">Kannada — ಕನ್ನಡ</option>
                    <option value="ml-IN">Malayalam — മലയാളം</option>
                    <option value="pa-IN">Punjabi — ਪੰਜਾਬੀ</option>
                    <option value="or-IN">Odia — ଓଡ଼ିଆ</option>
                    <option value="ur-IN">Urdu — اردو</option>
                  </select>
                  <button
                    type="button"
                    onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      isRecording
                        ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {isRecording ? <><MicOff size={15} /> {T.submit_voice_stop}</> : <><Mic size={15} /> {T.submit_voice_speak}</>}
                  </button>
                </div>
              </div>

              {isRecording && (
                <div className="mt-3 space-y-2.5">
                  <div className="flex items-center gap-3 text-indigo-600 text-sm font-semibold">
                    <div className="flex items-end gap-1 h-5 select-none">
                      {[0.4, 0.6, 0.3, 0.7, 0.5, 0.45, 0.65, 0.35, 0.55, 0.4].map((duration, i) => (
                        <span 
                          key={i} 
                          className="w-1 rounded-full bg-indigo-500 animate-audio-wave shadow-sm shadow-indigo-400/50" 
                          style={{ 
                            height: '100%', 
                            animationDuration: `${duration}s`, 
                            animationDelay: `${i * 0.05}s`,
                            transformOrigin: 'bottom'
                          }}
                        />
                      ))}
                    </div>
                    <span>{T.submit_voice_recording} {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-50 to-indigo-500 transition-all duration-1000"
                      style={{ width: `${(recordingTime / MAX_RECORDING_TIME) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              {interimText && (
                <p className="mt-2 text-xs text-indigo-500 italic">{T.submit_voice_hearing} "{interimText}"</p>
              )}
              {voiceError && (
                <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={11} /> {voiceError}</p>
              )}
              {!isRecording && !voiceError && (
                <p className="mt-2 text-xs text-indigo-400">
                  {voiceLang === 'hi-IN'
                    ? T.submit_voice_hint_hi
                    : voiceLang === 'mr-IN'
                    ? T.submit_voice_hint_mr
                    : voiceLang === 'en-IN'
                    ? T.submit_voice_hint_en
                    : T.submit_voice_hint_other}
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {T.submit_complaint_text} <span className="text-red-500">*</span>
                <span className="ml-2 text-xs font-normal text-gray-400">{T.submit_complaint_hint}</span>
              </label>
              <div className={`relative rounded-xl overflow-hidden ${analyzing ? 'scanner-overlay' : ''}`}>
                <textarea
                  rows={4}
                  placeholder={T.submit_complaint_placeholder}
                  value={form.text}
                  onChange={e => handleTextChange(e.target.value)}
                  disabled={analyzing}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-transparent resize-none transition-all input-premium"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{form.text.length} {T.submit_characters}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Upload Photo Evidence
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={e => setPhotoFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 transition-all cursor-pointer"
              />
            </div>

            <button
              onClick={runAnalysis}
              disabled={form.text.length < 10 || analyzing}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all btn-premium active:scale-95 shadow-sm"
            >
              {analyzing ? <Loader size={15} className="animate-spin" /> : <Brain size={15} />}
              {analyzing ? T.submit_analyzing : T.submit_analyze}
            </button>
          </div>
          </ScrollReveal>

          {/* AI Analysis */}
          {analysis && (
            <ScrollReveal direction="scale">
              <div className="bg-white rounded-2xl border border-indigo-100 ring-1 ring-indigo-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
                  <Brain size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{T.submit_analysis_complete}</h3>
                  <p className="text-xs text-gray-400">{T.submit_language}: {analysis.language === 'hi' ? T.submit_language_detected('hi') : T.submit_language_detected('en')}</p>
                </div>
                <span className="ml-auto text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">{T.submit_analyzed}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: T.submit_issue_type, value: analysis.issue_type },
                  { label: T.submit_department, value: analysis.department },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">{label}</p>
                    <p className="font-bold text-gray-900 text-sm">{value}</p>
                  </div>
                ))}
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">{T.submit_urgency}</p>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold border ${URGENCY_CONFIG[analysis.urgency].color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${URGENCY_CONFIG[analysis.urgency].dot}`}></span>
                    {analysis.urgency === 'LOW' ? T.urgency_low : analysis.urgency === 'MEDIUM' ? T.urgency_medium : analysis.urgency === 'HIGH' ? T.urgency_high : T.urgency_critical}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">{T.submit_language}</p>
                  <p className="font-bold text-gray-900 text-sm">{analysis.language === 'hi' ? 'हिंदी' : 'English'}</p>
                </div>
              </div>

              <div className="bg-indigo-50 rounded-xl p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">{T.submit_ai_summary}</p>
                <p className="text-sm text-gray-800">{analysis.summary}</p>
              </div>

              {analysis.risk_tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  <AlertTriangle size={13} className="text-red-500" />
                  <span className="text-xs text-gray-500 font-medium">{T.submit_risk_factors}</span>
                  {(analysis.risk_tags || [])?.map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full font-medium">{tag}</span>
                  ))}
                </div>
              )}

              <button
                onClick={() => setLetterVisible(!letterVisible)}
                className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-semibold transition-colors"
              >
                <FileText size={14} />
                {letterVisible ? T.submit_hide_letter : T.submit_view_letter} {T.submit_complaint_letter}
              </button>

              {letterVisible && (
                <div className="mt-3 space-y-3">
                  {/* Download buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadLetter(generateLetter(), `Complaint-Letter-English.txt`)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold rounded-lg transition-all"
                    >
                      <Download size={12} /> {T.submit_download_english}
                    </button>
                    <button
                      onClick={() => downloadLetter(generateHindiLetter(), `Complaint-Letter-Hindi.txt`)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 text-xs font-bold rounded-lg transition-all"
                    >
                      <Download size={12} /> {T.submit_download_hindi}
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(generateLetter())}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-lg transition-all"
                    >
                      <Copy size={12} /> {T.submit_copy}
                    </button>
                  </div>
                  {/* Preview */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{T.submit_english_preview}</p>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{generateLetter()}</pre>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-2">हिंदी पूर्वावलोकन</p>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{generateHindiLetter()}</pre>
                  </div>
                </div>
              )}
            </div>
            </ScrollReveal>
          )}

          {/* Location Details */}
          <ScrollReveal direction="up" delay={300}>
            <div className={`bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-300 ${shouldShake ? 'animate-shake' : ''}`}>
              <h2 className="font-bold text-gray-900 mb-5 text-lg flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">3</span>
                Location Details
              </h2>
              
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">City <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-3">
                  {['Delhi', 'Ghaziabad'].map((cityOption) => (
                    <button
                      key={cityOption}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, city: cityOption, area: '', ward: '' }))}
                      className={`py-3 rounded-xl border font-semibold text-sm transition-all ${
                        form.city === cityOption
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600 hover:border-orange-300 hover:bg-orange-50'
                      }`}
                    >
                      {cityOption}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="mb-4 relative">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Area / Locality <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    value={form.area}
                    onChange={(e) => {
                      const selectedArea = e.target.value;
                      const locationMatch = LOCATIONS.find(loc => loc.area === selectedArea && loc.city === form.city);
                      setForm(f => ({
                        ...f,
                        area: selectedArea,
                        ward: locationMatch ? locationMatch.ward : ''
                      }));
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-transparent transition-all input-premium appearance-none bg-white cursor-pointer pr-10"
                  >
                    <option value="">Select area in {form.city}</option>
                    {LOCATIONS.filter(loc => loc.city === form.city).map(loc => (
                      <option key={loc.area} value={loc.area}>{loc.area}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ward</label>
                <input
                  type="text"
                  readOnly
                  placeholder="Auto-filled from area"
                  value={form.ward}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-500 cursor-not-allowed transition-all input-premium"
                />
              </div>
            </div>
          </ScrollReveal>

          {error && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !analysis}
            className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg rounded-2xl transition-all shadow-lg hover:shadow-xl btn-premium active:scale-95"
          >
            {submitting ? (
              <><Loader size={20} className="animate-spin" /> {T.submit_submitting}</>
            ) : (
              <>{T.submit_submit_btn} <ArrowRight size={20} /></>
            )}
          </button>
          {!analysis && (
            <p className="text-center text-xs text-gray-400">{T.submit_analyze_first}</p>
          )}
        </div>
      </div>

      {/* Location blocking modal */}
      {(location.permission === 'denied' || location.permission === 'unavailable') && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-5">
              <MapPin size={28} className="text-orange-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{T.location_required_title}</h2>
            <p className="text-gray-500 text-sm mb-2">{T.location_required_msg}</p>
            {location.permission === 'unavailable' && (
              <p className="text-gray-400 text-xs mb-4">{T.location_unsupported}</p>
            )}
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={onRequestLocation}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all"
              >
                {T.location_grant_btn}
              </button>
              <button
                onClick={() => onNavigate('home')}
                className="w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
              >
                {T.location_go_back}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
