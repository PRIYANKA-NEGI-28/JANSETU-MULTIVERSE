import { ScrollView, View, Text, Pressable, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import {
  Brain, MapPin, AlertTriangle, CheckCircle, ArrowRight, Loader,
  FileText, Mic, MicOff, Volume2, ChevronDown, LogIn, Download
} from 'lucide-react-native';
import { useState, useEffect, useRef } from 'react';
import * as Speech from 'expo-speech';
import { createComplaint } from '../../lib/neo4j';
import { analyzeComplaint } from '../../lib/aiAnalyzer';
import { LOCATIONS, CITY_OPTIONS } from '../../lib/locations';
import { useLang } from '../../lib/langContext';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const URGENCY_CONFIG = {
  LOW: { label: 'Low', colors: 'bg-blue-100 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  MEDIUM: { label: 'Medium', colors: 'bg-yellow-100 border-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  HIGH: { label: 'High', colors: 'bg-orange-100 border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
  CRITICAL: { label: 'Critical', colors: 'bg-red-100 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
};

export default function SubmitScreen() {
  const { T } = useLang();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    text: '',
    area: '',
    ward: '',
    city: 'Delhi',
  });
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzeComplaint> | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceLang, setVoiceLang] = useState('hi-IN');

  const filteredLocations = LOCATIONS.filter(l => l.city === form.city);

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
${form.ward || 'Local Ward Office'}, ${form.city} Municipal Authority

Subject: Formal Complaint Regarding ${analysis.issue_type} — Urgent Action Required

Respected Sir/Madam,

I, ${form.name || 'A Concerned Citizen'}, residing in ${form.area || 'the mentioned area'}, ${form.ward || form.city}, wish to bring to your notice the following civic issue affecting our locality.

Issue Category: ${analysis.issue_type}
Urgency Level: ${analysis.urgency}
Summary: ${analysis.summary}

Original Complaint:
"${form.text}"

I humbly request your department to take prompt action and resolve the above-mentioned issue at the earliest.

Yours faithfully,
${form.name || 'Concerned Citizen'}
Date: ${date}`;
  }

  async function handleSubmit() {
    if (!form.name || !form.text || !form.area || !form.ward) {
      setError(T.submit_error_fields);
      return;
    }
    if (!analysis) {
      setError(T.submit_error_analyze);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const complaintNumber = await createComplaint({
        citizenName: form.name,
        citizenPhone: form.phone || '',
        rawText: form.text,
        language: analysis.language,
        issueType: analysis.issue_type,
        summary: analysis.summary,
        urgency: analysis.urgency,
        department: analysis.department,
        area: form.area,
        ward: form.ward,
        userId: undefined,
      });
      setSubmitted(complaintNumber);
    } catch {
      setError(T.submit_error_submit);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <ScrollView className="flex-1 bg-gray-50">
        <View className="p-6 items-center justify-center min-h-[80vh]">
          <View className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md items-center">
            <View className="w-20 h-20 rounded-full bg-green-50 items-center justify-center mb-6">
              <CheckCircle size={40} color="#22c55e" />
            </View>
            <Text className="text-2xl font-bold text-gray-900 mb-2">{T.submit_success_title}</Text>
            <Text className="text-gray-500 text-center mb-6">{T.submit_success_msg}</Text>

            <View className="bg-orange-50 border border-orange-100 rounded-2xl p-5 mb-6 w-full">
              <Text className="text-sm text-gray-500 text-center mb-1">{T.submit_your_number}</Text>
              <Text className="text-2xl font-black text-orange-600 text-center tracking-widest">{submitted}</Text>
              <Text className="text-xs text-gray-400 text-center mt-2">{T.submit_save_number}</Text>
            </View>

            <View className="gap-3 w-full">
              <Pressable
                onPress={() => router.push('/track')}
                className="flex-row items-center justify-center gap-2 px-6 py-3 bg-orange-500 rounded-xl active:bg-orange-600"
              >
                <Text className="text-white font-semibold">{T.submit_track_btn}</Text>
                <ArrowRight size={16} color="white" />
              </Pressable>
              <Pressable
                onPress={() => {
                  setSubmitted(null);
                  setForm({ name: '', phone: '', text: '', area: '', ward: '', city: 'Delhi' });
                  setAnalysis(null);
                }}
                className="px-6 py-3 bg-gray-100 rounded-xl active:bg-gray-200"
              >
                <Text className="text-gray-700 font-semibold text-center">{T.submit_file_another}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4 pt-8">
        <View className="flex-row items-center gap-2 mb-1">
          <Brain size={16} color="#f97316" />
          <Text className="text-xs font-bold text-orange-600 uppercase tracking-widest">{T.submit_badge}</Text>
        </View>
        <Text className="text-3xl font-bold text-gray-900 mb-1">{T.submit_title}</Text>
        <Text className="text-gray-500 mb-6">{T.submit_subtitle}</Text>

        {/* Step 1: Personal Info */}
        <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <View className="flex-row items-center gap-2 mb-4">
            <View className="w-6 h-6 rounded-full bg-orange-500 items-center justify-center">
              <Text className="text-white text-xs font-bold">1</Text>
            </View>
            <Text className="font-bold text-gray-900 text-lg">{T.submit_step1}</Text>
          </View>
          <View className="gap-4">
            <View>
              <Text className="text-sm font-semibold text-gray-700 mb-1.5">{T.submit_full_name} *</Text>
              <TextInput
                value={form.name}
                onChangeText={name => setForm(f => ({ ...f, name }))}
                placeholder={T.submit_name_placeholder}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View>
              <Text className="text-sm font-semibold text-gray-700 mb-1.5">{T.submit_phone}</Text>
              <TextInput
                value={form.phone}
                onChangeText={phone => setForm(f => ({ ...f, phone }))}
                placeholder={T.submit_phone_placeholder}
                keyboardType="phone-pad"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>
        </View>

        {/* Step 2: Complaint */}
        <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <View className="flex-row items-center gap-2 mb-4">
            <View className="w-6 h-6 rounded-full bg-orange-500 items-center justify-center">
              <Text className="text-white text-xs font-bold">2</Text>
            </View>
            <Text className="font-bold text-gray-900 text-lg">{T.submit_step2}</Text>
          </View>

          {/* Voice Controls */}
          <View className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl p-4 mb-4">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-2">
                <Volume2 size={16} color="#6366f1" />
                <Text className="text-sm font-bold text-indigo-700">{T.submit_voice_title}</Text>
              </View>
              <Pressable
                onPress={() => setIsRecording(!isRecording)}
                className={`flex-row items-center gap-2 px-3 py-1.5 rounded-xl ${isRecording ? 'bg-red-500' : 'bg-indigo-600'}`}
              >
                {isRecording ? <MicOff size={14} color="white" /> : <Mic size={14} color="white" />}
                <Text className="text-white text-xs font-bold">{isRecording ? T.submit_voice_stop : T.submit_voice_speak}</Text>
              </Pressable>
            </View>
            {isRecording && (
              <View className="flex-row items-center gap-2">
                <View className="flex-row gap-0.5">
                  {[0, 1, 2, 3].map(i => (
                    <View key={i} className={`w-1 rounded-full bg-indigo-500`} style={{ height: 8 + i * 4 }} />
                  ))}
                </View>
                <Text className="text-indigo-600 text-sm font-medium">{T.submit_voice_recording}</Text>
              </View>
            )}
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-1.5">
              {T.submit_complaint_text} *
            </Text>
            <TextInput
              value={form.text}
              onChangeText={text => { setForm(f => ({ ...f, text })); setAnalysis(null); }}
              placeholder={T.submit_complaint_placeholder}
              multiline
              numberOfLines={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white text-left"
              style={{ textAlignVertical: 'top' }}
              placeholderTextColor="#9ca3af"
            />
            <Text className="text-xs text-gray-400 mt-1">{form.text.length} {T.submit_characters}</Text>
          </View>

          <Pressable
            onPress={runAnalysis}
            disabled={form.text.length < 10 || analyzing}
            className={`flex-row items-center justify-center gap-2 px-4 py-2.5 rounded-xl ${form.text.length < 10 ? 'bg-gray-200' : 'bg-indigo-600'}`}
          >
            {analyzing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Brain size={15} color="white" />
            )}
            <Text className="text-white text-sm font-semibold">
              {analyzing ? T.submit_analyzing : T.submit_analyze}
            </Text>
          </Pressable>
        </View>

        {/* AI Analysis */}
        {analysis && (
          <View className="bg-white rounded-2xl border border-indigo-100 p-5 mb-4">
            <View className="flex-row items-center gap-2 mb-4">
              <View className="w-8 h-8 rounded-xl bg-indigo-600 items-center justify-center">
                <Brain size={16} color="white" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-gray-900 text-sm">{T.submit_analysis_complete}</Text>
                <Text className="text-xs text-gray-400">
                  {T.submit_language}: {analysis.language === 'hi' ? 'हिंदी' : 'English'}
                </Text>
              </View>
              <Text className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">{T.submit_analyzed}</Text>
            </View>

            <View className="gap-3 mb-4">
              <View className="flex-row gap-3">
                <View className="flex-1 bg-gray-50 rounded-xl p-3">
                  <Text className="text-xs text-gray-400 uppercase tracking-wide mb-1">{T.submit_issue_type}</Text>
                  <Text className="font-bold text-gray-900 text-sm">{analysis.issue_type}</Text>
                </View>
                <View className="flex-1 bg-gray-50 rounded-xl p-3">
                  <Text className="text-xs text-gray-400 uppercase tracking-wide mb-1">{T.submit_department}</Text>
                  <Text className="font-bold text-gray-900 text-sm" numberOfLines={1}>{analysis.department.split(' ')[0]}</Text>
                </View>
              </View>
              <View className="bg-gray-50 rounded-xl p-3">
                <Text className="text-xs text-gray-400 uppercase tracking-wide mb-1">{T.submit_urgency}</Text>
                <View className={`flex-row items-center gap-1.5 px-2 py-1 rounded-full self-start ${URGENCY_CONFIG[analysis.urgency].colors}`}>
                  <View className={`w-1.5 h-1.5 rounded-full ${URGENCY_CONFIG[analysis.urgency].dot}`} />
                  <Text className={`text-xs font-bold ${URGENCY_CONFIG[analysis.urgency].text}`}>
                    {analysis.urgency === 'LOW' ? T.urgency_low : analysis.urgency === 'MEDIUM' ? T.urgency_medium : analysis.urgency === 'HIGH' ? T.urgency_high : T.urgency_critical}
                  </Text>
                </View>
              </View>
            </View>

            <View className="bg-indigo-50 rounded-xl p-3 mb-4">
              <Text className="text-xs text-gray-500 uppercase tracking-wide mb-1">{T.submit_ai_summary}</Text>
              <Text className="text-sm text-gray-800">{analysis.summary}</Text>
            </View>
          </View>
        )}

        {/* Step 3: Location */}
        <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <View className="flex-row items-center gap-2 mb-4">
            <View className="w-6 h-6 rounded-full bg-orange-500 items-center justify-center">
              <Text className="text-white text-xs font-bold">3</Text>
            </View>
            <Text className="font-bold text-gray-900 text-lg">{T.submit_step3}</Text>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">{T.submit_city} *</Text>
            <View className="flex-row gap-2">
              {CITY_OPTIONS.filter(c => c !== 'All').map(city => (
                <Pressable
                  key={city}
                  onPress={() => setForm(f => ({ ...f, city, area: '', ward: '' }))}
                  className={`flex-1 py-2.5 rounded-xl border-2 ${form.city === city ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'}`}
                >
                  <Text className={`text-sm font-semibold text-center ${form.city === city ? 'text-orange-700' : 'text-gray-500'}`}>
                    {city}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-4">
            <View>
              <Text className="text-sm font-semibold text-gray-700 mb-1.5">{T.submit_area} *</Text>
              <View className="relative">
                <TextInput
                  value={form.area}
                  onChangeText={area => {
                    const loc = LOCATIONS.find(l => l.area === area);
                    setForm(f => ({ ...f, area, ward: loc?.ward || '' }));
                  }}
                  placeholder={`${T.submit_select_area} ${form.city}`}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>
            <View>
              <Text className="text-sm font-semibold text-gray-700 mb-1.5">{T.submit_ward}</Text>
              <TextInput
                value={form.ward}
                editable={false}
                placeholder={T.submit_ward_auto}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-600"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>
        </View>

        {error ? (
          <View className="flex-row items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl mb-4">
            <AlertTriangle size={16} color="#dc2626" />
            <Text className="text-red-600 text-sm flex-1">{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting || !analysis}
          className={`flex-row items-center justify-center gap-3 px-8 py-4 rounded-2xl ${submitting || !analysis ? 'bg-gray-200' : 'bg-orange-500'}`}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <ArrowRight size={20} color="white" />
          )}
          <Text className="text-white font-bold text-lg">
            {submitting ? T.submit_submitting : T.submit_submit_btn}
          </Text>
        </Pressable>

        {!analysis && (
          <Text className="text-center text-xs text-gray-400 mt-3">{T.submit_analyze_first}</Text>
        )}
      </View>
    </ScrollView>
  );
}
