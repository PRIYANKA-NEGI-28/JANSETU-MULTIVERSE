import { useEffect, useState } from 'react';
import {
  MapPin, Brain, GitBranch, BarChart2, Scale, Camera,
  ArrowRight, FileText, TrendingUp, Users, CheckCircle, AlertTriangle, Clock,
  Lightbulb, Truck, Droplet, Construction, Zap, Activity
} from 'lucide-react';
import { getAllComplaints, type Neo4jComplaint } from '../lib/neo4j';
import { useLang } from '../lib/langContext';
import type { Page } from '../types';
import type { AuthUser } from '../lib/auth';

import ScrollReveal from '../components/ScrollReveal';
import CountUp from '../components/CountUp';
import { Magnetic, Tilt, CursorGlow } from '../components/MouseInteractions';

interface HomeProps {
  onNavigate: (page: Page) => void;
  user?: AuthUser | null;
}

const ISSUE_ICONS: Record<string, React.ReactNode> = {
  'Street Light': <Lightbulb size={18} className="text-yellow-500" />,
  'Road Damage': <Construction size={18} className="text-orange-500" />,
  'Waste Management': <Truck size={18} className="text-green-600" />,
  'Water Supply': <Droplet size={18} className="text-blue-500" />,
  'Sewage': <Droplet size={18} className="text-gray-500" />,
  'Electricity Hazard': <Zap size={18} className="text-yellow-600" />,
  'Sanitation': <Activity size={18} className="text-teal-500" />,
  'Healthcare': <Activity size={18} className="text-red-500" />,
};

const URGENCY_COLORS = {
  LOW: 'bg-blue-100 text-blue-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const STATUS_COLORS = {
  PENDING: 'text-yellow-600',
  ASSIGNED: 'text-blue-600',
  IN_PROGRESS: 'text-indigo-600',
  RESOLVED: 'text-green-600',
  ESCALATED: 'text-red-600',
};

