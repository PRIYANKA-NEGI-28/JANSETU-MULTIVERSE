import { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { Shield, LogOut, Zap, MapPin, Users, CheckCircle, Clock, AlertTriangle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAllComplaints,
  runEscalationCheck,
  type Neo4jComplaint,
} from '../../lib/neo4j';
import { useLang } from '../../lib/langContext';
import SimpleHeatMap from '../components/SimpleHeatMap';

export default function AdminScreen() {
  const { T } = useLang();
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [complaints, setComplaints] = useState<Neo4jComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [escalating, setEscalating] = useState(false);
  const [escalationResult, setEscalationResult] = useState<string | null>(null);

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
      const complaintsData = await getAllComplaints();
      setComplaints(complaintsData || []);
    } catch (err) {
      console.error('Failed to load complaints:', err);
    }
    setLoading(false);
  }

  async function handleEscalationCheck() {
    setEscalating(true);
    setEscalationResult(null);
    try {
      const result = await runEscalationCheck();
      setEscalationResult(`${T.admin_escalation_done(result.escalated_count)}`);
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
    resolved: complaints.filter(c => c.status === 'RESOLVED').length,
    escalated: complaints.filter(c => c.status === 'ESCALATED').length,
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
    >
      <View className="p-4 pt-8">
        {/* Header */}
        <View className="flex-row justify-between items-start mb-6">
          <View>
            <Text className="text-3xl font-bold text-gray-900">{T.admin_title}</Text>
            <Text className="text-gray-500">{T.admin_subtitle}</Text>
          </View>
          <View className="flex-row items-center gap-3">
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

        {/* Stats Summary */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-gray-900 mb-2">{T.admin_stats_sidebar || 'Quick Stats'}</Text>
          <View className="grid grid-cols-2 gap-4">
            <View className="bg-white rounded-xl border border-gray-100 p-4">
              <Users size={20} color="#3b82f6" className="mb-2" />
              <Text className="text-2xl font-bold text-gray-900">{stats.total}</Text>
              <Text className="text-xs text-gray-500">{T.admin_stat_total || 'Total Complaints'}</Text>
            </View>
            <View className="bg-white rounded-xl border border-gray-100 p-4">
              <CheckCircle size={20} color="#10b981" className="mb-2" />
              <Text className="text-2xl font-bold text-gray-900">{stats.resolved}</Text>
              <Text className="text-xs text-gray-500">{T.admin_stat_resolved || 'Resolved'}</Text>
            </View>
            <View className="bg-white rounded-xl border border-gray-100 p-4">
              <Clock size={20} color="#f59e0b" className="mb-2" />
              <Text className="text-2xl font-bold text-gray-900">{stats.pending}</Text>
              <Text className="text-xs text-gray-500">{T.admin_stat_pending || 'Pending'}</Text>
            </View>
            <View className="bg-white rounded-xl border border-gray-100 p-4">
              <AlertTriangle size={20} color="#ef4444" className="mb-2" />
              <Text className="text-2xl font-bold text-gray-900">{stats.escalated}</Text>
              <Text className="text-xs text-gray-500">{T.admin_stat_escalated || 'Escalated'}</Text>
            </View>
          </View>
        </View>

        {/* Main Focus: Heat Map - Only this should be visible as requested */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900 mb-4">{T.hazard_title}</Text>
          <Text className="text-gray-500 text-center mb-6">
            {T.admin_heatmap_description || 'Real-time complaint distribution and hotspot analysis'}
          </Text>

          {/* Display the heat map - this is the main focus as requested */}
          <SimpleHeatMap complaints={complaints} />
        </View>
      </View>
    </ScrollView>
  );
}