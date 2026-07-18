import { useState } from 'react';
import {
  FileText, ChevronRight, ChevronLeft, CheckCircle, Copy, Download,
  Printer, ArrowRight, Sparkles, AlertCircle, Info, User, Building2,
  Calendar, HelpCircle, Scale, Stamp, Landmark, Building, Factory,
  Shield, GraduationCap, Stethoscope,
} from 'lucide-react';
import type { Page } from '../types';
import { useLang } from '../lib/langContext';

interface RTIDrafterProps {
  onNavigate: (page: Page) => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

interface RTIForm {
  // Step 1 — Applicant
  applicantName: string;
  fatherName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;

  // Step 2 — Public Authority
  authorityType: string;
  authorityName: string;
  department: string;
  pioConcern: string;

  // Step 3 — Query
  naturalQuery: string;
  infoCategory: string;
  timePeriodFrom: string;
  timePeriodTo: string;
  specificDocuments: string;
  urgencyReason: string;

  // Step 4 — BPL / Fee
  isBPL: boolean;
  bplCardNumber: string;
  paymentMode: string;
}

const AUTHORITY_TYPES = [
  'rti_auth_central' as const,
  'rti_auth_state' as const,
  'rti_auth_municipal' as const,
  'rti_auth_psu' as const,
  'rti_auth_police' as const,
  'rti_auth_collectorate' as const,
  'rti_auth_revenue' as const,
  'rti_auth_urban' as const,
  'rti_auth_edu' as const,
  'rti_auth_health' as const,
];

const AUTHORITY_ICONS: Record<string, React.ReactNode> = {
  rti_auth_central: <Landmark size={20} />,
  rti_auth_state: <Building2 size={20} />,
  rti_auth_municipal: <Building size={20} />,
  rti_auth_psu: <Factory size={20} />,
  rti_auth_police: <Shield size={20} />,
  rti_auth_collectorate: <Landmark size={20} />,
  rti_auth_revenue: <FileText size={20} />,
  rti_auth_urban: <Building size={20} />,
  rti_auth_edu: <GraduationCap size={20} />,
  rti_auth_health: <Stethoscope size={20} />,
};

const INFO_CATEGORIES = [
  { value: 'documents', labelKey: 'rti_cat_documents' as const },
  { value: 'status', labelKey: 'rti_cat_status' as const },
  { value: 'inspection', labelKey: 'rti_cat_inspection' as const },
  { value: 'expenditure', labelKey: 'rti_cat_expenditure' as const },
  { value: 'appointments', labelKey: 'rti_cat_appointments' as const },
  { value: 'complaints', labelKey: 'rti_cat_complaints' as const },
  { value: 'policy', labelKey: 'rti_cat_policy' as const },
  { value: 'beneficiaries', labelKey: 'rti_cat_beneficiaries' as const },
  { value: 'tenders', labelKey: 'rti_cat_tenders' as const },
  { value: 'other', labelKey: 'rti_cat_other' as const },
];

const PAYMENT_MODES = ['Indian Postal Order (IPO)', 'DD / Banker Cheque', 'Court Fee Stamp', 'Treasury Challan', 'Online Payment'];

// Generate legally formatted RTI text from form data
function generateRTI(form: RTIForm): string {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const refNo = `RTI/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 90000) + 10000)}`;

  // Convert natural query to specific legal requests
  const queryLines = parseQueryToRequests(form.naturalQuery, form.infoCategory, form.timePeriodFrom, form.timePeriodTo, form.specificDocuments);

  return `To,
The Public Information Officer (PIO),
${form.authorityName}${form.department ? ',\n' + form.department : ''},
${form.pioConcern || form.city}.

Date: ${today}
Reference: ${refNo}

Subject: Application under Section 6(1) of the Right to Information Act, 2005

Respected Sir/Madam,

I, ${form.applicantName}, Son/Daughter/Wife of ${form.fatherName || '____________________'}, residing at ${form.address}, ${form.city} – ${form.pincode || '______'}, ${form.state}, do hereby request you to furnish the following information under the Right to Information Act, 2005.

INFORMATION SOUGHT:
${queryLines}
${form.timePeriodFrom && form.timePeriodTo ? `\nTIME PERIOD: The above information may pertain to the period from ${form.timePeriodFrom} to ${form.timePeriodTo}.` : ''}
${form.urgencyReason ? `\nURGENT MATTER: ${form.urgencyReason}` : ''}

I request you to provide the above information at the earliest. In case the requested information is not available with your department, I request you to forward this application to the relevant PIO under Section 6(3) of the RTI Act, 2005.

${form.isBPL
  ? `I am a Below Poverty Line (BPL) citizen. My BPL Card Number is ${form.bplCardNumber || '____________________'}. Hence, I am exempted from paying the application fee as per Section 7(5) of the RTI Act, 2005.`
  : `I am enclosing the prescribed application fee of Rs. 10/- by way of ${form.paymentMode}.`
}

I request that the information be provided within 30 days from the date of receipt of this application as required under Section 7(1) of the RTI Act, 2005. In case the information sought concerns the life or liberty of a person, I request the same to be provided within 48 hours.

If you are unable to provide the information, please communicate the grounds for refusal and the period within which I may appeal against the refusal, as required under Section 7(8) of the RTI Act, 2005.

Thanking you,

Yours faithfully,

_______________________
${form.applicantName}
${form.address},
${form.city} – ${form.pincode || '______'}, ${form.state}
Phone: ${form.phone || '____________________'}
${form.email ? 'Email: ' + form.email : ''}

Date: ${today}
Place: ${form.city}

Enclosures:
1. Proof of fee payment${form.isBPL ? ' (BPL Certificate copy)' : ''}
2. Identity proof (photocopy)`;
}

function parseQueryToRequests(query: string, category: string, from: string, to: string, docs: string): string {
  const lines: string[] = [];
  let idx = 1;

  const lower = query.toLowerCase();

  if (category === 'documents' || lower.includes('copy') || lower.includes('document') || lower.includes('record')) {
    lines.push(`${idx++}. Certified copies of all records, files, noting, correspondence and documents related to: "${query}".`);
  }
  if (category === 'status' || lower.includes('status') || lower.includes('application') || lower.includes('pending')) {
    lines.push(`${idx++}. Current status of the matter/application/complaint as described: "${query.slice(0, 80)}${query.length > 80 ? '...' : ''}".`);
    lines.push(`${idx++}. Names and designations of the officials responsible for processing the matter.`);
  }
  if (category === 'expenditure' || lower.includes('money') || lower.includes('amount') || lower.includes('fund') || lower.includes('budget') || lower.includes('spend')) {
    lines.push(`${idx++}. Complete details of funds allocated, disbursed and utilized in connection with: "${query.slice(0, 80)}".`);
    lines.push(`${idx++}. Audited accounts and utilization certificates, if any.`);
  }
  if (category === 'complaints' || lower.includes('complaint') || lower.includes('grievance')) {
    lines.push(`${idx++}. Copies of all complaints/grievances received regarding the subject matter.`);
    lines.push(`${idx++}. Action taken reports on complaints received during the said period.`);
  }
  if (category === 'tenders' || lower.includes('tender') || lower.includes('contract') || lower.includes('work order')) {
    lines.push(`${idx++}. Details of all tenders issued, bids received, and work orders awarded in the subject matter.`);
    lines.push(`${idx++}. Name and details of the successful bidder(s) and the award amount.`);
  }
  if (category === 'beneficiaries' || lower.includes('list') || lower.includes('beneficiar')) {
    lines.push(`${idx++}. Complete list of beneficiaries/recipients of the scheme/program as described.`);
    lines.push(`${idx++}. Criteria applied for selection of beneficiaries.`);
  }
  if (category === 'policy' || lower.includes('rule') || lower.includes('policy') || lower.includes('guideline')) {
    lines.push(`${idx++}. Copies of all relevant rules, regulations, guidelines, circulars and policy documents.`);
  }

  // Always include a general catch-all if nothing specific matched
  if (lines.length === 0) {
    lines.push(`${idx++}. All information, records, files, noting, correspondence and documents related to: "${query}".`);
    lines.push(`${idx++}. Names and designations of public servants associated with the matter.`);
    lines.push(`${idx++}. Action taken/proposed on the subject matter.`);
  }

  // Additional specific documents
  if (docs.trim()) {
    docs.split('\n').filter(d => d.trim()).forEach(d => {
      lines.push(`${idx++}. ${d.trim()}`);
    });
  }

  // Date-range request
  if (from && to) {
    lines.push(`${idx++}. Any other related document(s) for the period from ${from} to ${to}.`);
  }

  return lines.join('\n');
}

const STEP_LABELS = ['Authority Type', 'Applicant Details', 'Public Authority', 'Information Required', 'Review & Generate'];

export default function RTIDrafter({ onNavigate }: RTIDrafterProps) {
  const { T } = useLang();
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
    if (step === 1) return !!form.authorityType;
    if (step === 2) return form.applicantName.trim() && form.address.trim() && form.city.trim() && form.state.trim();
    if (step === 3) return form.authorityName.trim();
    if (step === 4) return form.naturalQuery.trim().length >= 15;
    return true;
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/drafter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('Failed to generate draft');
      const data = await res.json();
      setGeneratedText(data.draftText || generateRTI(form)); // fallback just in case
    } catch (err) {
      console.error(err);
      // Fallback to client-side generation if server fails for demo
      setGeneratedText(generateRTI(form));
    } finally {
      setGenerating(false);
    }
  }

  function handleCopy() {
    if (generatedText) {
      navigator.clipboard.writeText(generatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handlePrint() {
    if (!generatedText) return;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`<html><head><title>RTI Application</title><style>body{font-family:serif;font-size:14px;line-height:1.8;padding:40px;white-space:pre-wrap;}</style></head><body>${generatedText.replace(/</g, '&lt;')}</body></html>`);
      win.document.close();
      win.print();
    }
  }

  const inputBase = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white placeholder-gray-400';
  const labelBase = 'block text-sm font-semibold text-gray-700 mb-1.5';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50 pt-4">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Scale size={16} className="text-orange-600" />
            <span className="text-xs font-bold text-orange-600 uppercase tracking-widest">{T.rti_badge}</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">{T.rti_title}</h1>
          <p className="text-gray-500 text-lg max-w-2xl">{T.rti_subtitle}</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-2">
          {STEP_LABELS.map((label, i) => {
            const n = (i + 1) as Step;
            const done = step > n;
            const active = step === n;
            return (
              <div key={n} className="flex items-center">
                <div className={`flex items-center gap-2 shrink-0 px-3 py-2 rounded-xl transition-all ${active ? 'bg-orange-500 text-white shadow-md shadow-orange-200' : done ? 'bg-orange-100 text-orange-700' : 'bg-white border border-gray-200 text-gray-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${active ? 'bg-white/30 text-white' : done ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {done ? <CheckCircle size={14} /> : n}
                  </div>
                  <span className={`text-xs font-bold whitespace-nowrap ${active ? 'text-white' : done ? 'text-orange-700' : 'text-gray-400'}`}>{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && <div className={`w-6 h-0.5 shrink-0 ${done ? 'bg-orange-300' : 'bg-gray-200'}`}></div>}
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Step 1 — Authority Type */}
          {step === 1 && (
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center"><Building2 size={18} className="text-orange-600" /></div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Select Authority Type</h2>
                  <p className="text-sm text-gray-400">Choose the type of government body you want to file RTI against</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AUTHORITY_TYPES.map(a => (
                  <button
                    key={a}
                    onClick={() => update('authorityType', a)}
                    className={`flex items-center gap-3 px-4 py-4 rounded-xl border text-left transition-all ${
                      form.authorityType === a
                        ? 'border-orange-400 bg-orange-50 text-orange-700 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      form.authorityType === a ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {AUTHORITY_ICONS[a]}
                    </div>
                    <span className="text-sm font-semibold leading-tight">{T[a as keyof typeof T] as string}</span>
                    {form.authorityType === a && <CheckCircle size={16} className="ml-auto text-orange-500 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Applicant */}
          {step === 2 && (
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center"><User size={18} className="text-orange-600" /></div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{T.rti_your_details}</h2>
                  <p className="text-sm text-gray-400">{T.rti_your_details_desc}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className={labelBase}>{T.rti_full_name} *</label>
                  <input className={inputBase} value={form.applicantName} onChange={e => update('applicantName', e.target.value)} placeholder={T.rti_name_placeholder} />
                </div>
                <div>
                  <label className={labelBase}>{T.rti_father_name}</label>
                  <input className={inputBase} value={form.fatherName} onChange={e => update('fatherName', e.target.value)} placeholder={T.rti_father_placeholder} />
                </div>
                <div>
                  <label className={labelBase}>{T.rti_mobile}</label>
                  <input className={inputBase} type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder={T.rti_mobile_placeholder} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelBase}>{T.rti_address} *</label>
                  <textarea className={`${inputBase} resize-none`} rows={2} value={form.address} onChange={e => update('address', e.target.value)} placeholder={T.rti_address_placeholder} />
                </div>
                <div>
                  <label className={labelBase}>{T.rti_city} *</label>
                  <input className={inputBase} value={form.city} onChange={e => update('city', e.target.value)} placeholder={T.rti_city_placeholder} />
                </div>
                <div>
                  <label className={labelBase}>{T.rti_state} *</label>
                  <input className={inputBase} value={form.state} onChange={e => update('state', e.target.value)} placeholder={T.rti_city_placeholder} />
                </div>
                <div>
                  <label className={labelBase}>{T.rti_pincode}</label>
                  <input className={inputBase} value={form.pincode} onChange={e => update('pincode', e.target.value)} placeholder="110001" />
                </div>
                <div>
                  <label className={labelBase}>{T.rti_email_optional}</label>
                  <input className={inputBase} type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@email.com" />
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Authority Details */}
          {step === 3 && (
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><Building2 size={18} className="text-blue-600" /></div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{T.rti_authority_title}</h2>
                  <p className="text-sm text-gray-400">{T.rti_authority_desc}</p>
                </div>
              </div>

              {/* Selected authority type badge */}
              <div className="mb-5 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                <Info size={14} className="text-blue-500" />
                <span className="text-sm font-semibold text-blue-700">{T[form.authorityType as keyof typeof T] || '—'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className={labelBase}>{T.rti_authority_name} *</label>
                  <input className={inputBase} value={form.authorityName} onChange={e => update('authorityName', e.target.value)} placeholder={T.rti_authority_placeholder} />
                </div>
                <div>
                  <label className={labelBase}>{T.rti_dept_branch}</label>
                  <input className={inputBase} value={form.department} onChange={e => update('department', e.target.value)} placeholder={T.rti_dept_placeholder} />
                </div>
                <div>
                  <label className={labelBase}>{T.rti_pio_city}</label>
                  <input className={inputBase} value={form.pioConcern} onChange={e => update('pioConcern', e.target.value)} placeholder={T.rti_pio_placeholder} />
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
                <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">{T.rti_info_note}</p>
              </div>
            </div>
          )}

          {/* Step 4 — Query */}
          {step === 4 && (
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><HelpCircle size={18} className="text-green-600" /></div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{T.rti_query_title}</h2>
                  <p className="text-sm text-gray-400">{T.rti_query_desc}</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className={labelBase}>{T.rti_query_label} *</label>
                  <textarea
                    className={`${inputBase} resize-none`}
                    rows={4}
                    value={form.naturalQuery}
                    onChange={e => update('naturalQuery', e.target.value)}
                    placeholder={T.rti_query_placeholder}
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-gray-400 flex items-center gap-1"><Sparkles size={11} />{T.rti_ai_convert}</p>
                    <span className={`text-xs font-medium ${form.naturalQuery.length < 15 ? 'text-red-400' : 'text-green-600'}`}>{form.naturalQuery.length} {T.rti_chars}</span>
                  </div>
                </div>

                <div>
                  <label className={labelBase}>{T.rti_category}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {INFO_CATEGORIES.map(c => (
                      <button
                        key={c.value}
                        onClick={() => update('infoCategory', c.value)}
                        className={`text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          form.infoCategory === c.value
                            ? 'border-orange-400 bg-orange-50 text-orange-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >{T[c.labelKey]}</button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelBase}><Calendar size={13} className="inline mr-1" />{T.rti_time_from}</label>
                    <input type="date" className={inputBase} value={form.timePeriodFrom} onChange={e => update('timePeriodFrom', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelBase}><Calendar size={13} className="inline mr-1" />{T.rti_time_to}</label>
                    <input type="date" className={inputBase} value={form.timePeriodTo} onChange={e => update('timePeriodTo', e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className={labelBase}>{T.rti_specific_docs}</label>
                  <textarea
                    className={`${inputBase} resize-none`}
                    rows={2}
                    value={form.specificDocuments}
                    onChange={e => update('specificDocuments', e.target.value)}
                    placeholder={T.rti_specific_docs_placeholder}
                  />
                </div>

                <div>
                  <label className={labelBase}>{T.rti_urgency_reason}</label>
                  <input
                    className={inputBase}
                    value={form.urgencyReason}
                    onChange={e => update('urgencyReason', e.target.value)}
                    placeholder={T.rti_urgency_placeholder}
                  />
                  <p className="text-xs text-gray-400 mt-1">{T.rti_urgency_hint}</p>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <label className={`${labelBase} flex items-center gap-2 cursor-pointer`}>
                    <input type="checkbox" checked={form.isBPL} onChange={e => update('isBPL', e.target.checked)} className="accent-orange-500 w-4 h-4" />
                    {T.rti_bpl_label}
                  </label>
                  {form.isBPL && (
                    <input className={`${inputBase} mt-3`} value={form.bplCardNumber} onChange={e => update('bplCardNumber', e.target.value)} placeholder={T.rti_bpl_number} />
                  )}
                  {!form.isBPL && (
                    <div className="mt-3">
                      <label className={labelBase}>{T.rti_fee_mode}</label>
                      <select className={`${inputBase} appearance-none`} value={form.paymentMode} onChange={e => update('paymentMode', e.target.value)}>
                        {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 5 — Review & Generate */}
          {step === 5 && (
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center"><Stamp size={18} className="text-orange-600" /></div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{T.rti_review_title}</h2>
                  <p className="text-sm text-gray-400">{T.rti_review_desc}</p>
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                  { icon: <User size={16} />, label: T.rti_applicant, value: form.applicantName || '—', sub: `${form.city}, ${form.state}` },
                  { icon: <Building2 size={16} />, label: T.rti_authority, value: form.authorityName || '—', sub: form.authorityType },
                  { icon: <HelpCircle size={16} />, label: T.rti_query, value: form.naturalQuery.slice(0, 50) + (form.naturalQuery.length > 50 ? '...' : '') || '—', sub: INFO_CATEGORIES.find(c => c.value === form.infoCategory) ? T[INFO_CATEGORIES.find(c => c.value === form.infoCategory)!.labelKey] : undefined },
                ].map(({ icon, label, value, sub }) => (
                  <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-500 mb-2 text-xs font-bold uppercase tracking-wide">{icon}{label}</div>
                    <p className="text-sm font-bold text-gray-900 leading-tight">{value}</p>
                    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
                  </div>
                ))}
              </div>

              {!generatedText ? (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold text-base rounded-xl transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-3"
                >
                  {generating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      {T.rti_generating}
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      {T.rti_generate_btn}
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-4">
                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleCopy}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${copied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                    >
                      {copied ? <CheckCircle size={15} /> : <Copy size={15} />}
                      {copied ? T.rti_copied : T.rti_copy}
                    </button>
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all"
                    >
                      <Printer size={15} /> {T.rti_print}
                    </button>
                    <button
                      onClick={() => setGeneratedText(null)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border border-orange-100 text-orange-600 text-sm font-semibold rounded-xl hover:bg-orange-100 transition-all"
                    >
                      <Sparkles size={15} /> {T.rti_regenerate}
                    </button>
                  </div>

                  {/* Generated document */}
                  <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                      <FileText size={16} className="text-orange-600" />
                      <span className="text-sm font-bold text-gray-900">{T.rti_ready}</span>
                      <span className="ml-auto text-xs text-gray-400 font-medium">{T.rti_act_ref}</span>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">{generatedText}</pre>
                  </div>

                  {/* Filing instructions */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle size={15} className="text-blue-600" />
                      <span className="text-sm font-bold text-blue-900">{T.rti_how_to_file}</span>
                    </div>
                    {[
                      T.rti_filing_1,
                      T.rti_filing_2,
                      T.rti_filing_3,
                      T.rti_filing_4,
                      T.rti_filing_5,
                      T.rti_filing_6,
                      T.rti_filing_7,
                    ].map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-blue-700">
                        <span className="font-bold shrink-0">{i + 1}.</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="px-6 sm:px-8 py-5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={() => setStep(s => Math.max(1, s - 1) as Step)}
              disabled={step === 1}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={16} /> {T.rti_back}
            </button>

            <div className="flex gap-1.5">
              {([1, 2, 3, 4, 5] as Step[]).map(s => (
                <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? 'w-6 bg-orange-500' : s < step ? 'w-3 bg-orange-200' : 'w-3 bg-gray-200'}`}></div>
              ))}
            </div>

            {step < 5 ? (
              <button
                onClick={() => setStep(s => Math.min(5, s + 1) as Step)}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all"
              >
                {T.rti_next} <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => onNavigate('submit')}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-all"
              >
                {T.rti_file_complaint} <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
