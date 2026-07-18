import { ScrollView, View, Text, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  FileText, ChevronRight, ChevronLeft, CheckCircle, Copy,
  ArrowRight, Sparkles, AlertCircle, User, Building2,
  Calendar, HelpCircle, Scale, Stamp,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useLang } from '../../lib/langContext';

type Step = 1 | 2 | 3 | 4;

interface RTIForm {
  applicantName: string;
  fatherName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  authorityType: string;
  authorityName: string;
  department: string;
  pioConcern: string;
  naturalQuery: string;
  infoCategory: string;
  timePeriodFrom: string;
  timePeriodTo: string;
  specificDocuments: string;
  urgencyReason: string;
  isBPL: boolean;
  bplCardNumber: string;
  paymentMode: string;
}

const AUTHORITY_TYPES = [
  'rti_auth_central' as const,
  'rti_auth_state' as const,
  'rti_auth_municipal' as const,
  'rti_auth_collectorate' as const,
  'rti_auth_psu' as const,
  'rti_auth_police' as const,
  'rti_auth_revenue' as const,
  'rti_auth_urban' as const,
  'rti_auth_edu' as const,
  'rti_auth_health' as const,
];

const INFO_CATEGORIES = [
  { value: 'documents', labelKey: 'rti_cat_documents' as const },
  { value: 'status', labelKey: 'rti_cat_status' as const },
  { value: 'expenditure', labelKey: 'rti_cat_expenditure' as const },
  { value: 'appointments', labelKey: 'rti_cat_appointments' as const },
  { value: 'complaints', labelKey: 'rti_cat_complaints' as const },
  { value: 'policy', labelKey: 'rti_cat_policy' as const },
  { value: 'tenders', labelKey: 'rti_cat_tenders' as const },
];

const PAYMENT_MODES = ['Indian Postal Order (IPO)', 'DD / Banker Cheque', 'Court Fee Stamp', 'Treasury Challan', 'Online Payment'];

const STEP_LABELS = ['Applicant Details', 'Public Authority', 'Information Required', 'Review & Generate'];

function generateRTI(form: RTIForm): string {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const refNo = `RTI/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 90000) + 10000)}`;

  const queryLines: string[] = [];
  let idx = 1;
  queryLines.push(`${idx++}. All information, records, files, noting, correspondence and documents related to: "${form.naturalQuery}".`);
  queryLines.push(`${idx++}. Names and designations of public servants associated with the matter.`);
  queryLines.push(`${idx++}. Action taken/proposed on the subject matter.`);

  return `To,
The Public Information Officer (PIO),
${form.authorityName}${form.department ? ',' + form.department : ''},
${form.pioConcern || form.city}.

Date: ${today}
Reference: ${refNo}

Subject: Application under Section 6(1) of the Right to Information Act, 2005

Respected Sir/Madam,

I, ${form.applicantName}, Son/Daughter/Wife of ${form.fatherName || '____________________'}, residing at ${form.address}, ${form.city} – ${form.pincode || '______'}, ${form.state}, do hereby request you to furnish the following information under the Right to Information Act, 2005.

INFORMATION SOUGHT:
${queryLines.join('\n')}

${form.isBPL
  ? `I am a Below Poverty Line (BPL) citizen. My BPL Card Number is ${form.bplCardNumber || '____________________'}. Hence, I am exempted from paying the application fee as per Section 7(5) of the RTI Act, 2005.`
  : `I am enclosing the prescribed application fee of Rs. 10/- by way of ${form.paymentMode}.`}

I request that the information be provided within 30 days from the date of receipt of this application as required under Section 7(1) of the RTI Act, 2005.

Thanking you,

Yours faithfully,

_______________________
${form.applicantName}
${form.address},
${form.city} – ${form.pincode || '______'}, ${form.state}
Phone: ${form.phone || '____________________'}

Date: ${today}
Place: ${form.city}`;
}

