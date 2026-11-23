export default function PageLoader() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 animate-fade-up">
      <div className="relative mb-4">
        {/* Glowing concentric rings */}
        <div className="w-14 h-14 rounded-full border-4 border-orange-100 border-t-orange-500 animate-spin shadow-lg shadow-orange-500/20" />
        <div className="absolute inset-2 rounded-full border-2 border-emerald-100 border-b-emerald-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1s' }} />
      </div>
      <div className="text-center">
        <h4 className="text-xs font-bold uppercase tracking-wider text-orange-600 mb-1">JanSetu Multiverse</h4>
        <p className="text-sm text-gray-500">Loading module securely...</p>
      </div>
    </div>
  );
}
