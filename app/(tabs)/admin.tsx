import { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import {
  BarChart2, Users, CheckCircle, Clock, AlertTriangle,
  Shield, ArrowUpRight, RefreshCw, MapPin, LogOut,
  GitBranch, Zap, TrendingUp, Network,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAllComplaints, getDepartmentStats, updateComplaintStatus,
  getGraphStats, runEscalationCheck,
  type Neo4jComplaint, type Neo4jDepartment, type GraphStats,
} from '../../lib/neo4j';
import { useLang } from '../../lib/langContext';

const STATUS_CONFIG = {
  PENDING: { labelKey: 'status_pending' as const, color: 'bg-yellow-100', text: 'text-yellow-700' },
  ASSIGNED: { labelKey: 'status_assigned' as const, color: 'bg-blue-100', text: 'text-blue-700' },
  IN_PROGRESS: { labelKey: 'status_in_progress' as const, color: 'bg-teal-100', text: 'text-teal-700' },
  RESOLVED: { labelKey: 'status_resolved' as const, color: 'bg-green-100', text: 'text-green-700' },
  ESCALATED: { labelKey: 'status_escalated' as const, color: 'bg-red-100', text: 'text-red-700' },
};

const URGENCY_CONFIG = {
  LOW: 'bg-blue-50 border-blue-100 text-blue-600',
  MEDIUM: 'bg-yellow-50 border-yellow-100 text-yellow-600',
  HIGH: 'bg-orange-50 border-orange-100 text-orange-600',
  CRITICAL: 'bg-red-50 border-red-100 text-red-600',
};

export default function AdminScreen() {
  const { T } = useLang();
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [complaints, setComplaints] = useState<Neo4jComplaint[]>([]);
  const [departments, setDepartments] = useState<Neo4jDepartment[]>([]);
  const [graphStats, setGraphStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [escalating, setEscalating] = useState(false);
  const [escalationResult, setEscalationResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'complaints' | 'departments' | 'graph'>('complaints');

  useEffect(() => {
    AsyncStorage.getItem('jansetu_admin_auth').then(val => {
      if (val === 'true') {
        setAuthed(true);
      } else {
        setAuthed(false);
      }
    });
  }, []);

  useEffect(() => {
    if (authed === true) {
      loadData();
    }
  }, [authed]);

  async function loadData() {
    setLoading(true);
    try {
      const [c, d, g] = await Promise.all([
        getAllComplaints(),
        getDepartmentStats(),
        getGraphStats(),
      ]);
      setComplaints(c || []);
      setDepartments(d || []);
      setGraphStats(g);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
    setLoading(false);
  }

  async function handleUpdateStatus(id: string, status: string) {
    try {
      await updateComplaintStatus(id, status);
      setComplaints(prev => prev.map(c =>
        c.id === id ? { ...c, status: status as Neo4jComplaint['status'] } : c
      ));
    } catch (err) {
      console.error('Status update failed:', err);
    }
  }

  async function handleEscalationCheck() {
    setEscalating(true);
    setEscalationResult(null);
    try {
      const result = await runEscalationCheck();
      setEscalationResult(T.admin_escalation_done(result.escalated_count));
      await loadData();
    } catch {
      setEscalationResult(T.admin_escalation_failed);
    }
    setEscalating(false);
  }

  async function handleLogout() {
    await AsyncStorage.removeItem('jansetu_admin_auth');
    setAuthed(false);
  }

  if (authed === null) {
    return (
      <View className="flex-1 bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (authed === false) {
    return <Redirect href="/admin-login" />;
  }

  const stats = {
    total: complaints.length,
    pending: complaints.filter(c => c.status === 'PENDING').length,
    inProgress: complaints.filter(c => c.status === 'IN_PROGRESS' || c.status === 'ASSIGNED').length,
    resolved: complaints.filter(c => c.status === 'RESOLVED').length,
    escalated: complaints.filter(c => c.status === 'ESCALATED').length,
    critical: complaints.filter(c => c.urgency === 'CRITICAL').length,
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
    >
      <View className="p-4 pt-8">
        {/* Header */}
        <View className="flex-row justify-between items-start mb-4">
          <View>
            <Text className="text-3xl font-bold text-gray-900">{T.admin_title}</Text>
            <Text className="text-gray-500">{T.admin_subtitle}</Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable
              onPress={handleEscalationCheck}
              disabled={escalating}
              className={`flex-row items-center gap-2 px-4 py-2 border rounded-xl ${escalating ? 'bg-gray-100 border-gray-200' : 'bg-red-50 border-red-100'}`}
            >
              <Zap size={14} color={escalating ? '#9ca3af' : '#dc2626'} />
              <Text className={`text-sm font-semibold ${escalating ? 'text-gray-400' : 'text-red-600'}`}>
                {escalating ? T.admin_running : T.admin_run_escalation}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleLogout}
              className="flex-row items-center gap-2 px-4 py-2 bg-gray-900 rounded-xl"
            >
              <LogOut size={14} color="white" />
              <Text className="text-white text-sm font-semibold">{T.admin_exit}</Text>
            </Pressable>
          </View>
        </View>

        {escalationResult && (
          <View className="flex-row items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
            <Zap size={14} color="#dc2626" />
            <Text className="text-red-700 text-sm font-medium">{escalationResult}</Text>
          </View>
        )}

        {/* Stats Grid */}
        <View className="flex-row flex-wrap gap-3 mb-4">
          {[
            { label: T.admin_stat_total, value: stats.total, icon: <Users size={18} color="#374151" />, bg: 'bg-white' },
            { label: T.admin_stat_pending, value: stats.pending, icon: <Clock size={18} color="#ca8a04" />, bg: 'bg-yellow-50' },
            { label: T.admin_stat_active, value: stats.inProgress, icon: <ArrowUpRight size={18} color="#2563eb" />, bg: 'bg-blue-50' },
            { label: T.admin_stat_resolved, value: stats.resolved, icon: <CheckCircle size={18} color="#16a34a" />, bg: 'bg-green-50' },
            { label: T.admin_stat_escalated, value: stats.escalated, icon: <AlertTriangle size={18} color="#dc2626" />, bg: 'bg-red-50' },
            { label: T.admin_stat_critical, value: stats.critical, icon: <Shield size={18} color="#ea580c" />, bg: 'bg-orange-50' },
          ].map(({ label, value, icon, bg }) => (
            <View key={label} className={`${bg} rounded-xl border border-gray-100 p-3 flex-1 min-w-[100]`}>
              {icon}
              <Text className="text-2xl font-black mt-1">{value}</Text>
              <Text className="text-xs text-gray-500 font-medium">{label}</Text>
            </View>
          ))}
        </View>

        {/* Tabs */}
        <View className="flex-row gap-1 bg-white border border-gray-100 p-1 rounded-xl mb-4">
          {(['complaints', 'departments', 'graph'] as const).map(tab => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg ${activeTab === tab ? 'bg-orange-500' : 'bg-transparent'}`}
            >
              <Text className={`text-sm font-semibold text-center ${activeTab === tab ? 'text-white' : 'text-gray-500'}`}>
                {tab === 'complaints' ? T.admin_tab_complaints : tab === 'departments' ? T.admin_tab_departments : T.admin_tab_graph}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'complaints' && (
          <View className="gap-3">
            {loading ? (
              <View className="items-center py-10">
                <ActivityIndicator size="large" color="#f97316" />
                <Text className="text-gray-400 text-sm mt-3">{T.admin_loading_graph}</Text>
              </View>
            ) : complaints.length === 0 ? (
              <View className="items-center py-10">
                <BarChart2 size={32} color="#d1d5db" />
                <Text className="text-gray-400 text-sm mt-2">{T.admin_no_match}</Text>
              </View>
            ) : (
              complaints.slice(0, 20).map(complaint => (
                <View key={complaint.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="font-mono text-xs font-bold text-gray-500">{complaint.complaint_number}</Text>
                      {complaint.similar_count > 1 && (
                        <View className="flex-row items-center gap-1">
                          <GitBranch size={9} color="#22c55e" />
                          <Text className="text-xs text-green-600 font-semibold">{complaint.similar_count}</Text>
                        </View>
                      )}
                    </View>
                    <View className={`px-2 py-1 rounded-full border ${URGENCY_CONFIG[complaint.urgency]}`}>
                      <Text className="text-xs font-bold">{complaint.urgency}</Text>
                    </View>
                  </View>
                  <Text className="font-bold text-gray-900 text-sm">{complaint.issue_type}</Text>
                  <Text className="text-gray-500 text-xs mb-2" numberOfLines={1}>{complaint.summary}</Text>
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center gap-1">
                      <MapPin size={10} color="#9ca3af" />
                      <Text className="text-xs text-gray-500">{complaint.area}</Text>
                    </View>
                    <View className={`flex-row items-center gap-1 px-2 py-1 rounded-full ${STATUS_CONFIG[complaint.status].color}`}>
                      <Text className={`text-xs font-semibold ${STATUS_CONFIG[complaint.status].text}`}>
                        {T[STATUS_CONFIG[complaint.status].labelKey]}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'departments' && (
          <View className="gap-3">
            {loading ? (
              <View className="items-center py-10">
                <ActivityIndicator size="large" color="#f97316" />
              </View>
            ) : departments.length === 0 ? (
              <View className="items-center py-10 bg-white rounded-xl">
                <Text className="text-gray-400 text-sm">{T.admin_no_depts}</Text>
              </View>
            ) : (
              departments.map(dept => {
                const resolutionRate = dept.total_complaints > 0
                  ? Math.round((dept.resolved_complaints / dept.total_complaints) * 100)
                  : 0;
                const trustColor = dept.trust_score >= 75 ? 'text-green-600' : dept.trust_score >= 50 ? 'text-orange-600' : 'text-red-600';
                return (                  <View key={dept.id} className="bg-white rounded-xl border border-gray-100 p-4">
                    <View className="flex-row justify-between items-start mb-3">
                      <Text className="font-bold text-gray-900 flex-1">{dept.name}</Text>
                      <Text className={`text-2xl font-black ${trustColor}`}>{dept.trust_score}%</Text>
                    </View>
                    <View className="h-2 bg-gray-100 rounded-full mb-3">
                      <View
                        className={`h-full rounded-full ${dept.trust_score >= 75 ? 'bg-green-500' : dept.trust_score >= 50 ? 'bg-orange-500' : 'bg-red-500'}`}
                        style={{ width: `${dept.trust_score}%` }}
                      />
                    </View>
                    <View className="flex-row flex-wrap gap-3">
                      <View className="flex-1 min-w-[60]">
                        <Text className="text-xl font-black text-gray-900">{dept.total_complaints}</Text>
                        <Text className="text-xs text-gray-400">{T.admin_dept_total}</Text>
                      </View>
                      <View className="flex-1 min-w-[60]">
                        <Text className="text-xl font-black text-green-600">{dept.resolved_complaints}</Text>
                        <Text className="text-xs text-gray-400">{T.admin_dept_resolved}</Text>
                      </View>
                      <View className="flex-1 min-w-[60]">
                        <Text className="text-xl font-black text-red-600">{dept.escalated_count}</Text>
                        <Text className="text-xs text-gray-400">{T.admin_dept_escalated}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'graph' && graphStats && (
          <View className="gap-4">
            <View className="flex-row gap-3">
              {[
                { label: T.admin_total_nodes, value: graphStats.total, icon: <Network size={20} color="#16a34a" />, bg: 'bg-green-50 border-green-100' },
                { label: T.admin_clustered, value: graphStats.clustered, icon: <GitBranch size={20} color="#2563eb" />, bg: 'bg-blue-50 border-blue-100' },
                { label: T.admin_escalated, value: graphStats.escalated, icon: <AlertTriangle size={20} color="#dc2626" />, bg: 'bg-red-50 border-red-100' },
              ].map(({ label, value, icon, bg }) => (
                <View key={label} className={`flex-1 rounded-xl border p-4 ${bg}`}>
                  {icon}
                  <Text className="text-3xl font-black mt-2">{value}</Text>
                  <Text className="text-sm font-semibold text-gray-800">{label}</Text>
                </View>
              ))}
            </View>

            {graphStats.hotspots.length > 0 && (
              <View className="bg-white rounded-xl border border-gray-100 p-4">
                <View className="flex-row items-center gap-2 mb-3">
                  <TrendingUp size={18} color="#f97316" />
                  <Text className="font-bold text-gray-900">{T.admin_hotspots}</Text>
                </View>
                {graphStats.hotspots.slice(0, 5).map((h, i) => (
                  <View key={i} className="flex-row items-center gap-3 mb-2">
                    <MapPin size={12} color="#f97316" />
                    <Text className="flex-1 text-sm font-semibold text-gray-700">{h.area}</Text>
                    <Text className="text-sm font-bold text-gray-900">{h.count}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