export default function RTIScreen() {
  const { T } = useLang();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<RTIForm>({
    applicantName: '', fatherName: '', address: '', city: '', state: '', pincode: '', phone: '', email: '',
    authorityType: '', authorityName: '', department: '', pioConcern: '',
    naturalQuery: '', infoCategory: 'documents', timePeriodFrom: '', timePeriodTo: '', specificDocuments: '', urgencyReason: '',
    isBPL: false, bplCardNumber: '', paymentMode: 'Indian Postal Order (IPO)',
  });
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  function update(key: keyof RTIForm, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function canProceed() {
    if (step === 1) return form.applicantName.trim() && form.address.trim() && form.city.trim() && form.state.trim();
    if (step === 2) return form.authorityName.trim() && form.authorityType;
    if (step === 3) return form.naturalQuery.trim().length >= 15;
    return true;
  }

  function handleGenerate() {
    setGenerating(true);
    setTimeout(() => {
      setGeneratedText(generateRTI(form));
      setGenerating(false);
    }, 900);
  }

  async function handleCopy() {
    if (generatedText) {
      await Clipboard.setStringAsync(generatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <ScrollView className="flex-1 bg-gradient-to-b from-slate-50 to-orange-50">
      <View className="p-4 pt-8">
        <View className="flex-row items-center gap-2 mb-1">
          <Scale size={16} color="#ea580c" />
          <Text className="text-xs font-bold text-orange-600 uppercase tracking-widest">{T.rti_badge}</Text>
        </View>
        <Text className="text-3xl font-bold text-gray-900 mb-1">{T.rti_title}</Text>
        <Text className="text-gray-500 mb-6">{T.rti_subtitle}</Text>

        {/* Progress Steps */}
        <View className="flex-row mb-6">
          {STEP_LABELS.map((label, i) => {
            const n = (i + 1) as Step;
            const done = step > n;
            const active = step === n;
            return (
              <View key={n} className="flex-row items-center flex-1">
                <View className={`flex-row items-center gap-1 px-2 py-1.5 rounded-xl ${active ? 'bg-orange-500' : done ? 'bg-orange-100' : 'bg-white border border-gray-200'}`}>
                  <View className={`w-5 h-5 rounded-full items-center justify-center ${active ? 'bg-white/30' : done ? 'bg-orange-500' : 'bg-gray-100'}`}>
                    {done ? <CheckCircle size={12} color="white" /> : <Text className={`text-xs font-black ${active ? 'text-white' : 'text-gray-400'}`}>{n}</Text>}
                  </View>
                  <Text className={`text-xs font-semibold ${active ? 'text-white' : done ? 'text-orange-700' : 'text-gray-400'}`}>{label.split(' ')[0]}</Text>
                </View>
                {i < STEP_LABELS.length - 1 && <View className={`flex-1 h-0.5 ${done ? 'bg-orange-300' : 'bg-gray-200'}`} />}
              </View>
            );
          })}
        </View>

        <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          {/* Step 1 */}
          {step === 1 && (
            <View>
              <View className="flex-row items-center gap-2 mb-4">
                <View className="w-8 h-8 rounded-xl bg-orange-100 items-center justify-center">
                  <User size={16} color="#ea580c" />
                </View>
                <Text className="font-bold text-gray-900 text-lg">{T.rti_your_details}</Text>
              </View>
              <View className="gap-4">
                <View>
                  <Text className="text-sm font-semibold text-gray-700 mb-1">{T.rti_full_name} *</Text>
                  <TextInput
                    value={form.applicantName}
                    onChangeText={v => update('applicantName', v)}
                    placeholder={T.rti_name_placeholder}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
                <View>
                  <Text className="text-sm font-semibold text-gray-700 mb-1">{T.rti_father_name}</Text>
                  <TextInput
                    value={form.fatherName}
                    onChangeText={v => update('fatherName', v)}
                    placeholder={T.rti_father_placeholder}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
                <View>
                  <Text className="text-sm font-semibold text-gray-700 mb-1">{T.rti_address} *</Text>
                  <TextInput
                    value={form.address}
                    onChangeText={v => update('address', v)}
                    placeholder={T.rti_address_placeholder}
                    multiline
                    numberOfLines={2}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                    placeholderTextColor="#9ca3af"
                    style={{ textAlignVertical: 'top' }}
                  />
                </View>
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-700 mb-1">{T.rti_city} *</Text>
                    <TextInput
                      value={form.city}
                      onChangeText={v => update('city', v)}
                      placeholder={T.rti_city_placeholder}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-700 mb-1">{T.rti_state} *</Text>
                    <TextInput
                      value={form.state}
                      onChangeText={v => update('state', v)}
                      placeholder="e.g. Delhi"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-700 mb-1">{T.rti_pincode}</Text>
                    <TextInput
                      value={form.pincode}
                      onChangeText={v => update('pincode', v)}
                      placeholder="110001"
                      keyboardType="numeric"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-700 mb-1">{T.rti_mobile}</Text>
                    <TextInput
                      value={form.phone}
                      onChangeText={v => update('phone', v)}
                      placeholder={T.rti_mobile_placeholder}
                      keyboardType="phone-pad"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <View>
              <View className="flex-row items-center gap-2 mb-4">
                <View className="w-8 h-8 rounded-xl bg-blue-100 items-center justify-center">
                  <Building2 size={16} color="#2563eb" />
                </View>
                <Text className="font-bold text-gray-900 text-lg">{T.rti_authority_title}</Text>
              </View>
              <View className="gap-4">
                <View>
                  <Text className="text-sm font-semibold text-gray-700 mb-1">{T.rti_authority_type} *</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {AUTHORITY_TYPES.slice(0, 5).map(a => (
                      <Pressable
                        key={a}
                        onPress={() => update('authorityType', a)}
                        className={`px-3 py-2 rounded-lg ${form.authorityType === a ? 'bg-blue-500' : 'bg-gray-100'}`}
                      >
                        <Text className={`text-xs font-semibold ${form.authorityType === a ? 'text-white' : 'text-gray-600'}`}>
                          {T[a].split(' ')[0]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View>
                  <Text className="text-sm font-semibold text-gray-700 mb-1">{T.rti_authority_name} *</Text>
                  <TextInput
                    value={form.authorityName}
                    onChangeText={v => update('authorityName', v)}
                    placeholder={T.rti_authority_placeholder}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
                <View>
                  <Text className="text-sm font-semibold text-gray-700 mb-1">{T.rti_dept_branch}</Text>
                  <TextInput
                    value={form.department}
                    onChangeText={v => update('department', v)}
                    placeholder={T.rti_dept_placeholder}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <View>
              <View className="flex-row items-center gap-2 mb-4">
                <View className="w-8 h-8 rounded-xl bg-green-100 items-center justify-center">
                  <HelpCircle size={16} color="#16a34a" />
                </View>
                <Text className="font-bold text-gray-900 text-lg">{T.rti_query_title}</Text>
              </View>
              <View className="gap-4">
                <View>
                  <Text className="text-sm font-semibold text-gray-700 mb-1">{T.rti_query_label} *</Text>
                  <TextInput
                    value={form.naturalQuery}
                    onChangeText={v => update('naturalQuery', v)}
                    placeholder={T.rti_query_placeholder}
                    multiline
                    numberOfLines={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                    placeholderTextColor="#9ca3af"
                    style={{ textAlignVertical: 'top' }}
                  />
                  <Text className="text-xs text-gray-400 mt-1">{form.naturalQuery.length} {T.rti_chars} (min 15)</Text>
                </View>
                <View>
                  <Text className="text-sm font-semibold text-gray-700 mb-2">{T.rti_category}</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {INFO_CATEGORIES.slice(0, 4).map(c => (
                      <Pressable
                        key={c.value}
                        onPress={() => update('infoCategory', c.value)}
                        className={`px-3 py-2 rounded-lg border ${form.infoCategory === c.value ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white'}`}
                      >
                        <Text className={`text-xs font-medium ${form.infoCategory === c.value ? 'text-orange-700' : 'text-gray-600'}`}>
                          {T[c.labelKey].split(' ')[0]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <Pressable
                    onPress={() => update('isBPL', !form.isBPL)}
                    className="flex-row items-center gap-2"
                  >
                    <View className={`w-5 h-5 rounded border-2 items-center justify-center ${form.isBPL ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'}`}>
                      {form.isBPL && <CheckCircle size={12} color="white" />}
                    </View>
                    <Text className="text-sm font-medium text-gray-700">{T.rti_bpl_label}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <View>
              <View className="flex-row items-center gap-2 mb-4">
                <View className="w-8 h-8 rounded-xl bg-orange-100 items-center justify-center">
                  <Stamp size={16} color="#ea580c" />
                </View>
                <Text className="font-bold text-gray-900 text-lg">{T.rti_review_title}</Text>
              </View>

              {/* Summary */}
              <View className="flex-row gap-3 mb-4">
                {[
                  { icon: <User size={14} />, label: T.rti_applicant, value: form.applicantName || '—' },
                  { icon: <Building2 size={14} />, label: T.rti_authority, value: form.authorityName || '—' },
                ].map(({ icon, label, value }) => (
                  <View key={label} className="flex-1 bg-gray-50 rounded-xl p-3">
                    <View className="flex-row items-center gap-1 text-gray-400 mb-1">{icon}</View>
                    <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>{value}</Text>
                    <Text className="text-xs text-gray-400">{label}</Text>
                  </View>
                ))}
              </View>

              {!generatedText ? (
                <Pressable
                  onPress={handleGenerate}
                  disabled={generating}
                  className={`flex-row items-center justify-center gap-2 py-4 rounded-xl ${generating ? 'bg-gray-300' : 'bg-orange-500'}`}
                >
                  {generating ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Sparkles size={18} color="white" />
                  )}
                  <Text className="text-white font-bold">{generating ? T.rti_generating : T.rti_generate_btn}</Text>
                </Pressable>
              ) : (
                <View className="gap-4">
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={handleCopy}
                      className={`flex-1 flex-row items-center justify-center gap-2 px-4 py-2.5 rounded-xl border ${copied ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}
                    >
                      {copied ? <CheckCircle size={14} color="#16a34a" /> : <Copy size={14} color="#6b7280" />}
                      <Text className={`text-sm font-semibold ${copied ? 'text-green-700' : 'text-gray-700'}`}>
                        {copied ? T.rti_copied : T.rti_copy}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setGeneratedText(null)}
                      className="flex-row items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-100"
                    >
                      <Sparkles size={14} color="#ea580c" />
                      <Text className="text-sm font-semibold text-orange-600">{T.rti_regenerate}</Text>
                    </Pressable>
                  </View>
                  <View className="bg-gray-50 rounded-xl p-4 max-h-64">
                    <Text className="text-xs font-bold text-orange-600 mb-2">{T.rti_ready}</Text>
                    <Text className="text-xs text-gray-700 font-mono leading-relaxed" selectable>{generatedText}</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Navigation */}
        <View className="flex-row justify-between items-center">
          <Pressable
            onPress={() => setStep(s => Math.max(1, s - 1) as Step)}
            disabled={step === 1}
            className={`flex-row items-center gap-2 px-4 py-2.5 rounded-xl border ${step === 1 ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white'}`}
          >
            <ChevronLeft size={16} color={step === 1 ? '#d1d5db' : '#6b7280'} />
            <Text className={`text-sm font-semibold ${step === 1 ? 'text-gray-300' : 'text-gray-600'}`}>{T.rti_back}</Text>
          </Pressable>

          <View className="flex-row gap-1.5">
            {[1, 2, 3, 4].map(s => (
              <View key={s} className={`h-1.5 rounded-full ${s === step ? 'w-6 bg-orange-500' : s < step ? 'w-3 bg-orange-200' : 'w-3 bg-gray-200'}`} />
            ))}
          </View>

          {step < 4 ? (
            <Pressable
              onPress={() => setStep(s => Math.min(4, s + 1) as Step)}
              disabled={!canProceed()}
              className={`flex-row items-center gap-2 px-5 py-2.5 rounded-xl ${!canProceed() ? 'bg-gray-200' : 'bg-orange-500'}`}
            >
              <Text className={`text-sm font-semibold ${!canProceed() ? 'text-gray-400' : 'text-white'}`}>{T.rti_next}</Text>
              <ChevronRight size={16} color={!canProceed() ? '#9ca3af' : 'white'} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/(tabs)/submit')}
              className="flex-row items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900"
            >
              <Text className="text-white text-sm font-semibold">{T.rti_file_complaint}</Text>
              <ArrowRight size={15} color="white" />
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
