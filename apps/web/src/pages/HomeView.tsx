import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  Shield,
  MapPin,
  Scale,
  FileText,
  Cpu,
  ArrowRight,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useLang } from '../contexts/LangContext.js';
import { api } from '../lib/api.js';
import ScrollReveal from '../components/ScrollReveal.js';

export default function HomeView() {
  const { T } = useLang();

  const [stats, setStats] = useState({
    total: 248,
    resolved: 184,
    pending: 52,
    escalated: 12,
  });

  useEffect(() => {
    let mounted = true;
    async function loadStats() {
      try {
        const analytics = await api.admin.getAnalytics();
        if (mounted && analytics?.complaints) {
          setStats({
            total: analytics.complaints.total || 0,
            resolved: analytics.complaints.resolved || 0,
            pending: analytics.complaints.pending || 0,
            escalated: analytics.complaints.escalated || 0,
          });
        }
      } catch {
        // Fallback to default demo numbers
      }
    }
    void loadStats();
    return () => {
      mounted = false;
    };
  }, []);

  const capabilities = [
    {
      title: T['feat1_title'] || 'AI Complaint Analysis',
      desc:
        T['feat1_desc'] ||
        'Understands Hindi, English & regional dialects with multi-modal hazard vision validation.',
      icon: <Sparkles className="text-orange-500" size={20} />,
      badge: 'Gemini 2.5 Flash',
    },
    {
      title: T['feat2_title'] || 'Graph & Spatial Intelligence',
      desc:
        T['feat2_desc'] ||
        'PostGIS spatial boundaries link complaints, wards, and officers into an accountability network.',
      icon: <MapPin className="text-blue-500" size={20} />,
      badge: 'PostGIS / Neon',
    },
    {
      title: T['feat3_title'] || 'Duplicate Clustering',
      desc:
        T['feat3_desc'] ||
        'Nearby reports within 150m are automatically grouped into single high-impact civic clusters.',
      icon: <TrendingUp className="text-emerald-500" size={20} />,
      badge: '150m Geo-Deduplication',
    },
    {
      title: 'SLA Auto-Escalation',
      desc: 'Transparent time-bound resolution with automated level 1-3 hierarchical escalations.',
      icon: <Clock className="text-amber-500" size={20} />,
      badge: 'QStash Cron',
    },
    {
      title: 'Statutory Section 6(1) RTI Drafter',
      desc: 'Instant generation of formal dual-language legal RTI applications with BPL fee waiver.',
      icon: <Scale className="text-indigo-500" size={20} />,
      badge: 'RTI Act 2005',
    },
    {
      title: 'IoT Streetlight Telemetry',
      desc: 'Real-time telemetry stream capturing hardware outages and auto-logging municipal grievances.',
      icon: <Cpu className="text-teal-500" size={20} />,
      badge: 'Edge Ingestion',
    },
  ];

  const steps = [
    {
      step: '01',
      title: T['step1_title'] || 'Report in Your Language',
      desc: T['step1_desc'] || 'Speak or type your grievance in Hindi, English, or Hinglish with photo evidence.',
    },
    {
      step: '02',
      title: T['step2_title'] || 'AI Understands & Routes',
      desc: T['step2_desc'] || 'AI categorizes the issue, scores urgency, and routes it to the designated department.',
    },
    {
      step: '03',
      title: T['step3_title'] || 'Spatial Deduplication & Clustering',
      desc: T['step3_desc'] || 'PostGIS groups nearby grievances into community clusters, amplifying civic priority.',
    },
    {
      step: '04',
      title: T['step4_title'] || 'Track & Get Resolution',
      desc: T['step4_desc'] || 'Monitor live updates via real-time stream. Overdue cases auto-escalate.',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16 py-6 sm:py-10">
      {/* Hero Section */}
      <section className="text-center space-y-6 pt-4 pb-2">
        <ScrollReveal direction="down">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold tracking-wide shadow-xs">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            <span>{T['hero_tagline'] || 'Made in India, for India'} • JanSetu Multiverse</span>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={100}>
          <h1 className="text-4xl sm:text-6xl font-black text-gray-900 tracking-tight leading-[1.15] max-w-4xl mx-auto">
            {T['hero_title_1'] || 'Civic Issues.'}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500">
              {T['hero_title_2'] || 'Resolved.'}
            </span>{' '}
            <span className="underline decoration-emerald-500 decoration-wavy decoration-4">
              {T['hero_title_3'] || 'Faster.'}
            </span>
          </h1>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={200}>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {T['hero_subtitle'] ||
              'JanSetu connects citizens, complaints, locations and departments using AI and spatial intelligence. Report in your preferred language — we handle the rest.'}
          </p>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={300}>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/submit"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm shadow-lg shadow-green-900/20 btn-premium active:scale-95 transition-all"
            >
              <Zap size={18} /> {T['hero_file_btn'] || 'File a Complaint'}
            </Link>
            <Link
              to="/track"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 font-bold text-sm shadow-sm btn-premium active:scale-95 transition-all"
            >
              <Shield size={18} className="text-orange-500" /> {T['hero_track_btn'] || 'Track Your Issue'}
            </Link>
            <Link
              to="/hazard-map"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-bold text-sm btn-premium active:scale-95 transition-all"
            >
              <MapPin size={18} /> {T['nav_hazard_map'] || 'Hazard Map'}
            </Link>
          </div>
        </ScrollReveal>
      </section>

      {/* Live Statistics Ticker */}
      <section>
        <ScrollReveal direction="up">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileText size={22} />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-gray-900">{stats.total}</div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {T['stat_total'] || 'Total Filed'}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle size={22} />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-600">{stats.resolved}</div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {T['stat_resolved'] || 'Resolved'}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock size={22} />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-amber-600">{stats.pending}</div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {T['stat_pending'] || 'In Progress'}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-red-600">{stats.escalated}</div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {T['stat_escalated'] || 'Escalated'}
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* 4-Step Workflow Section */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {T['how_title'] || 'How JanSetu Works'}
          </h2>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">
            {T['how_subtitle'] || 'From complaint to resolution — powered by AI and spatial intelligence'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((st, idx) => (
            <ScrollReveal key={st.step} direction="up" delay={idx * 80}>
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden h-full flex flex-col justify-between">
                <div className="text-4xl font-black text-orange-500/20 mb-3">{st.step}</div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base mb-1.5">{st.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{st.desc}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Capabilities Grid */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {T['feat_title'] || 'Platform Capabilities'}
          </h2>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">
            {T['feat_subtitle'] || 'Not just complaint submission — a civic accountability intelligence platform'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {capabilities.map((cap, idx) => (
            <ScrollReveal key={cap.title} direction="up" delay={idx * 60}>
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:border-orange-200 hover:shadow-md transition-all h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100">
                      {cap.icon}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-orange-700 px-2.5 py-1 rounded-full border border-orange-100">
                      {cap.badge}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-2">{cap.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{cap.desc}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Quick Navigation Cards */}
      <section className="pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/submit"
            className="group bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-green-900/10 hover:shadow-xl transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-4">
              <Zap size={20} />
            </div>
            <h3 className="font-bold text-lg mb-1">{T['nav_file'] || 'File a Complaint'}</h3>
            <p className="text-xs text-white/80 mb-4">Submit grievances with AI voice & photo tagging</p>
            <div className="flex items-center gap-1.5 text-xs font-bold group-hover:translate-x-1 transition-transform">
              Proceed <ArrowRight size={14} />
            </div>
          </Link>

          <Link
            to="/hazard-map"
            className="group bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg shadow-orange-900/10 hover:shadow-xl transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-4">
              <MapPin size={20} />
            </div>
            <h3 className="font-bold text-lg mb-1">{T['nav_hazard_map'] || 'Hazard Map'}</h3>
            <p className="text-xs text-white/80 mb-4">Explore geographic issue clusters across wards</p>
            <div className="flex items-center gap-1.5 text-xs font-bold group-hover:translate-x-1 transition-transform">
              View Map <ArrowRight size={14} />
            </div>
          </Link>

          <Link
            to="/rti"
            className="group bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-900/10 hover:shadow-xl transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-4">
              <Scale size={20} />
            </div>
            <h3 className="font-bold text-lg mb-1">{T['nav_rti'] || 'RTI Drafter'}</h3>
            <p className="text-xs text-white/80 mb-4">Draft statutory Section 6(1) requests</p>
            <div className="flex items-center gap-1.5 text-xs font-bold group-hover:translate-x-1 transition-transform">
              Draft Application <ArrowRight size={14} />
            </div>
          </Link>

          <Link
            to="/grievance"
            className="group bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-6 text-white shadow-lg shadow-purple-900/10 hover:shadow-xl transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-4">
              <FileText size={20} />
            </div>
            <h3 className="font-bold text-lg mb-1">Grievance AI</h3>
            <p className="text-xs text-white/80 mb-4">Transform raw narrative into formal legal draft</p>
            <div className="flex items-center gap-1.5 text-xs font-bold group-hover:translate-x-1 transition-transform">
              Start Assistant <ArrowRight size={14} />
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
