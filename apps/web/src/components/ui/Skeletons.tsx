export function ComplaintCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs animate-pulse space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-4 bg-gray-200 rounded-md w-28" />
        <div className="h-5 bg-gray-100 rounded-full w-20" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded-md w-full" />
        <div className="h-4 bg-gray-100 rounded-md w-4/5" />
      </div>
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
        <div className="h-3 bg-gray-200 rounded-md w-16" />
        <div className="h-3 bg-gray-200 rounded-md w-16" />
        <div className="h-3 bg-gray-200 rounded-md w-16" />
      </div>
    </div>
  );
}

export function TimelineSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
          <div className="flex-1 bg-gray-50 rounded-xl p-3 space-y-2">
            <div className="h-3 bg-gray-200 rounded-md w-1/3" />
            <div className="h-3 bg-gray-100 rounded-md w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 space-y-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded-md w-1/3" />
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded-md w-24" />
        <div className="h-24 bg-gray-100 rounded-xl w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-10 bg-gray-100 rounded-xl w-full" />
        <div className="h-10 bg-gray-100 rounded-xl w-full" />
      </div>
      <div className="h-12 bg-gray-200 rounded-xl w-full" />
    </div>
  );
}
