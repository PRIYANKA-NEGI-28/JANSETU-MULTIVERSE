import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Brain,
  MapPin,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Mic,
  MicOff,
  Camera,
  ImageIcon,
  X,
  Navigation,
  RefreshCw,
  Clock,
  Sparkles,
  WifiOff,
} from 'lucide-react-native';
import { useState, useRef, useEffect } from 'react';
import {
  createComplaint,
  type ComplaintDto,
} from '../../src/lib/api-client';
import { useOfflineSync } from '../../src/offline';
import type { UrgencyLevel } from '@jansetu/shared';
import { analyzeComplaint, type AIAnalysis } from '../../src/lib/aiAnalyzer';
import { LOCATIONS, CITY_OPTIONS } from '../../src/lib/locations';
import { useLang } from '../../src/contexts/LanguageContext';
import {
  MobileAudioRecorder,
  MAX_RECORDING_DURATION_SEC,
} from '../../src/lib/audioRecorder';
import {
  capturePhotoWithCamera,
  pickPhotoFromLibrary,
  type ProcessedImage,
} from '../../src/lib/imageCompressor';
import {
  getCurrentCivicLocation,
  type LocationTagResult,
} from '../../src/lib/locationService';

interface FormState {
  readonly name: string;
  readonly phone: string;
  readonly text: string;
  readonly city: string;
  readonly area: string;
  readonly ward: string;
  readonly coordinates?: { readonly latitude: number; readonly longitude: number };
  readonly photoUrl?: string | null;
}

const URGENCY_CONFIG: Record<
  UrgencyLevel,
  { readonly label: string; readonly colors: string; readonly text: string; readonly dot: string }
