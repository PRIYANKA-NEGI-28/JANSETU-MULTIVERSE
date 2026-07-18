import { ScrollView, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import {
  MapPin, Brain, GitBranch, Bell, BarChart2, Shield, Scale, Camera,
  ArrowRight, FileText, TrendingUp, Users, CheckCircle, AlertTriangle, Clock,
  Lightbulb, Truck, Droplet, Circle, Construction, Zap, Activity
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { getAllComplaints, type Neo4jComplaint } from '../../lib/neo4j';
import { useLang } from '../../lib/langContext';

const ISSUE_ICONS: Record<string, React.ReactNode> = {
  'Street Light': <Lightbulb size={18} color="#eab308" />,
  'Road Damage': <Construction size={18} color="#f97316" />,
  'Waste Management': <Truck size={18} color="#16a34a" />,
  'Water Supply': <Droplet size={18} color="#3b82f6" />,
  'Sewage': <Droplet size={18} color="#6b7280" />,
  'Electricity Hazard': <Zap size={18} color="#ca8a04" />,
  'Sanitation': <Activity size={18} color="#14b8a6" />,
  'Healthcare': <Activity size={18} color="#ef4444" />,
};

const URGENCY_COLORS = {
  LOW: 'bg-blue-100',
  MEDIUM: 'bg-yellow-100',
  HIGH: 'bg-orange-100',
  CRITICAL: 'bg-red-100',
};

const URGENCY_TEXT = {
  LOW: 'text-blue-700',
  MEDIUM: 'text-yellow-700',
  HIGH: 'text-orange-700',
  CRITICAL: 'text-red-700',
};

const STATUS_COLORS = {
  PENDING: 'text-yellow-600',
  ASSIGNED: 'text-blue-600',
  IN_PROGRESS: 'text-indigo-600',
  RESOLVED: 'text-green-600',
  ESCALATED: 'text-red-600',
};

export default function HomeScreen() {
  const { T } = useLang();
  const [stats, setStats] = useState({ total: 0, resolved: 0, pending: 0, escalated: 0 });
  const [recentComplaints, setRecentComplaints] = useState<Neo4jComplaint[]>([]);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    }
    loadData();
  }, []);

  const features = [
    { icon: <Brain size={22} color="#8b5cf6" />, title: T.feat1_title, desc: T.feat1_desc, bg: 'bg-violet-100' },
    { icon: <GitBranch size={22} color="#3b82f6" />, title: T.feat2_title, desc: T.feat2_desc, bg: 'bg-blue-100' },
    { icon: <MapPin size={22} color="#22c55e" />, title: T.feat3_title, desc: T.feat3_desc, bg: 'bg-green-100' },
    { icon: <Bell size={22} color="#f97316" />, title: T.feat4_title, desc: T.feat4_desc, bg: 'bg-orange-100' },
    { icon: <BarChart2 size={22} color="#14b8a6" />, title: T.feat5_title, desc: T.feat5_desc, bg: 'bg-teal-100' },
    { icon: <Shield size={22} color="#ef4444" />, title: T.feat6_title, desc: T.feat6_desc, bg: 'bg-red-100' },
  ];

  const steps = [
    { step: '01', title: T.step1_title, desc: T.step1_desc, icon: <FileText size={20} color="#f97316" /> },
    { step: '02', title: T.step2_title, desc: T.step2_desc, icon: <Brain size={20} color="#f97316" /> },
    { step: '03', title: T.step3_title, desc: T.step3_desc, icon: <GitBranch size={20} color="#f97316" /> },
    { step: '04', title: T.step4_title, desc: T.step4_desc, icon: <TrendingUp size={20} color="#f97316" /> },
  ];

  return (
    <ScrollView className="flex-1 bg-white">
      {/* Hero */}
      <View className="pt-16 pb-10 px-4 bg-gradient-to-b from-orange-50 to-white">
        <View className="items-center mb-6">
          <View className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 items-center justify-center mb-4 shadow-lg">
            <Text className="text-white font-black text-2xl">JS</Text>
          </View>
        </View>

        <Text className="text-4xl font-extrabold text-gray-900 text-center mb-3">
          {T.hero_title_1}{' '}
          <Text className="text-orange-500">{T.hero_title_2}</Text>{' '}
          <Text className="text-green-600">{T.hero_title_3}</Text>
        </Text>

        <Text className="text-lg text-gray-500 text-center mb-6 leading-relaxed">
          {T.hero_subtitle}
        </Text>

        <View className="flex-row justify-center gap-3 mb-4">
          <Link href="/submit" asChild>
            <Pressable className="flex-row items-center gap-2 px-6 py-3 bg-orange-500 rounded-xl active:bg-orange-600">
              <Text className="text-white font-bold">{T.hero_file_btn}</Text>
              <ArrowRight size={18} color="white" />
            </Pressable>
          </Link>
          <Link href="/track" asChild>
            <Pressable className="flex-row items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl active:bg-gray-50">
              <Text className="text-gray-700 font-semibold">{T.hero_track_btn}</Text>
            </Pressable>
          </Link>
        </View>

        {/* India flag strip */}
        <View className="flex-row justify-center">
          <View className="flex-row w-24 h-2 rounded-full overflow-hidden">
            <View className="flex-1 bg-orange-500" />
            <View className="flex-1 bg-white border-y border-gray-200" />
            <View className="flex-1 bg-green-600" />
          </View>
        </View>
        <Text className="text-xs text-gray-400 text-center mt-2 font-medium">{T.hero_tagline}</Text>
      </View>

      {/* Stats */}
      <View className="bg-gray-900 py-8 px-4">
        <View className="flex-row flex-wrap justify-center gap-4">
          {[
            { label: T.stat_total, value: stats.total, icon: <Users size={20} color="#fb923c" /> },
            { label: T.stat_resolved, value: stats.resolved, icon: <CheckCircle size={20} color="#4ade80" /> },
            { label: T.stat_pending, value: stats.pending, icon: <Clock size={20} color="#facc15" /> },
            { label: T.stat_escalated, value: stats.escalated, icon: <AlertTriangle size={20} color="#f87171" /> },
          ].map(({ label, value, icon }) => (
            <View key={label} className="items-center w-20">
              {icon}
              <Text className="text-3xl font-extrabold text-white mt-1">{value}</Text>
              <Text className="text-xs text-gray-400 font-medium text-center">{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* How it works */}
      <View className="py-10 px-4">
        <Text className="text-2xl font-bold text-gray-900 text-center mb-2">{T.how_title}</Text>
        <Text className="text-gray-500 text-center mb-6">{T.how_subtitle}</Text>

        <View className="gap-4">
          {steps.map(({ step, title, desc, icon }) => (
            <View key={step} className="flex-row items-start gap-4 bg-white border border-gray-100 rounded-2xl p-4">
              <View className="w-12 h-12 rounded-xl bg-orange-50 items-center justify-center">
                {icon}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="text-xs font-bold text-gray-400">{step}</Text>
                  <Text className="font-bold text-gray-900">{title}</Text>
                </View>
                <Text className="text-sm text-gray-500">{desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Features */}
      <View className="py-10 px-4 bg-gray-50">
        <Text className="text-2xl font-bold text-gray-900 text-center mb-2">{T.feat_title}</Text>
        <Text className="text-gray-500 text-center mb-6">{T.feat_subtitle}</Text>

        <View className="gap-3">
          {features.map(({ icon, title, desc, bg }) => (
            <View key={title} className="flex-row items-start gap-4 bg-white rounded-2xl p-4 border border-gray-100">
              <View className={`w-12 h-12 rounded-xl ${bg} items-center justify-center`}>
                {icon}
              </View>
              <View className="flex-1">
                <Text className="font-bold text-gray-900 mb-1">{title}</Text>
                <Text className="text-sm text-gray-500">{desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Recent Complaints */}
      {recentComplaints.length > 0 && (
        <View className="py-10 px-4">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-gray-900">{T.feed_title}</Text>
            <Link href="/admin" asChild>
              <Pressable className="flex-row items-center gap-1">
                <Text className="text-orange-500 font-semibold text-sm">{T.feed_view_all}</Text>
                <ArrowRight size={14} color="#f97316" />
              </Pressable>
            </Link>
          </View>

          <View className="gap-3">
            {recentComplaints.slice(0, 3).map(complaint => (
              <View key={complaint.id} className="bg-white border border-gray-100 rounded-2xl p-4">
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-row items-center gap-2">
                    <View className="w-8 h-8 rounded-lg bg-gray-50 items-center justify-center">
                      {ISSUE_ICONS[complaint.issue_type] || <FileText size={18} color="#6b7280" />}
                    </View>
                    <View>
                      <Text className="font-bold text-gray-900 text-sm">{complaint.issue_type}</Text>
                      <Text className="text-gray-400 text-xs">{complaint.complaint_number}</Text>
                    </View>
                  </View>
                  <View className={`px-2 py-1 rounded-full ${URGENCY_COLORS[complaint.urgency]}`}>
                    <Text className={`text-xs font-bold ${URGENCY_TEXT[complaint.urgency]}`}>
                      {complaint.urgency}
                    </Text>
                  </View>
                </View>
                <Text className="text-gray-600 text-sm mb-2" numberOfLines={2}>{complaint.summary}</Text>
                <View className="flex-row justify-between items-center">
                  <View className="flex-row items-center gap-1">
                    <MapPin size={11} color="#9ca3af" />
                    <Text className="text-gray-400 text-xs">{complaint.area}, {complaint.ward}</Text>
                  </View>
                  <Text className={`text-xs font-semibold ${STATUS_COLORS[complaint.status]}`}>
                    {complaint.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Tools Section */}
      <View className="py-10 px-4 border-t border-gray-100">
        <View className="items-center mb-6">
          <Text className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-1">{T.tools_badge}</Text>
          <Text className="text-2xl font-bold text-gray-900">{T.tools_title}</Text>
        </View>

        {/* Hazard Map Card */}
        <Link href="/hazardmap" asChild>
          <Pressable className="bg-gray-950 border border-gray-800 rounded-2xl p-5 mb-4">
            <View className="flex-row items-start gap-4">
              <View className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 items-center justify-center">
                <MapPin size={22} color="#f87171" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full font-bold">{T.tools_hazard_live}</Text>
                </View>
                <Text className="text-lg font-bold text-white mb-1">{T.tools_hazard_title}</Text>
                <Text className="text-gray-400 text-sm" numberOfLines={2}>{T.tools_hazard_desc}</Text>
              </View>
            </View>
          </Pressable>
        </Link>

        {/* RTI Card */}
        <Link href="/rti" asChild>
          <Pressable className="bg-orange-50 border border-orange-100 rounded-2xl p-5">
            <View className="flex-row items-start gap-4">
              <View className="w-12 h-12 rounded-2xl bg-orange-100 border border-orange-200 items-center justify-center">
                <Scale size={22} color="#ea580c" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full font-bold">{T.tools_rti_badge}</Text>
                </View>
                <Text className="text-lg font-bold text-gray-900 mb-1">{T.tools_rti_title}</Text>
                <Text className="text-gray-600 text-sm" numberOfLines={2}>{T.tools_rti_desc}</Text>
              </View>
            </View>
          </Pressable>
        </Link>
      </View>

      {/* CTA */}
      <View className="py-10 px-4 bg-gradient-to-b from-gray-900 to-gray-800">
        <Text className="text-xs text-orange-400 text-center mb-2">{T.cta_badge}</Text>
        <Text className="text-2xl font-bold text-white text-center mb-2">{T.cta_title}</Text>
        <Text className="text-gray-400 text-center mb-6">{T.cta_subtitle}</Text>
        <Link href="/submit" asChild>
          <Pressable className="flex-row items-center justify-center gap-2 px-6 py-3 bg-orange-500 rounded-xl mx-auto active:bg-orange-600">
            <Text className="text-white font-bold">{T.cta_file_btn}</Text>
            <ArrowRight size={18} color="white" />
          </Pressable>
        </Link>
      </View>

      {/* Footer */}
      <View className="py-6 px-4 bg-gray-900 border-t border-gray-800">
        <View className="flex-row justify-center items-center gap-2 mb-2">
          <Text className="text-white font-black text-lg">Jan</Text>
          <Text className="text-orange-500 font-black text-lg">Setu</Text>
        </View>
        <Text className="text-gray-500 text-xs text-center">{T.footer_tagline}</Text>
      </View>
    </ScrollView>
  );
}
