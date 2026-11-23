import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFoundView() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center animate-fade-up">
        <div className="w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-4 font-black text-2xl">
          404
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Page Not Found</h2>
        <p className="text-sm text-gray-600 mb-6">
          The requested JanSetu platform module or grievance URL does not exist or has moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm shadow-md transition-all active:scale-95"
        >
          <Home size={16} /> Return to Home
        </Link>
      </div>
    </div>
  );
}
