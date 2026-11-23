import { useState } from 'react';
import { Scale, Copy, Loader } from 'lucide-react';
import { api, type RtiDraftDto } from '../lib/api.js';
import { useLang } from '../contexts/LangContext.js';

export default function RtiDrafterView() {
  const { T, lang } = useLang();
  const [subject, setSubject] = useState('Enquiry on delayed road restoration and drain repairs');
  const [authorityName, setAuthorityName] = useState('Public Information Officer, Nagar Nigam');
  const [questions, setQuestions] = useState(
    '1. What is the approved budget and sanctioned contractor for road work?\n2. What is the expected completion date and daily penalty clauses?\n3. Please provide copies of inspection reports and completion certificates.'
  );
  const [isBplExempt, setIsBplExempt] = useState(false);
  const [bplCardNumber, setBplCardNumber] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [draft, setDraft] = useState<RtiDraftDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDrafting(true);
    setError(null);

    const questionsList = questions
      .split('\n')
      .map((q) => q.trim())
      .filter((q) => q.length > 0);

    try {
      const res = await api.ai.draftRti({
        subject,
        authorityName,
        language: lang === 'hi' ? 'hi' : 'en',
        specificQuestions: questionsList,
        isBplExempt,
        bplCardNumber: isBplExempt ? bplCardNumber : undefined,
      });
      setDraft(res.draft);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to draft RTI application.';
      setError(msg);
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
          {T['nav_rti'] || 'Statutory Section 6(1) RTI Drafter'}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Generate legally compliant Right to Information applications under RTI Act 2005 with statutory query formulation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Input */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6 sm:p-8 space-y-4">
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Subject Matter (विषय)
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Public Information Authority (प्राधिकारी)
              </label>
              <input
                type="text"
                value={authorityName}
                onChange={(e) => setAuthorityName(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Specific Information Sought (विशिष्ट प्रश्न - एक प्रति पंक्ति)
              </label>
              <textarea
                rows={5}
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-sans"
                required
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="bpl"
                checked={isBplExempt}
                onChange={(e) => setIsBplExempt(e.target.checked)}
                className="w-4 h-4 text-orange-500 rounded border-gray-300"
              />
              <label htmlFor="bpl" className="text-xs font-semibold text-gray-700">
                Below Poverty Line (BPL) Fee Waiver
              </label>
            </div>

            {isBplExempt && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  BPL Ration Card Number
                </label>
                <input
                  type="text"
                  value={bplCardNumber}
                  onChange={(e) => setBplCardNumber(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  required
                />
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isDrafting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-900/20 transition-all"
            >
              {isDrafting ? <Loader size={16} className="animate-spin" /> : <Scale size={16} />}
              Generate Section 6(1) Draft
            </button>
          </form>
        </div>

        {/* Output Draft Card */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Statutory Legal Draft Preview</h3>
            {draft ? (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-xs font-mono whitespace-pre-wrap max-h-[350px] overflow-y-auto">
                  {lang === 'hi' ? draft.hindiDraft : draft.englishDraft}
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-200 rounded-2xl">
                <Scale size={36} className="text-gray-300 mb-2" />
                <p className="text-xs text-gray-400">Fill in questions and click generate to view legal statutory draft</p>
              </div>
            )}
          </div>

          {draft && (
            <div className="pt-4 flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(lang === 'hi' ? draft.hindiDraft : draft.englishDraft)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Copy size={14} /> Copy Draft
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