export default function Home({ onNavigate, user }: HomeProps) {
  const { T } = useLang();
  const [stats, setStats] = useState({ total: 0, resolved: 0, pending: 0, escalated: 0 });
  const [recentComplaints, setRecentComplaints] = useState<Neo4jComplaint[]>([]);
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getAllComplaints();
        if (data) {
          setRecentComplaints(data.slice(0, 6));
          setStats({
            total: data.length,
            resolved: data.filter(c => c.status === 'RESOLVED').length,
            pending: data.filter(c => c.status === 'PENDING').length,
            escalated: data.filter(c => c.status === 'ESCALATED').length,
          });
        }
      } catch { /* show zeros if Neo4j unreachable on first load */ }
    }
    loadData();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Disable mouse-move parallax on touch-screen devices
      if (window.matchMedia('(pointer: coarse)').matches) return;
      const x = (e.clientX - window.innerWidth / 2) * 0.025;
      const y = (e.clientY - window.innerHeight / 2) * 0.025;
      setParallaxOffset({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const steps = [
    { step: '01', title: T.step1_title, desc: T.step1_desc, icon: <FileText size={20} /> },
    { step: '02', title: T.step2_title, desc: T.step2_desc, icon: <Brain size={20} /> },
    { step: '03', title: T.step3_title, desc: T.step3_desc, icon: <GitBranch size={20} /> },
    { step: '04', title: T.step4_title, desc: T.step4_desc, icon: <TrendingUp size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        {/* Slow moving ambient gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-green-50 animate-gradient-text bg-[length:200%_200%]"></div>
        
        {/* Floating background decorative blobs with parallax */}
        <div 
          className="absolute top-0 right-0 w-96 h-96 bg-orange-100 rounded-full opacity-30 animate-float transition-transform duration-300 ease-out"
          style={{
            transform: `translate3d(calc(50% + ${parallaxOffset.x}px), calc(-50% + ${parallaxOffset.y}px), 0)`,
          }}
        ></div>
        <div 
          className="absolute bottom-0 left-0 w-64 h-64 bg-green-100 rounded-full opacity-30 animate-float transition-transform duration-300 ease-out"
          style={{
            transform: `translate3d(calc(-50% + ${parallaxOffset.x * -0.6}px), calc(50% + ${parallaxOffset.y * -0.6}px), 0)`,
            animationDelay: '1.5s',
          }}
        ></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <ScrollReveal direction="up" delay={100}>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 leading-tight mb-6">
                {T.hero_title_1}{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600 animate-gradient-text bg-[length:200%_200%]">{T.hero_title_2}</span>{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-green-700 animate-gradient-text bg-[length:200%_200%]">{T.hero_title_3}</span>
              </h1>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={250}>
              <p className="text-xl text-gray-600 leading-relaxed mb-10 max-w-3xl mx-auto">
                {T.hero_subtitle}
              </p>
            </ScrollReveal>

            {user && (
              <ScrollReveal direction="up" delay={350} className="inline-block">
                <div className="inline-flex items-center gap-2 px-5 py-2 bg-green-50 border border-green-200 text-green-700 rounded-full text-sm font-semibold mb-6">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  {T.hero_welcome}, {user.name}!
                </div>
              </ScrollReveal>
            )}

            <ScrollReveal direction="scale" delay={450}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Magnetic>
                  <button
                    onClick={() => onNavigate('submit')}
                    className="flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-lg transition-all duration-200 shadow-lg hover:shadow-xl btn-premium active:scale-95 group"
                  >
                    {T.hero_file_btn}{' '}
                    <ArrowRight size={20} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </Magnetic>
                <Magnetic>
                  <button
                    onClick={() => onNavigate('track')}
                    className="flex items-center gap-2 px-8 py-4 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-lg border border-gray-200 transition-all duration-200 shadow-sm hover:shadow-md btn-premium active:scale-95"
                  >
                    {T.hero_track_btn}
                  </button>
                </Magnetic>
              </div>
            </ScrollReveal>

            {/* India flag strip */}
            <ScrollReveal direction="up" delay={600}>
              <div className="mt-12 flex items-center justify-center gap-0 mx-auto w-32 h-2 rounded-full overflow-hidden shadow-sm">
                <div className="flex-1 h-full bg-orange-500"></div>
                <div className="flex-1 h-full bg-white border-y border-gray-200"></div>
                <div className="flex-1 h-full bg-green-600"></div>
              </div>
              <p className="text-xs text-gray-400 mt-2 font-medium">{T.hero_tagline}</p>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gray-900 py-12 relative overflow-hidden">
        {/* Subtle decorative background noise or lights */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(249,115,22,0.05),transparent_60%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: T.stat_total, value: stats.total, icon: <Users size={20} />, color: 'text-orange-400' },
              { label: T.stat_resolved, value: stats.resolved, icon: <CheckCircle size={20} />, color: 'text-green-400' },
              { label: T.stat_pending, value: stats.pending, icon: <Clock size={20} />, color: 'text-yellow-400' },
              { label: T.stat_escalated, value: stats.escalated, icon: <AlertTriangle size={20} />, color: 'text-red-400' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="text-center group transition-transform duration-300 hover:scale-105">
                <div className={`flex items-center justify-center mb-2 ${color} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
                  {icon}
                </div>
                <div className={`text-4xl font-extrabold ${color} mb-1 tracking-tight`}>
                  <CountUp end={value} />
                </div>
                <div className="text-gray-400 text-sm font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <ScrollReveal direction="up">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">{T.how_title}</h2>
              <p className="text-gray-500 text-lg max-w-2xl mx-auto">{T.how_subtitle}</p>
            </ScrollReveal>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map(({ step, title, desc, icon }, i) => (
              <ScrollReveal key={step} direction="up" delay={i * 100} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-orange-200 to-transparent z-0"></div>
                )}
                <div className="relative z-10 bg-white border border-gray-100 rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 hover:border-orange-200 group">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-5xl font-black text-gray-100 transition-colors group-hover:text-orange-50">{step}</span>
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
                      {icon}
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>


      {/* Recent Complaints */}
      {recentComplaints.length > 0 && (
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal direction="up" className="flex items-center justify-between mb-12">
              <div>
                <h2 className="text-4xl font-bold text-gray-900 mb-2">{T.feed_title}</h2>
                <p className="text-gray-500">{T.feed_subtitle}</p>
              </div>
              {user?.role === 'admin' && (
                <button
                  onClick={() => onNavigate('admin')}
                  className="hidden md:flex items-center gap-2 text-orange-500 hover:text-orange-600 font-semibold transition-colors duration-200 active:scale-95 group"
                >
                  {T.feed_view_all}{' '}
                  <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              )}
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {recentComplaints.map((complaint, i) => (
                <ScrollReveal key={complaint.id} direction="up" delay={i * 80}>
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 hover:border-orange-100 group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                          {ISSUE_ICONS[complaint.issue_type] || <FileText size={18} className="text-gray-500" />}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{complaint.issue_type}</p>
                          <p className="text-gray-400 text-xs">{complaint.complaint_number}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full transition-transform duration-300 group-hover:scale-105 ${URGENCY_COLORS[complaint.urgency]}`}>
                        {complaint.urgency}
                      </span>
                    </div>

                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">{complaint.summary}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                        <MapPin size={11} className="transition-transform duration-300 group-hover:translate-y-[-1px]" />
                        <span>{complaint.area}, {complaint.ward}</span>
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-semibold ${STATUS_COLORS[complaint.status]}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                        {complaint.status.replace('_', ' ')}
                      </div>
                    </div>

                    {complaint.similar_count > 1 && (
                      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-1.5 text-xs text-indigo-600 font-medium transition-colors group-hover:text-indigo-700">
                        <Users size={11} className="animate-pulse" />
                        {complaint.similar_count} {T.feed_citizens_affected}
                      </div>
                    )}
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* New Tools Highlight */}
      <section className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <ScrollReveal direction="up">
              <span className="text-xs font-bold text-orange-600 uppercase tracking-widest">{T.tools_badge}</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2 mb-3">{T.tools_title}</h2>
              <p className="text-gray-500 max-w-xl mx-auto">{T.tools_subtitle}</p>
            </ScrollReveal>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hazard Map Card */}
            <ScrollReveal direction="left" className="h-full">
              <Tilt maxRotate={3} className="h-full">
                <CursorGlow glowColor="rgba(239, 68, 68, 0.12)" className="h-full rounded-3xl border border-gray-800 bg-gray-950">
                  <div className="group relative overflow-hidden p-8 h-full">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-950/40 to-gray-950 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative z-10">
                      <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
                        <MapPin size={22} className="text-red-400" />
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full font-bold border border-red-500/20">{T.tools_hazard_live}</span>
                        <span className="text-xs text-gray-500 font-medium">{T.tools_hazard_inspired}</span>
                      </div>
                      <h3 className="text-2xl font-black text-white mb-3">{T.tools_hazard_title}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed mb-6">{T.tools_hazard_desc}</p>
                      <div className="flex flex-wrap gap-2 mb-6">
                        {[T.tools_hazard_tag1, T.tools_hazard_tag2, T.tools_hazard_tag3, T.tools_hazard_tag4].map(tag => (
                          <span key={tag} className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded-full border border-gray-700 transition-colors group-hover:border-gray-600">{tag}</span>
                        ))}
                      </div>
                      <button
                        onClick={() => onNavigate('hazardmap')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-all duration-200 active:scale-95 btn-premium shadow-md"
                      >
                        <Camera size={15} /> {T.tools_hazard_btn}
                      </button>
                    </div>
                  </div>
                </CursorGlow>
              </Tilt>
            </ScrollReveal>

            {/* RTI Drafter Card */}
            <ScrollReveal direction="right" className="h-full">
              <Tilt maxRotate={3} className="h-full">
                <CursorGlow glowColor="rgba(249, 115, 22, 0.12)" className="h-full rounded-3xl border border-orange-100 bg-orange-50">
                  <div className="group relative overflow-hidden p-8 h-full">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-100/40 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative z-10">
                      <div className="w-12 h-12 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
                        <Scale size={22} className="text-orange-600" />
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full font-bold border border-orange-200">{T.tools_rti_badge}</span>
                        <span className="text-xs text-gray-500 font-medium">{T.tools_rti_inspired}</span>
                      </div>
                      <h3 className="text-2xl font-black text-gray-900 mb-3">{T.tools_rti_title}</h3>
                      <p className="text-gray-600 text-sm leading-relaxed mb-6">{T.tools_rti_desc}</p>
                      <div className="flex flex-wrap gap-2 mb-6">
                        {[T.tools_rti_tag1, T.tools_rti_tag2, T.tools_rti_tag3, T.tools_rti_tag4].map(tag => (
                          <span key={tag} className="text-xs px-3 py-1 bg-white text-gray-500 rounded-full border border-orange-100 transition-colors group-hover:border-orange-200">{tag}</span>
                        ))}
                      </div>
                      <button
                        onClick={() => onNavigate('rti')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-all duration-200 active:scale-95 btn-premium shadow-md"
                      >
                        <Scale size={15} /> {T.tools_rti_btn}
                      </button>
                    </div>
                  </div>
                </CursorGlow>
              </Tilt>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
        {/* ambient background light */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_75%,rgba(249,115,22,0.06),transparent_60%)] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <ScrollReveal direction="up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-500/20 text-orange-400 rounded-full text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
              {T.cta_badge}
            </div>
            <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">{T.cta_title}</h2>
            <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">{T.cta_subtitle}</p>
          </ScrollReveal>

          <ScrollReveal direction="scale" delay={150}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Magnetic>
                <button
                  onClick={() => onNavigate('submit')}
                  className="flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-lg transition-all shadow-lg hover:shadow-xl btn-premium active:scale-95 group"
                >
                  {T.cta_file_btn}{' '}
                  <ArrowRight size={20} className="transition-transform duration-200 group-hover:translate-x-1" />
                </button>
              </Magnetic>
              {user?.role === 'admin' && (
                <Magnetic>
                  <button
                    onClick={() => onNavigate('admin')}
                    className="flex items-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-lg border border-white/20 transition-all btn-premium active:scale-95"
                  >
                    <BarChart2 size={20} /> {T.cta_dashboard_btn}
                  </button>
                </Magnetic>
              )}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal direction="up" className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 group cursor-pointer">
                <span className="text-white font-black text-lg tracking-tight">Jan</span>
                <span className="text-orange-500 font-black text-lg tracking-tight transition-transform duration-300 group-hover:translate-x-0.5">Setu</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <button 
                onClick={() => onNavigate('home')} 
                className="text-gray-400 hover:text-white text-sm capitalize transition-all duration-200 hover:-translate-y-0.5 transform"
              >
                {T.footer_home}
              </button>
              <button 
                onClick={() => onNavigate('submit')} 
                className="text-gray-400 hover:text-white text-sm capitalize transition-all duration-200 hover:-translate-y-0.5 transform"
              >
                {T.footer_submit}
              </button>
              <button 
                onClick={() => onNavigate('track')} 
                className="text-gray-400 hover:text-white text-sm capitalize transition-all duration-200 hover:-translate-y-0.5 transform"
              >
                {T.footer_track}
              </button>
              {user?.role === 'admin' && (
                <button 
                  onClick={() => onNavigate('admin')} 
                  className="text-gray-400 hover:text-white text-sm capitalize transition-all duration-200 hover:-translate-y-0.5 transform"
                >
                  {T.footer_admin}
                </button>
              )}
            </div>
            <p className="text-gray-500 text-sm">{T.footer_tagline}</p>
          </ScrollReveal>
        </div>
      </footer>
    </div>
  );
}
