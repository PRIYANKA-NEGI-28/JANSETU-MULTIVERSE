import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import {
  CheckCircle,
  Copy,
  Sparkles,
  Scale,
  Download,
  ChevronRight,
  ChevronLeft,
  Link2,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  createRtiApplication,
  getRtiPdfUrl,
  getUserComplaints,
  type RtiApplicationDto,
  type ComplaintDto,
  type CreateRtiInput,
  getHeaders,
} from '../../src/lib/api-client';
import { useOfflineSync } from '../../src/offline';

type FormStep = 1 | 2 | 3;

interface RTIFormData {
  applicantName: string;
  fatherOrSpouseName: string;
  address: string;
  contactNumber: string;
  email: string;
  authorityName: string;
  publicAuthorityAddress: string;
  subject: string;
  description: string;
  clusterId?: string;
  specificQuestions: string;
  isBplExempt: boolean;
  bplCardNo: string;
  bplYear: string;
}

const PUBLIC_AUTHORITIES = [
  'Municipal Corporation of Delhi (MCD)',
  'Delhi Development Authority (DDA)',
  'Public Works Department (PWD Delhi)',
  'Delhi Jal Board (DJB)',
  'Ghaziabad Nagar Nigam (GNN)',
  'UP Power Corporation Limited (UPPCL)',
  'Delhi Police (Licensing & Traffic)',
];

