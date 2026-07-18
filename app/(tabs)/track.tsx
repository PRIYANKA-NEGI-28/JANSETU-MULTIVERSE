import { ScrollView, View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Search, MapPin, Users, Clock, CheckCircle, AlertTriangle,
  ArrowRight, Loader, UserCheck, RefreshCw, GitBranch, ShieldAlert, Network,
} from 'lucide-react-native';
import { useState } from 'react';
import { getComplaintByNumber, type Neo4jComplaint } from '../../lib/neo4j';
import { useLang } from '../../lib/langContext';

const STATUS_CONFIG = {
  PENDING: { labelKey: 'status_pending' as const, color: 'bg-yellow-100', text: 'text-yellow-600', icon: <Clock size={16} color="#ca8a04" /> },
  ASSIGNED: { labelKey: 'status_assigned' as const, color: 'bg-blue-100', text: 'text-blue-600', icon: <UserCheck size={16} color="#2563eb" /> },
  IN_PROGRESS: { labelKey: 'status_in_progress' as const, color: 'bg-teal-100', text: 'text-teal-600', icon: <RefreshCw size={16} color="#0d9488" /> },
  RESOLVED: { labelKey: 'status_resolved' as const, color: 'bg-green-100', text: 'text-green-600', icon: <CheckCircle size={16} color="#16a34a" /> },
  ESCALATED: { labelKey: 'status_escalated' as const, color: 'bg-red-100', text: 'text-red-600', icon: <AlertTriangle size={16} color="#dc2626" /> },
};