> = {
  LOW: { label: 'Low', colors: 'bg-blue-100 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  MEDIUM: { label: 'Medium', colors: 'bg-yellow-100 border-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  HIGH: { label: 'High', colors: 'bg-orange-100 border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
  CRITICAL: { label: 'Critical', colors: 'bg-red-100 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
};

export default function SubmitScreen() {
  const { T } = useLang();
  const router = useRouter();
  const { isOnline, enqueueComplaint } = useOfflineSync();

  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    text: '',
    city: 'Delhi',
    area: '',
    ward: '',
    photoUrl: null,
  });

  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [isOfflineSubmission, setIsOfflineSubmission] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Voice recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [transcribing, setTranscribing] = useState<boolean>(false);
  const [detectedVoiceLang, setDetectedVoiceLang] = useState<string | null>(null);
  const recorderRef = useRef<MobileAudioRecorder | null>(null);

  // Photo state
  const [photo, setPhoto] = useState<ProcessedImage | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);

  // Location tagging state
  const [locating, setLocating] = useState<boolean>(false);
  const [locationTag, setLocationTag] = useState<LocationTagResult | null>(null);
  const [manualLocationMode, setManualLocationMode] = useState<boolean>(false);

  // Clean up recorder on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        void recorderRef.current.cancel();
      }
    };
  }, []);

  // Voice recorder handlers
  async function toggleRecording(): Promise<void> {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }

  async function startRecording(): Promise<void> {
    setError('');
    const recorder = new MobileAudioRecorder({
      onDurationUpdate: (sec) => setRecordingSeconds(sec),
      onMaxReached: () => {
        void stopRecording();
      },
    });

    recorderRef.current = recorder;
    const started = await recorder.start();
    if (started) {
      setIsRecording(true);
      setRecordingSeconds(0);
    } else {
      setError('Unable to activate microphone. Please check permissions.');
    }
  }

  async function stopRecording(): Promise<void> {
    if (!recorderRef.current) return;
    setIsRecording(false);
    setTranscribing(true);

    try {
      const result = await recorderRef.current.stop();
      if (result && result.transcript) {
        setForm((prev) => ({
          ...prev,
          text: prev.text ? `${prev.text}\n${result.transcript}` : result.transcript,
        }));
        setDetectedVoiceLang(result.detectedLang);
        // Automatically analyze after transcription
        const analyzed = analyzeComplaint(result.transcript);
        setAnalysis(analyzed);
      }
    } catch {
      setError('Audio transcription was unavailable. You can type your grievance.');
    } finally {
      setTranscribing(false);
      recorderRef.current = null;
    }
  }

  // Location handler
  async function handleDetectLocation(): Promise<void> {
    setLocating(true);
    setError('');
    try {
      const loc = await getCurrentCivicLocation();
      if (loc) {
        setLocationTag(loc);
        setForm((prev) => ({
          ...prev,
          city: loc.city,
          area: loc.area,
          ward: loc.ward,
          coordinates: { latitude: loc.latitude, longitude: loc.longitude },
        }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not detect location';
      Alert.alert('Location Access', msg, [
        { text: 'Set Manually', onPress: () => setManualLocationMode(true) },
        { text: 'OK' },
      ]);
    } finally {
      setLocating(false);
    }
  }

  // Photo handlers
  async function handleCapturePhoto(): Promise<void> {
    setUploadingPhoto(true);
    setError('');
    try {
      const img = await capturePhotoWithCamera();
      if (img) {
        setPhoto(img);
        setForm((prev) => ({ ...prev, photoUrl: img.publicUrl || img.uri }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera capture failed';
      setError(msg);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handlePickPhoto(): Promise<void> {
    setUploadingPhoto(true);
    setError('');
    try {
      const img = await pickPhotoFromLibrary();
      if (img) {
        setPhoto(img);
        setForm((prev) => ({ ...prev, photoUrl: img.publicUrl || img.uri }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Photo selection failed';
      setError(msg);
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handleRemovePhoto(): void {
    setPhoto(null);
    setForm((prev) => ({ ...prev, photoUrl: null }));
  }

  // AI Analysis trigger
  async function runAnalysis(): Promise<void> {
    if (!form.text.trim() || form.text.length < 10) return;
    setAnalyzing(true);
    await new Promise((r) => setTimeout(r, 600));
    setAnalysis(analyzeComplaint(form.text));
    setAnalyzing(false);
  }

  // Submit grievance
  async function handleSubmit(): Promise<void> {
    if (!form.name.trim() || !form.text.trim() || !form.area.trim() || !form.ward.trim()) {
      setError(T.submit_error_fields || 'Please fill in all mandatory fields.');
      return;
    }
    if (!analysis) {
      setError(T.submit_error_analyze || 'Please analyze the complaint before submitting.');
      return;
    }

    setError('');
    setSubmitting(true);

    const submissionPayload = {
      citizenName: form.name.trim(),
      citizenPhone: form.phone.trim() || '',
      rawText: form.text.trim(),
      language: analysis.language,
      issueType: analysis.issue_type,
      summary: analysis.summary,
      urgency: analysis.urgency,
      department: analysis.department,
      area: form.area.trim(),
      ward: form.ward.trim(),
      photoUrl: form.photoUrl || null,
      coordinates: form.coordinates,
    };

    // If offline, directly persist to SQLite outbox
    if (!isOnline) {
      try {
        const item = await enqueueComplaint(
          submissionPayload,
          photo?.uri ? [photo.uri] : []
        );
        setSubmitted(item.idempotencyKey);
        setIsOfflineSubmission(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save offline';
        setError(msg);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Attempt online submission
    try {
      const res = await createComplaint(submissionPayload);
      setSubmitted(res.complaintNumber);
      setIsOfflineSubmission(false);
    } catch (err: unknown) {
      // Fallback: save to offline outbox if online submission failed
      try {
        const item = await enqueueComplaint(
          submissionPayload,
          photo?.uri ? [photo.uri] : []
        );
        setSubmitted(item.idempotencyKey);
        setIsOfflineSubmission(true);
      } catch {
        const msg = err instanceof Error ? err.message : (T.submit_error_submit || 'Submission failed');
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Success view
  if (submitted) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center', justifyContent: 'center', minHeight: '90%' }}>
          <View className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md items-center border border-gray-100">
            <View className={`w-20 h-20 rounded-full ${isOfflineSubmission ? 'bg-amber-50' : 'bg-green-50'} items-center justify-center mb-6`}>
              {isOfflineSubmission ? (
                <WifiOff size={40} color="#d97706" />
              ) : (
                <CheckCircle size={44} color="#16a34a" />
              )}
            </View>
            <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
              {isOfflineSubmission ? 'Saved Offline — Will Auto-Sync' : T.submit_success_title}
            </Text>
            <Text className="text-gray-500 text-center mb-6">
              {isOfflineSubmission
                ? 'Your grievance has been stored securely in your on-device outbox. As soon as you regain internet connection, media will upload and the complaint will automatically register.'
                : T.submit_success_msg}
            </Text>

            <View className={`${isOfflineSubmission ? 'bg-amber-50 border-amber-200' : 'bg-orange-50 border-orange-200'} border rounded-2xl p-5 mb-6 w-full`}>
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center mb-1">
                {isOfflineSubmission ? 'Idempotency Key (Outbox Ref)' : T.submit_your_number}
              </Text>
              <Text className={`text-xl font-black ${isOfflineSubmission ? 'text-amber-800' : 'text-orange-600'} text-center tracking-wider font-mono`}>
                {submitted}
              </Text>
              <Text className="text-xs text-gray-400 text-center mt-2">
                {isOfflineSubmission ? 'Safe for repeated submission without duplication' : T.submit_save_number}
              </Text>
            </View>

            <View className="gap-3 w-full">
              <Pressable
                onPress={() => router.push('/track')}
                className="flex-row items-center justify-center gap-2 px-6 py-4 bg-orange-500 rounded-xl active:bg-orange-600"
              >
                <Text className="text-white font-semibold text-base">{T.submit_track_btn}</Text>
                <ArrowRight size={18} color="white" />
              </Pressable>
              <Pressable
                onPress={() => {
                  setSubmitted(null);
                  setIsOfflineSubmission(false);
                  setForm({ name: '', phone: '', text: '', city: 'Delhi', area: '', ward: '', photoUrl: null });
                  setAnalysis(null);
                  setPhoto(null);
                  setLocationTag(null);
                  setDetectedVoiceLang(null);
                }}
                className="px-6 py-3.5 bg-gray-100 rounded-xl active:bg-gray-200"
              >
                <Text className="text-gray-700 font-semibold text-center">{T.submit_file_another}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Header */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-1">
            <Brain size={16} color="#f97316" />
            <Text className="text-xs font-bold text-orange-600 uppercase tracking-widest">{T.submit_badge}</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900 mb-1">{T.submit_title}</Text>
          <Text className="text-gray-500 text-sm">{T.submit_subtitle}</Text>
        </View>

        {/* Offline Banner */}
        {!isOnline && (
          <View className="mb-4 flex-row items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
            <WifiOff size={22} color="#d97706" />
            <View className="flex-1">
              <Text className="text-amber-900 font-bold text-sm">Offline Mode Active</Text>
              <Text className="text-amber-700 text-xs mt-0.5 leading-relaxed">
                You are currently offline. Grievances will be saved to your local outbox and automatically synced when connection is restored.
              </Text>
            </View>
          </View>
        )}

        {/* Step 1: Citizen Details */}
        <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
          <View className="flex-row items-center gap-2 mb-4">
            <View className="w-6 h-6 rounded-full bg-orange-500 items-center justify-center">
              <Text className="text-white text-xs font-bold">1</Text>
            </View>
            <Text className="font-bold text-gray-900 text-base">{T.submit_step1}</Text>
          </View>
          <View className="gap-3">
            <View>
              <Text className="text-xs font-semibold text-gray-700 mb-1">{T.submit_full_name} *</Text>
              <TextInput
                value={form.name}
                onChangeText={(name) => setForm((f) => ({ ...f, name }))}
                placeholder={T.submit_name_placeholder}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View>
              <Text className="text-xs font-semibold text-gray-700 mb-1">{T.submit_phone}</Text>
              <TextInput
                value={form.phone}
                onChangeText={(phone) => setForm((f) => ({ ...f, phone: phone.replace(/[^0-9]/g, '') }))}
                placeholder={T.submit_phone_placeholder}
                keyboardType="phone-pad"
                maxLength={10}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>
        </View>

        {/* Step 2: Voice Input & Grievance Description */}
        <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
          <View className="flex-row items-center gap-2 mb-4">
            <View className="w-6 h-6 rounded-full bg-orange-500 items-center justify-center">
              <Text className="text-white text-xs font-bold">2</Text>
            </View>
            <Text className="font-bold text-gray-900 text-base">{T.submit_step2}</Text>
          </View>

          {/* Voice Recorder Card */}
          <View className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4 mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <Mic size={18} color="#ea580c" />
                <Text className="font-bold text-orange-900 text-sm">{T.submit_voice_title}</Text>
              </View>
              {detectedVoiceLang && (
                <View className="px-2.5 py-0.5 bg-orange-100 rounded-full">
                  <Text className="text-xs font-semibold text-orange-800">
                    {detectedVoiceLang === 'hi' ? 'हिंदी (Hindi)' : 'English'}
                  </Text>
                </View>
              )}
            </View>

            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => void toggleRecording()}
                disabled={transcribing}
                className={`flex-row items-center justify-center gap-2 px-5 py-3 rounded-xl flex-1 ${
                  isRecording ? 'bg-red-500' : 'bg-orange-500'
                }`}
              >
                {isRecording ? <MicOff size={18} color="white" /> : <Mic size={18} color="white" />}
                <Text className="text-white font-bold text-sm">
                  {isRecording ? `${T.submit_voice_stop} (${MAX_RECORDING_DURATION_SEC - recordingSeconds}s)` : T.submit_voice_speak}
                </Text>
              </Pressable>

              {isRecording && (
                <View className="flex-row items-center gap-1.5 px-3 py-2 bg-red-100 rounded-xl">
                  <View className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                  <Text className="text-xs font-bold text-red-700">
                    00:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}
                  </Text>
                </View>
              )}
            </View>

            {transcribing && (
              <View className="flex-row items-center gap-2 mt-3 pt-3 border-t border-orange-200">
                <ActivityIndicator size="small" color="#ea580c" />
                <Text className="text-xs font-semibold text-orange-800">Transcribing voice grievance via AI...</Text>
              </View>
            )}
          </View>

          {/* Editable Grievance Description */}
          <View className="mb-3">
            <Text className="text-xs font-semibold text-gray-700 mb-1">{T.submit_complaint_text} *</Text>
            <TextInput
              value={form.text}
              onChangeText={(text) => {
                setForm((f) => ({ ...f, text }));
                setAnalysis(null);
              }}
              placeholder={T.submit_complaint_placeholder}
              multiline
              numberOfLines={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
              style={{ textAlignVertical: 'top', minHeight: 90 }}
              placeholderTextColor="#9ca3af"
            />
            <Text className="text-xs text-gray-400 mt-1">{form.text.length} {T.submit_characters}</Text>
          </View>

          <Pressable
            onPress={() => void runAnalysis()}
            disabled={form.text.length < 10 || analyzing}
            className={`flex-row items-center justify-center gap-2 px-4 py-3 rounded-xl ${
              form.text.length < 10 ? 'bg-gray-200' : 'bg-indigo-600 active:bg-indigo-700'
            }`}
          >
            {analyzing ? <ActivityIndicator size="small" color="white" /> : <Brain size={16} color="white" />}
            <Text className="text-white text-sm font-semibold">
              {analyzing ? T.submit_analyzing : T.submit_analyze}
            </Text>
          </Pressable>
        </View>

        {/* AI Classification Card */}
        {analysis && (
          <View className="bg-white rounded-2xl border border-indigo-100 p-5 mb-4 shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-xl bg-indigo-600 items-center justify-center">
                  <Sparkles size={16} color="white" />
                </View>
                <View>
                  <Text className="font-bold text-gray-900 text-sm">{T.submit_analysis_complete}</Text>
                  <Text className="text-xs text-gray-400">
                    {T.submit_language}: {analysis.language === 'hi' ? 'हिंदी' : 'English'}
                  </Text>
                </View>
              </View>
              <View className={`flex-row items-center gap-1 px-2.5 py-1 rounded-full ${URGENCY_CONFIG[analysis.urgency].colors}`}>
                <View className={`w-1.5 h-1.5 rounded-full ${URGENCY_CONFIG[analysis.urgency].dot}`} />
                <Text className={`text-xs font-bold ${URGENCY_CONFIG[analysis.urgency].text}`}>
                  {analysis.urgency}
                </Text>
              </View>
            </View>

            <View className="gap-2 mb-3">
              <View className="flex-row gap-2">
                <View className="flex-1 bg-gray-50 rounded-xl p-3">
                  <Text className="text-xs text-gray-400 uppercase tracking-wide mb-1">{T.submit_issue_type}</Text>
                  <Text className="font-bold text-gray-900 text-sm">{analysis.issue_type}</Text>
                </View>
                <View className="flex-1 bg-gray-50 rounded-xl p-3">
                  <Text className="text-xs text-gray-400 uppercase tracking-wide mb-1">{T.submit_department}</Text>
                  <Text className="font-bold text-gray-900 text-sm" numberOfLines={1}>{analysis.department.split(' ')[0]}</Text>
                </View>
              </View>
            </View>

            <View className="bg-indigo-50 rounded-xl p-3">
              <Text className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-1">{T.submit_ai_summary}</Text>
              <Text className="text-xs text-gray-700 leading-relaxed">{analysis.summary}</Text>
            </View>
          </View>
        )}

        {/* Step 3: Photographic Evidence (max 1280px / <300KB) */}
        <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
          <View className="flex-row items-center gap-2 mb-3">
            <View className="w-6 h-6 rounded-full bg-orange-500 items-center justify-center">
              <Text className="text-white text-xs font-bold">3</Text>
            </View>
            <Text className="font-bold text-gray-900 text-base">Photo Evidence</Text>
          </View>
          <Text className="text-xs text-gray-500 mb-4">
            Attach photo evidence of the civic hazard. Images are resized to max 1280px and compressed (&lt;300KB).
          </Text>

          {photo ? (
            <View className="relative rounded-2xl overflow-hidden border border-gray-200 mb-2">
              <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 200 }} resizeMode="cover" />
              <Pressable
                onPress={handleRemovePhoto}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 items-center justify-center active:bg-black"
              >
                <X size={16} color="white" />
              </Pressable>
              <View className="p-3 bg-white flex-row items-center justify-between">
                <Text className="text-xs text-green-700 font-semibold">✓ Compressed & Uploaded to R2</Text>
                <Text className="text-xs text-gray-400">{photo.width} × {photo.height}</Text>
              </View>
            </View>
          ) : (
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => void handleCapturePhoto()}
                disabled={uploadingPhoto}
                className="flex-1 flex-row items-center justify-center gap-2 py-3.5 px-3 border border-orange-300 bg-orange-50 rounded-xl active:bg-orange-100"
              >
                <Camera size={18} color="#ea580c" />
                <Text className="text-orange-800 font-bold text-xs">Take Photo</Text>
              </Pressable>

              <Pressable
                onPress={() => void handlePickPhoto()}
                disabled={uploadingPhoto}
                className="flex-1 flex-row items-center justify-center gap-2 py-3.5 px-3 border border-gray-200 bg-gray-50 rounded-xl active:bg-gray-100"
              >
                <ImageIcon size={18} color="#4b5563" />
                <Text className="text-gray-700 font-bold text-xs">From Gallery</Text>
              </Pressable>
            </View>
          )}

          {uploadingPhoto && (
            <View className="flex-row items-center justify-center gap-2 mt-3 pt-2">
              <ActivityIndicator size="small" color="#ea580c" />
              <Text className="text-xs text-gray-500 font-medium">Compressing & Presigning R2 Upload...</Text>
            </View>
          )}
        </View>

        {/* Step 4: Location Tagging (GPS + Ward Resolution) */}
        <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 shadow-sm">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <View className="w-6 h-6 rounded-full bg-orange-500 items-center justify-center">
                <Text className="text-white text-xs font-bold">4</Text>
              </View>
              <Text className="font-bold text-gray-900 text-base">{T.submit_step3}</Text>
            </View>
            <Pressable
              onPress={() => setManualLocationMode(!manualLocationMode)}
              className="px-2 py-1 bg-gray-100 rounded-md"
            >
              <Text className="text-xs text-gray-600 font-medium">
                {manualLocationMode ? 'Use GPS' : 'Manual Pin'}
              </Text>
            </Pressable>
          </View>

          {/* GPS Detector Button */}
          {!manualLocationMode ? (
            <View className="gap-3">
              <Pressable
                onPress={() => void handleDetectLocation()}
                disabled={locating}
                className="flex-row items-center justify-center gap-2.5 py-3.5 px-4 bg-orange-500 rounded-xl active:bg-orange-600 shadow-sm"
              >
                {locating ? <ActivityIndicator size="small" color="white" /> : <Navigation size={18} color="white" />}
                <Text className="text-white font-bold text-sm">
                  {locating ? 'Resolving Municipal Ward...' : 'Detect GPS & Resolve Ward'}
                </Text>
              </Pressable>

              {locationTag ? (
                <View className="bg-green-50 border border-green-200 rounded-xl p-3.5 gap-1.5">
                  <View className="flex-row items-center gap-1.5">
                    <CheckCircle size={14} color="#16a34a" />
                    <Text className="text-xs font-bold text-green-800">Ward Geo-Resolved</Text>
                  </View>
                  <Text className="text-xs text-gray-700">
                    <Text className="font-semibold">City:</Text> {form.city} • <Text className="font-semibold">Ward:</Text> {form.ward}
                  </Text>
                  <Text className="text-xs text-gray-600">
                    <Text className="font-semibold">Area / Address:</Text> {form.area}
                  </Text>
                  <Text className="text-[10px] text-gray-400">
                    GPS: {form.coordinates?.latitude.toFixed(5)}, {form.coordinates?.longitude.toFixed(5)}
                  </Text>
                </View>
              ) : (
                <Text className="text-xs text-gray-400 text-center">
                  Press above to automatically geo-tag coordinates and lookup your municipal ward.
                </Text>
              )}
            </View>
          ) : (
            <View className="gap-3">
              {/* City Selection */}
              <View>
                <Text className="text-xs font-semibold text-gray-700 mb-1">{T.submit_city} *</Text>
                <View className="flex-row gap-2">
                  {CITY_OPTIONS.map((city) => (
                    <Pressable
                      key={city}
                      onPress={() => setForm((f) => ({ ...f, city, area: '', ward: '' }))}
                      className={`flex-1 py-2.5 rounded-xl border ${
                        form.city === city ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold text-center ${
                          form.city === city ? 'text-orange-700' : 'text-gray-500'
                        }`}
                      >
                        {city}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Area Selection */}
              <View>
                <Text className="text-xs font-semibold text-gray-700 mb-1">{T.submit_area} *</Text>
                <TextInput
                  value={form.area}
                  onChangeText={(area) => {
                    const loc = LOCATIONS.find((l) => l.area.toLowerCase() === area.toLowerCase());
                    setForm((f) => ({ ...f, area, ward: loc?.ward || f.ward || 'Ward 1' }));
                  }}
                  placeholder={`${T.submit_select_area} ${form.city}`}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              {/* Ward Display */}
              <View>
                <Text className="text-xs font-semibold text-gray-700 mb-1">{T.submit_ward} *</Text>
                <TextInput
                  value={form.ward}
                  onChangeText={(ward) => setForm((f) => ({ ...f, ward }))}
                  placeholder={T.submit_ward_auto}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>
          )}
        </View>

        {/* Error Notification */}
        {error ? (
          <View className="flex-row items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl mb-4">
            <AlertTriangle size={18} color="#dc2626" />
            <Text className="text-red-700 text-xs flex-1 font-medium">{error}</Text>
          </View>
        ) : null}

        {/* Submit Button */}
        <Pressable
          onPress={() => void handleSubmit()}
          disabled={submitting || !analysis}
          className={`flex-row items-center justify-center gap-3 px-8 py-4 rounded-2xl ${
            submitting || !analysis ? 'bg-gray-300' : 'bg-orange-500 active:bg-orange-600'
          }`}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <ArrowRight size={20} color="white" />
          )}
          <Text className="text-white font-bold text-base">
            {submitting ? T.submit_submitting : T.submit_submit_btn}
          </Text>
        </Pressable>

        {!analysis && (
          <Text className="text-center text-xs text-gray-400 mt-3">{T.submit_analyze_first}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