export default function RTIScreen() {
  const params = useLocalSearchParams<{ clusterId?: string; trackingCode?: string; title?: string }>();
  const { cachedComplaints } = useOfflineSync();

  const [step, setStep] = useState<FormStep>(1);
  const [complaints, setComplaints] = useState<readonly ComplaintDto[]>([]);
  const [selectedComplaintCode, setSelectedComplaintCode] = useState<string>(
    params.trackingCode || params.clusterId || ''
  );

  const [form, setForm] = useState<RTIFormData>({
    applicantName: '',
    fatherOrSpouseName: '',
    address: '',
    contactNumber: '',
    email: '',
    authorityName: PUBLIC_AUTHORITIES[0] || 'Municipal Corporation of Delhi (MCD)',
    publicAuthorityAddress: 'Civic Centre, Minto Road, New Delhi 110002',
    subject: params.title
      ? `Information regarding unresolved civic hazard: ${params.title}`
      : 'Information regarding municipal road repair and stormwater drainage maintenance',
    description: params.title
      ? `This application seeks certified copies of inspection reports, contractor tender sanctions, and timeline guarantees regarding the unresolved hazard: ${params.title}.`
      : 'Information sought regarding expenditure, maintenance logs, and officer accountability for public infrastructure.',
    clusterId: params.clusterId || undefined,
    specificQuestions:
      '1. Certified copies of the sanctioned estimate and tender contract for the site.\n2. Daily progress report and inspection measurements recorded by the Executive Engineer.\n3. Exact statutory deadline for full defect liability remediation.',
    isBplExempt: false,
    bplCardNo: '',
    bplYear: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [generatedRti, setGeneratedRti] = useState<RtiApplicationDto | null>(null);
  const [previewLanguage, setPreviewLanguage] = useState<'en' | 'hi'>('en');
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Load user's complaints for linking
  useEffect(() => {
    async function loadComplaints() {
      try {
        const list = await getUserComplaints();
        if (list.length > 0) {
          setComplaints(list);
        } else {
          setComplaints(cachedComplaints);
        }
      } catch {
        setComplaints(cachedComplaints);
      }
    }
    void loadComplaints();
  }, [cachedComplaints]);

  // Handle complaint selection
  const handleLinkComplaint = (code: string) => {
    setSelectedComplaintCode(code);
    const match = complaints.find((c) => c.trackingCode === code || c.id === code);
    if (match) {
      setForm((prev) => ({
        ...prev,
        subject: `Statutory Enquiry on Unresolved Grievance ${match.trackingCode || match.id}: ${match.category}`,
        description: `This application concerns grievance ${match.trackingCode || match.id} filed regarding "${match.summary || match.description}" at ${match.area || match.ward}. Despite repeated escalations, the issue remains unresolved.`,
        clusterId: match.clusterId || undefined,
      }));
    }
  };

  const update = <K extends keyof RTIFormData>(key: K, value: RTIFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateStep = (currentStep: FormStep): boolean => {
    if (currentStep === 1) {
      return Boolean(form.applicantName.trim() && form.address.trim() && form.contactNumber.trim());
    }
    if (currentStep === 2) {
      return Boolean(form.authorityName.trim() && form.subject.trim());
    }
    if (currentStep === 3) {
      return Boolean(form.description.trim().length >= 10);
    }
    return true;
  };

  const handleGenerate = async () => {
    setSubmitting(true);
    try {
      const questionsArray = form.specificQuestions
        .split('\n')
        .map((q) => q.trim())
        .filter((q) => q.length > 0);

      const payload: CreateRtiInput = {
        applicantName: form.applicantName.trim(),
        fatherOrSpouseName: form.fatherOrSpouseName.trim() || undefined,
        address: form.address.trim(),
        contactNumber: form.contactNumber.trim(),
        email: form.email.trim() || undefined,
        authorityName: form.authorityName.trim(),
        publicAuthorityAddress: form.publicAuthorityAddress.trim() || undefined,
        subject: form.subject.trim(),
        description: form.description.trim(),
        clusterId: form.clusterId || undefined,
        specificQuestions: questionsArray.length > 0 ? questionsArray : undefined,
        isBplExempt: form.isBplExempt,
        bplCardNo: form.isBplExempt ? form.bplCardNo.trim() || undefined : undefined,
        bplYear: form.isBplExempt ? form.bplYear.trim() || undefined : undefined,
      };

      const result = await createRtiApplication(payload);
      setGeneratedRti(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate RTI draft';
      Alert.alert('RTI Generation Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyText = async () => {
    if (!generatedRti) return;
    const textToCopy = previewLanguage === 'en' ? generatedRti.englishDraft : generatedRti.hindiDraft;
    await Clipboard.setStringAsync(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAndSharePdf = async () => {
    if (!generatedRti) return;
    setDownloadingPdf(true);

    try {
      const pdfUrl = getRtiPdfUrl(generatedRti.id);
      const filename = `RTI_Section_6_1_${generatedRti.id}.pdf`;
      const localUri = `${FileSystem.documentDirectory}${filename}`;

      const headers = await getHeaders();

      const downloadResult = await FileSystem.downloadAsync(pdfUrl, localUri, {
        headers,
      });

      if (downloadResult.status !== 200) {
        throw new Error(`PDF generation endpoint returned status ${downloadResult.status}`);
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `RTI Section 6(1) Statutory Application (${generatedRti.id})`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF Saved', `Statutory PDF successfully downloaded to: ${downloadResult.uri}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PDF download failed';
      Alert.alert('Download Error', msg);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Top Header */}
        <View className="mb-4">
          <View className="flex-row items-center gap-1.5 mb-1">
            <Scale size={16} color="#f97316" />
            <Text className="text-xs font-bold text-orange-600 uppercase tracking-widest">
              Legal Empower Engine
            </Text>
          </View>
          <Text className="text-2xl font-black text-gray-900">RTI Section 6(1) Drafter</Text>
          <Text className="text-xs text-gray-500 mt-0.5">
            Right to Information Act, 2005 · Statutory Dual-Language Builder
          </Text>
        </View>

        {/* View Generated Statutory Draft */}
        {generatedRti ? (
          <View className="gap-4">
            {/* Success Card */}
            <View className="bg-white rounded-2xl border border-green-200 p-5 shadow-sm">
              <View className="flex-row items-center gap-3 mb-3">
                <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center">
                  <CheckCircle size={22} color="#16a34a" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-green-700 uppercase tracking-wider">
                    Statutory Application Generated
                  </Text>
                  <Text className="text-base font-bold text-gray-900">
                    Application ID: {generatedRti.id}
                  </Text>
                </View>
              </View>

              <Text className="text-xs text-gray-600 leading-relaxed mb-4">
                Section 6(1) legal draft has been compiled in both English and Hindi with statutory 30-day mandate. You can review the bilingual text or download the official stamped PDF.
              </Text>

              {/* Action Buttons */}
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => void handleDownloadAndSharePdf()}
                  disabled={downloadingPdf}
                  className="flex-1 flex-row items-center justify-center gap-2 py-3 bg-orange-500 rounded-xl active:bg-orange-600 shadow-sm"
                >
                  {downloadingPdf ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Download size={16} color="white" />
                  )}
                  <Text className="text-white text-xs font-bold">
                    {downloadingPdf ? 'Downloading...' : 'Download & Share PDF'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void handleCopyText()}
                  className="px-4 py-3 bg-gray-100 rounded-xl flex-row items-center justify-center gap-1.5 active:bg-gray-200"
                >
                  <Copy size={14} color="#374151" />
                  <Text className="text-xs font-bold text-gray-700">
                    {copied ? 'Copied!' : 'Copy Text'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Bilingual Draft Preview Box */}
            <View className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <View className="flex-row items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <Text className="text-sm font-bold text-gray-900">Statutory Draft Preview</Text>

                {/* Language Switcher */}
                <View className="flex-row bg-gray-100 p-0.5 rounded-lg">
                  <Pressable
                    onPress={() => setPreviewLanguage('en')}
                    className={`px-3 py-1 rounded-md ${previewLanguage === 'en' ? 'bg-white shadow-xs' : ''}`}
                  >
                    <Text className={`text-xs font-bold ${previewLanguage === 'en' ? 'text-orange-600' : 'text-gray-500'}`}>
                      English
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setPreviewLanguage('hi')}
                    className={`px-3 py-1 rounded-md ${previewLanguage === 'hi' ? 'bg-white shadow-xs' : ''}`}
                  >
                    <Text className={`text-xs font-bold ${previewLanguage === 'hi' ? 'text-orange-600' : 'text-gray-500'}`}>
                      हिन्दी
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <Text className="text-xs font-mono text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {previewLanguage === 'en' ? generatedRti.englishDraft : generatedRti.hindiDraft}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  setGeneratedRti(null);
                  setStep(1);
                }}
                className="mt-4 py-3 bg-gray-100 rounded-xl items-center active:bg-gray-200"
              >
                <Text className="text-xs font-bold text-gray-700">Draft Another RTI Application</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* Multi-Step Builder Form */
          <View className="gap-4">
            {/* Link to Unresolved Complaint Card */}
            <View className="bg-white rounded-2xl border border-orange-200 p-4 shadow-sm">
              <View className="flex-row items-center gap-2 mb-2">
                <Link2 size={16} color="#f97316" />
                <Text className="text-xs font-bold text-orange-900 uppercase tracking-wider">
                  Link Unresolved Grievance
                </Text>
              </View>
              <Text className="text-xs text-gray-500 mb-3">
                Auto-populate RTI queries from unresolved complaints approaching or breaching SLA deadlines.
              </Text>

              {complaints.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                  {complaints.map((c) => {
                    const code = c.trackingCode || c.id;
                    const isSelected = selectedComplaintCode === code;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => handleLinkComplaint(code)}
                        className={`px-3 py-2 rounded-xl border ${
                          isSelected
                            ? 'bg-orange-50 border-orange-500'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <Text className={`text-xs font-mono font-bold ${isSelected ? 'text-orange-700' : 'text-gray-700'}`}>
                          {code}
                        </Text>
                        <Text className="text-[10px] text-gray-500 mt-0.5" numberOfLines={1}>
                          {c.category} · {c.area || c.ward}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text className="text-xs text-gray-400 italic">
                  No filed grievances found on-device. You can write a standalone Section 6(1) application below.
                </Text>
              )}
            </View>

            {/* Stepper Indicator */}
            <View className="flex-row items-center justify-between px-2">
              {[1, 2, 3].map((s) => (
                <View key={s} className="flex-row items-center flex-1">
                  <View
                    className={`w-7 h-7 rounded-full items-center justify-center ${
                      step === s
                        ? 'bg-orange-500'
                        : step > s
                        ? 'bg-green-600'
                        : 'bg-gray-200'
                    }`}
                  >
                    <Text className="text-white text-xs font-bold">{s}</Text>
                  </View>
                  <Text className="text-[11px] font-bold text-gray-700 ml-2">
                    {s === 1 ? 'Applicant' : s === 2 ? 'Authority' : 'Queries'}
                  </Text>
                  {s < 3 && <View className="flex-1 h-0.5 bg-gray-200 mx-2" />}
                </View>
              ))}
            </View>

            {/* Step 1: Applicant Information */}
            {step === 1 && (
              <View className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm gap-3">
                <Text className="text-sm font-bold text-gray-900 mb-1">Step 1: Applicant Details</Text>

                <View>
                  <Text className="text-xs font-semibold text-gray-700 mb-1">Applicant Full Name *</Text>
                  <TextInput
                    value={form.applicantName}
                    onChangeText={(v) => update('applicantName', v)}
                    placeholder="e.g. Anandita Verma"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs bg-white"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View>
                  <Text className="text-xs font-semibold text-gray-700 mb-1">Father's or Spouse's Name</Text>
                  <TextInput
                    value={form.fatherOrSpouseName}
                    onChangeText={(v) => update('fatherOrSpouseName', v)}
                    placeholder="e.g. Rajesh Verma"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs bg-white"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View>
                  <Text className="text-xs font-semibold text-gray-700 mb-1">Complete Residential Address *</Text>
                  <TextInput
                    value={form.address}
                    onChangeText={(v) => update('address', v)}
                    placeholder="House/Plot No., Street, Sector/Ward, City & PIN"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs bg-white"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-gray-700 mb-1">Contact Phone *</Text>
                    <TextInput
                      value={form.contactNumber}
                      onChangeText={(v) => update('contactNumber', v.replace(/[^0-9]/g, ''))}
                      placeholder="10-digit mobile"
                      keyboardType="phone-pad"
                      maxLength={10}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs bg-white"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-gray-700 mb-1">Email Address</Text>
                    <TextInput
                      value={form.email}
                      onChangeText={(v) => update('email', v)}
                      placeholder="citizen@domain.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs bg-white"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>

                {/* BPL Exemption Section */}
                <View className="pt-2 border-t border-gray-100">
                  <Pressable
                    onPress={() => update('isBplExempt', !form.isBplExempt)}
                    className="flex-row items-center gap-2 py-1"
                  >
                    <View
                      className={`w-4 h-4 rounded border items-center justify-center ${
                        form.isBplExempt ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
                      }`}
                    >
                      {form.isBplExempt && <CheckCircle size={12} color="white" />}
                    </View>
                    <Text className="text-xs font-semibold text-gray-800">
                      Claim Below Poverty Line (BPL) Fee Exemption (Section 7(5))
                    </Text>
                  </Pressable>

                  {form.isBplExempt && (
                    <View className="flex-row gap-3 mt-2">
                      <View className="flex-1">
                        <TextInput
                          value={form.bplCardNo}
                          onChangeText={(v) => update('bplCardNo', v)}
                          placeholder="BPL Card Number"
                          className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50"
                          placeholderTextColor="#9ca3af"
                        />
                      </View>
                      <View className="w-24">
                        <TextInput
                          value={form.bplYear}
                          onChangeText={(v) => update('bplYear', v)}
                          placeholder="Year (e.g. 2024)"
                          keyboardType="numeric"
                          maxLength={4}
                          className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50"
                          placeholderTextColor="#9ca3af"
                        />
                      </View>
                    </View>
                  )}
                </View>

                <Pressable
                  onPress={() => setStep(2)}
                  disabled={!validateStep(1)}
                  className={`mt-2 py-3 rounded-xl flex-row items-center justify-center gap-1.5 ${
                    validateStep(1) ? 'bg-orange-500 active:bg-orange-600' : 'bg-gray-200'
                  }`}
                >
                  <Text className="text-white text-xs font-bold">Next: Public Authority</Text>
                  <ChevronRight size={14} color="white" />
                </Pressable>
              </View>
            )}

            {/* Step 2: Public Authority & Subject */}
            {step === 2 && (
              <View className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm gap-3">
                <Text className="text-sm font-bold text-gray-900 mb-1">Step 2: Public Authority & Subject</Text>

                <View>
                  <Text className="text-xs font-semibold text-gray-700 mb-1">Public Authority (PIO) *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-1.5 mb-2">
                    {PUBLIC_AUTHORITIES.map((auth) => (
                      <Pressable
                        key={auth}
                        onPress={() => update('authorityName', auth)}
                        className={`px-2.5 py-1.5 rounded-lg border ${
                          form.authorityName === auth
                            ? 'bg-orange-50 border-orange-500'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <Text className={`text-[11px] font-medium ${form.authorityName === auth ? 'text-orange-700 font-bold' : 'text-gray-600'}`}>
                          {auth.split(' ')[0]}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <TextInput
                    value={form.authorityName}
                    onChangeText={(v) => update('authorityName', v)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs bg-white font-medium"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View>
                  <Text className="text-xs font-semibold text-gray-700 mb-1">Authority Office Address</Text>
                  <TextInput
                    value={form.publicAuthorityAddress}
                    onChangeText={(v) => update('publicAuthorityAddress', v)}
                    placeholder="Office address of the PIO"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs bg-white"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View>
                  <Text className="text-xs font-semibold text-gray-700 mb-1">Application Subject Line *</Text>
                  <TextInput
                    value={form.subject}
                    onChangeText={(v) => update('subject', v)}
                    placeholder="Short, formal subject description"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs bg-white"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View className="flex-row gap-2 mt-2">
                  <Pressable
                    onPress={() => setStep(1)}
                    className="px-4 py-3 bg-gray-100 rounded-xl flex-row items-center justify-center gap-1 active:bg-gray-200"
                  >
                    <ChevronLeft size={14} color="#374151" />
                    <Text className="text-xs font-bold text-gray-700">Back</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setStep(3)}
                    disabled={!validateStep(2)}
                    className={`flex-1 py-3 rounded-xl flex-row items-center justify-center gap-1.5 ${
                      validateStep(2) ? 'bg-orange-500 active:bg-orange-600' : 'bg-gray-200'
                    }`}
                  >
                    <Text className="text-white text-xs font-bold">Next: Information Sought</Text>
                    <ChevronRight size={14} color="white" />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Step 3: Information Required & Questions */}
            {step === 3 && (
              <View className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm gap-3">
                <Text className="text-sm font-bold text-gray-900 mb-1">Step 3: Information Sought & Legal Questions</Text>

                <View>
                  <Text className="text-xs font-semibold text-gray-700 mb-1">Background Context / Description *</Text>
                  <TextInput
                    value={form.description}
                    onChangeText={(v) => update('description', v)}
                    placeholder="Explain the background problem and reason for information request..."
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs bg-white min-h-[70]"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View>
                  <Text className="text-xs font-semibold text-gray-700 mb-1">
                    Specific Point-by-Point Questions (One per line)
                  </Text>
                  <TextInput
                    value={form.specificQuestions}
                    onChangeText={(v) => update('specificQuestions', v)}
                    placeholder="1. Question one...\n2. Question two...\n3. Question three..."
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs bg-white min-h-[90] font-mono"
                    placeholderTextColor="#9ca3af"
                  />
                  <Text className="text-[10px] text-gray-400 mt-1">
                    Tip: Precise numbered questions ensure legally enforceable statutory compliance under Section 7(1).
                  </Text>
                </View>

                <View className="flex-row gap-2 mt-2">
                  <Pressable
                    onPress={() => setStep(2)}
                    className="px-4 py-3 bg-gray-100 rounded-xl flex-row items-center justify-center gap-1 active:bg-gray-200"
                  >
                    <ChevronLeft size={14} color="#374151" />
                    <Text className="text-xs font-bold text-gray-700">Back</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => void handleGenerate()}
                    disabled={submitting || !validateStep(3)}
                    className={`flex-1 py-3 rounded-xl flex-row items-center justify-center gap-1.5 ${
                      submitting || !validateStep(3)
                        ? 'bg-gray-200'
                        : 'bg-orange-500 active:bg-orange-600 shadow-sm'
                    }`}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Sparkles size={16} color="white" />
                    )}
                    <Text className="text-white text-xs font-bold">
                      {submitting ? 'Generating Statutory Draft...' : 'Generate Section 6(1) Draft'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