const URGENCY_COLORS = {
  LOW: 'bg-blue-100 text-blue-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const STATUS_STEPS = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];

export default function TrackScreen() {
  const { T } = useLang();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [complaint, setComplaint] = useState<Neo4jComplaint | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setNotFound(false);
    setComplaint(null);

    try {
      const data = await getComplaintByNumber(query.trim().toUpperCase());
      if (data) {
        setComplaint(data);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    }
    setLoading(false);
  }

  function getStepIndex(status: string) {
    if (status === 'ESCALATED') return -1;
    return STATUS_STEPS.indexOf(status);
  }

  function buildGraphLines(c: Neo4jComplaint): string[] {
    const lines: string[] = [
      `(:Citizen {${c.citizen_name}})-[:REPORTED]-> (:Complaint {${c.complaint_number}})`,
      `(:Complaint)-[:HAS_TYPE]->(:IssueType {${c.issue_type}})`,
      `(:Complaint)-[:LOCATED_AT]->(:Location {${c.area}, ${c.ward}})`,
      `(:Complaint)-[:ASSIGNED_TO]->(:Department {${c.department}})`,
      `(:Complaint)-[:HAS_STATUS]->(:Status {${c.status}})`,
    ];
    if (c.similar_count > 1) {
      lines.push(`(:Complaint)-[:SIMILAR_TO]->(${c.similar_count - 1} related complaints)`);
    }
    return lines;
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4 pt-8">
        <View className="flex-row items-center gap-2 mb-1">
          <Network size={16} color="#16a34a" />
          <Text className="text-xs font-bold text-green-600 uppercase tracking-widest">{T.track_powered}</Text>
        </View>
        <Text className="text-3xl font-bold text-gray-900 mb-1">{T.track_title}</Text>
        <Text className="text-gray-500 mb-6">{T.track_subtitle}</Text>

        {/* Search */}
        <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <Text className="text-sm font-semibold text-gray-700 mb-3">{T.track_number_label}</Text>
          <View className="flex-row gap-3">
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={T.track_placeholder}
              onSubmitEditing={handleSearch}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono"
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
            />
            <Pressable
              onPress={handleSearch}
              disabled={loading || !query.trim()}
              className={`flex-row items-center gap-2 px-5 py-3 rounded-xl ${loading || !query.trim() ? 'bg-gray-200' : 'bg-orange-500'}`}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Search size={16} color="white" />
              )}
              <Text className="text-white font-semibold">{T.track_search_btn}</Text>
            </Pressable>
          </View>
        </View>

        {/* Not found */}
        {notFound && (
          <View className="bg-white rounded-2xl border border-red-100 p-8 items-center mb-4">
            <AlertTriangle size={40} color="#fca5a5" />
            <Text className="font-bold text-gray-900 text-lg mt-3 mb-2">{T.track_not_found_title}</Text>
            <Text className="text-gray-500 text-sm text-center mb-4">
              {T.track_not_found_msg} "{query}" {T.track_not_found_in}
            </Text>
            <Pressable
              onPress={() => router.push('/submit')}
              className="flex-row items-center gap-2 px-5 py-2.5 bg-orange-500 rounded-xl"
            >
              <ArrowRight size={14} color="white" />
              <Text className="text-white text-sm font-semibold">{T.track_file_new}</Text>
            </Pressable>
          </View>
        )}

        {complaint && (
          <View className="gap-4">
            {/* Header card */}
            <View className="bg-white rounded-2xl border border-gray-100 p-5">
              <View className="flex-row items-start justify-between mb-4">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-xs font-bold text-gray-400 font-mono">{complaint.complaint_number}</Text>
                    <View className={`px-2 py-0.5 rounded-full ${URGENCY_COLORS[complaint.urgency]}`}>
                      <Text className="text-xs font-bold">{complaint.urgency}</Text>
                    </View>
                    {complaint.similar_count > 1 && (
                      <View className="flex-row items-center gap-1 px-2 py-0.5 bg-green-100 rounded-full">
                        <GitBranch size={10} color="#16a34a" />
                        <Text className="text-xs text-green-700 font-semibold">{complaint.similar_count} {T.track_in_cluster}</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xl font-bold text-gray-900">{complaint.issue_type}</Text>
                  <Text className="text-gray-500 text-sm mt-1">{complaint.summary}</Text>
                </View>
                <View className={`flex-row items-center gap-2 px-3 py-2 rounded-xl ${STATUS_CONFIG[complaint.status].color}`}>
                  {STATUS_CONFIG[complaint.status].icon}
                  <Text className={`text-sm font-bold ${STATUS_CONFIG[complaint.status].text}`}>
                    {T[STATUS_CONFIG[complaint.status].labelKey]}
                  </Text>
                </View>
              </View>

              <View className="pt-4 border-t border-gray-100">
                <View className="flex-row flex-wrap gap-4">
                  <View className="flex-1 min-w-[120]">
                    <Text className="text-xs text-gray-400 mb-1 font-medium">{T.track_citizen}</Text>
                    <Text className="text-sm font-semibold text-gray-900">{complaint.citizen_name}</Text>
                  </View>
                  <View className="flex-1 min-w-[120]">
                    <Text className="text-xs text-gray-400 mb-1 font-medium">{T.track_location}</Text>
                    <View className="flex-row items-center gap-1">
                      <MapPin size={11} color="#6b7280" />
                      <Text className="text-sm font-semibold text-gray-900">{complaint.area}</Text>
                    </View>
                  </View>
                  <View className="flex-1 min-w-[120]">
                    <Text className="text-xs text-gray-400 mb-1 font-medium">{T.track_department}</Text>
                    <Text className="text-sm font-semibold text-gray-900">{complaint.department.split(' ')[0]}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Graph Relationships */}
            <View className="bg-white rounded-2xl border border-gray-100 p-5">
              <View className="flex-row items-center gap-2 mb-4">
                <View className="w-9 h-9 rounded-xl bg-gray-900 items-center justify-center">
                  <Network size={18} color="#4ade80" />
                </View>
                <View>
                  <Text className="font-bold text-gray-900 text-sm">{T.track_graph_title}</Text>
                  <Text className="text-xs text-gray-400">{T.track_graph_desc}</Text>
                </View>
              </View>
              <View className="bg-gray-950 rounded-xl p-4">
                {buildGraphLines(complaint).map((line, i) => (
                  <View key={i} className="flex-row items-start gap-3 mb-2">
                    <Text className="text-green-700 text-xs pt-0.5 font-mono">{String(i + 1).padStart(2, '0')}</Text>
                    <Text className="text-green-400 text-sm font-mono flex-1">{line}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Escalation */}
            {complaint.status === 'ESCALATED' && (
              <View className="bg-white rounded-2xl border border-red-200 p-5">
                <View className="flex-row items-center gap-2 mb-4">
                  <View className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center">
                    <ShieldAlert size={18} color="#dc2626" />
                  </View>
                  <View>
                    <Text className="font-bold text-red-700 text-sm">{T.track_escalation_title}</Text>
                    <Text className="text-xs text-gray-400">{T.track_escalation_desc}</Text>
                  </View>
                </View>
                <View className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <Text className="text-sm text-red-700">{T.track_escalation_msg}</Text>
                </View>
              </View>
            )}

            {/* Timeline */}
            <View className="bg-white rounded-2xl border border-gray-100 p-5">
              <Text className="font-bold text-gray-900 mb-4 text-lg">{T.track_timeline_title}</Text>
              {complaint.status === 'ESCALATED' ? (
                <View className="flex-row items-center gap-4 p-4 bg-red-50 border border-red-100 rounded-xl">
                  <View className="w-10 h-10 rounded-full bg-red-500 items-center justify-center">
                    <AlertTriangle size={18} color="white" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-red-700">{T.track_escalated_higher}</Text>
                    <Text className="text-sm text-red-600">{T.track_sla_breach}</Text>
                  </View>
                </View>
              ) : (
                <View>
                  {STATUS_STEPS.map((step, i) => {
                    const stepIdx = getStepIndex(complaint.status);
                    const isCompleted = i <= stepIdx;
                    const isCurrent = i === stepIdx;
                    return (
                      <View key={step} className="flex-row items-start gap-3 mb-4">
                        <View className={`w-8 h-8 rounded-full border-2 items-center justify-center ${
                          isCompleted ? 'border-orange-500 bg-orange-500' : 'border-gray-200 bg-white'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle size={14} color="white" />
                          ) : (
                            <View className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                          )}
                        </View>
                        <View className="flex-1 pt-1">
                          <Text className={`font-bold text-sm ${isCurrent ? 'text-orange-600' : isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                            {T[STATUS_CONFIG[step as keyof typeof STATUS_CONFIG]?.labelKey ?? 'status_pending']}
                          </Text>
                          {isCurrent && (
                            <Text className="text-xs text-gray-500">{T.track_current_status}</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Cluster info */}
            {complaint.similar_count > 1 && (
              <View className="bg-white rounded-2xl border border-indigo-100 p-5">
                <View className="flex-row items-center gap-3 mb-4">
                  <View className="w-10 h-10 rounded-xl bg-indigo-100 items-center justify-center">
                    <Users size={18} color="#6366f1" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-gray-900">{T.track_cluster_title}</Text>
                    <Text className="text-sm text-gray-500">{T.track_cluster_desc}</Text>
                  </View>
                </View>
                <View className="bg-indigo-50 rounded-xl p-5 items-center">
                  <Text className="text-4xl font-black text-indigo-600">{complaint.similar_count}</Text>
                  <Text className="text-sm text-indigo-700 font-medium mt-1">{T.track_citizens_reported}</Text>
                  <Text className="text-xs text-indigo-500 mt-1">{T.track_high_impact}</Text>
                </View>
              </View>
            )}

            {/* Original text */}
            <View className="bg-white rounded-2xl border border-gray-100 p-5">
              <Text className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">{T.track_original}</Text>
              <Text className="text-gray-700 text-sm leading-relaxed italic">"{complaint.raw_text}"</Text>
              <Text className="text-xs text-gray-400 mt-3">
                {T.track_filed_on} {new Date(complaint.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                {complaint.language === 'hi' && (
                  <Text className="ml-2 px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full">{T.track_hindi}</Text>
                )}
              </Text>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
