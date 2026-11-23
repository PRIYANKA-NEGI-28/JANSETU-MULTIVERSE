import { useState } from 'react';
import { Sparkles, Copy, Loader } from 'lucide-react';
import { api, type AiClassifyResponseDto } from '../lib/api.js';
import { useLang } from '../contexts/LangContext.js';

export default function GrievanceOfficerView() {
  const { lang } = useLang();
  const [complaintText, setComplaintText] = useState(
    'Main Indirapuram gyan khand mein rehta hu. Yaha par street light pichle 4 dino se band padi hai aur raat ko bahut andhera rehta hai jisse chori aur accidents ka darr rehta hai. Kripya jaldi thik karwayein.'
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AiClassifyResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await api.ai.classify({
        text: complaintText,
        lang: lang === 'hi' ? 'hi' : 'auto',
      });
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed. Please try again.';
      setError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
          Grievance AI Drafting Assistant
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Transform conversational citizen input (Hindi, English, Hinglish) into structured legal complaints
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Text Form */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6 sm:p-8 space-y-4">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Citizen Narrative (नागरिक विवरण)
              </label>
              <textarea
                rows={7}
                value={complaintText}
                onChange={(e) => setComplaintText(e.target.value)}
                placeholder="Type or paste grievance here in English, Hindi, or conversational mix..."
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isAnalyzing}
              className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-purple-900/20 transition-all"
            >
              {isAnalyzing ? <Loader size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Analyze & Classify via AI
            </button>
          </form>
        </div>

        {/* Structured Output Card */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">AI Legal Triage Output</h3>
            {result ? (
              <div className="space-y-4 text-xs animate-fade-up">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                    <span className="text-gray-500 font-semibold block">Target Department</span>
                    <span className="font-bold text-purple-900 text-sm">{result.classification.departmentCode}</span>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                    <span className="text-gray-500 font-semibold block">Urgency Level</span>
                    <span className="font-bold text-orange-900 text-sm">{result.classification.urgency}</span>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                  <div>
                    <span className="text-gray-500 font-bold block mb-1">Formal English Summary</span>
                    <p className="text-gray-900 font-medium">{result.classification.summaryEn}</p>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-gray-500 font-bold block mb-1">Formal Hindi Summary (हिन्दी सारांश)</span>
                    <p className="text-gray-900 font-medium">{result.classification.summaryHi}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>Engine: {result.provider}</span>
                  <span>Latency: {result.latencyMs}ms</span>
                </div>
              </div>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-200 rounded-2xl">
                <Sparkles size={36} className="text-gray-300 mb-2" />
                <p className="text-xs text-gray-400">Enter text on the left to extract legal category and bilingual summaries</p>
              </div>
            )}
          </div>

          {result && (
            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  `${result.classification.summaryEn}\n\n${result.classification.summaryHi}`
                )
              }
              className="mt-4 py-2.5 bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <Copy size={14} /> Copy Structured Draft
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
