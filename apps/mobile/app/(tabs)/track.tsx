import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Search,
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  RefreshCw,
  GitBranch,
  Network,
  Wifi,
  WifiOff,
  Radio,
  RotateCcw,
  FileText,
  ChevronLeft,
  Sparkles,
} from 'lucide-react-native';
import { useState, useEffect, useCallback } from 'react';
import {
  getComplaintByTrackingCode,
  getUserComplaints,
  type ComplaintDto,
} from '../../src/lib/api-client';
import { useLang } from '../../src/contexts/LanguageContext';
import {
  useOfflineSync,
  useAblyTracking,
} from '../../src/offline';

const STATUS_CONFIG: Record<
  string,
  { labelKey: string; color: string; text: string; icon: JSX.Element }
> = {
  PENDING: {
    labelKey: 'status_pending',
    color: 'bg-yellow-100',
    text: 'text-yellow-700',
    icon: <Clock size={15} color="#ca8a04" />,
  },
  TRIAGED: {
    labelKey: 'status_in_progress',
    color: 'bg-indigo-100',
    text: 'text-indigo-700',
    icon: <Sparkles size={15} color="#6366f1" />,
  },
  ASSIGNED: {
    labelKey: 'status_assigned',
    color: 'bg-blue-100',
    text: 'text-blue-700',
    icon: <UserCheck size={15} color="#2563eb" />,
  },
  IN_PROGRESS: {
    labelKey: 'status_in_progress',
    color: 'bg-teal-100',
    text: 'text-teal-700',
    icon: <RefreshCw size={15} color="#0d9488" />,
  },
  RESOLVED: {
    labelKey: 'status_resolved',
    color: 'bg-green-100',
    text: 'text-green-700',
    icon: <CheckCircle size={15} color="#16a34a" />,
  },
  ESCALATED: {
    labelKey: 'status_escalated',
    color: 'bg-red-100',
    text: 'text-red-700',
    icon: <AlertTriangle size={15} color="#dc2626" />,
  },
  REOPENED: {
    labelKey: 'status_in_progress',
    color: 'bg-purple-100',
    text: 'text-purple-700',
    icon: <RefreshCw size={15} color="#9333ea" />,
  },
};

const URGENCY_STYLES: Record<string, string> = {
  LOW: 'bg-blue-100 text-blue-700 border-blue-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
};

const LIFECYCLE_STEPS = [
  { key: 'PENDING', label: 'Reported' },
  { key: 'TRIAGED', label: 'AI Triaged' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'RESOLVED', label: 'Resolved' },
];

export default function TrackScreen() {
  const { T } = useLang();
  const router = useRouter();

  const {
    isOnline,
    outboxItems,
    pendingCount,
    cachedComplaints,
    syncNow,
    retryItem,
    isSyncing,
    refreshOutbox,
    refreshCache,
  } = useOfflineSync();

  const [query, setQuery] = useState('');
  const [complaint, setComplaint] = useState<ComplaintDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [remoteComplaints, setRemoteComplaints] = useState<readonly ComplaintDto[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active tracking code for Ably live subscription
  const activeTrackingCode = complaint?.trackingCode || complaint?.complaint_number || '';

  const { isConnected: isAblyConnected, isPollingFallback, refresh: refreshActiveComplaint } =
    useAblyTracking({
      trackingCode: activeTrackingCode,
      enabled: Boolean(activeTrackingCode),
      onComplaintRefreshed: (updated) => setComplaint(updated),
    });

  // Load complaints list (cached + remote)
  const fetchComplaints = useCallback(async () => {
    await refreshCache();
    await refreshOutbox();

    if (isOnline) {
      try {
        const remote = await getUserComplaints();
        setRemoteComplaints(remote);
      } catch {
        // Fall back to cached complaints
      }
    }
  }, [isOnline, refreshCache, refreshOutbox]);

  useEffect(() => {
    void fetchComplaints();
  }, [fetchComplaints]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (complaint && activeTrackingCode) {
        const updated = await refreshActiveComplaint();
        if (updated) setComplaint(updated);
      }
      await fetchComplaints();
      await syncNow();
    } finally {
      setIsRefreshing(false);
    }
  }, [complaint, activeTrackingCode, refreshActiveComplaint, fetchComplaints, syncNow]);

  // Search by code
  async function handleSearch(codeToSearch = query) {
    const clean = codeToSearch.trim().toUpperCase();
    if (!clean) return;

    setLoading(true);
    setNotFound(false);

    try {
      // 1. Check local cache first
      const localMatch = cachedComplaints.find(
        (c) => c.trackingCode?.toUpperCase() === clean || c.id?.toUpperCase() === clean
      );
      if (localMatch) {
        setComplaint(localMatch);
        setLoading(false);
        return;
      }

      // 2. Fetch from backend if online
      const remoteMatch = await getComplaintByTrackingCode(clean);
      if (remoteMatch) {
        setComplaint(remoteMatch);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  function getLifecycleIndex(status: string): number {
    if (status === 'ESCALATED') return -1;
    const match = LIFECYCLE_STEPS.findIndex((s) => s.key === status);
    if (match >= 0) return match;
    if (status === 'ASSIGNED') return 2;
    if (status === 'IN_PROGRESS') return 3;
    if (status === 'RESOLVED') return 4;
    return 0;
  }

  // Combined list of complaints (deduped by trackingCode)
  const allDisplayComplaints = (() => {
    const map = new Map<string, ComplaintDto>();
    for (const c of cachedComplaints) {
      const code = c.trackingCode || c.id;
      if (code) map.set(code, c);
    }
    for (const c of remoteComplaints) {
      const code = c.trackingCode || c.id;
      if (code) map.set(code, c);
    }
    return Array.from(map.values()).sort((a, b) => {
      const dateA = a.createdAt || a.created_at || '';
      const dateB = b.createdAt || b.created_at || '';
      return dateB.localeCompare(dateA);
    });
  })();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#f97316']} />
        }
      >
        {/* Top Header Bar */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <View className="flex-row items-center gap-1.5 mb-1">
              <Network size={16} color="#16a34a" />
              <Text className="text-xs font-bold text-green-600 uppercase tracking-widest">
                {T.track_powered || 'Civic Intelligence'}
              </Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900">
              {complaint ? 'Live Grievance Tracking' : 'My Grievances & Tracking'}
            </Text>
          </View>

          {/* Network / Socket State Badge */}
          <View className="flex-row items-center gap-2">
            {complaint && activeTrackingCode ? (
              <View
                className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                  isAblyConnected
                    ? 'bg-emerald-50 border-emerald-200'
                    : isPollingFallback
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-100 border-gray-200'
                }`}
              >
                <Radio size={12} color={isAblyConnected ? '#059669' : '#2563eb'} />
                <Text
                  className={`text-xs font-bold ${
                    isAblyConnected
                      ? 'text-emerald-700'
                      : isPollingFallback
                      ? 'text-blue-700'
                      : 'text-gray-600'
                  }`}
                >
                  {isAblyConnected ? 'Live Socket' : 'Polling'}
                </Text>
              </View>
            ) : (
              <View
                className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                  isOnline
                    ? 'bg-green-50 border-green-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                {isOnline ? (
                  <>
                    <Wifi size={12} color="#16a34a" />
                    <Text className="text-xs font-bold text-green-700">Online</Text>
                  </>
                ) : (
                  <>
                    <WifiOff size={12} color="#d97706" />
                    <Text className="text-xs font-bold text-amber-800">Offline</Text>
                  </>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Offline Outbox Queue Status Card */}
        {outboxItems.length > 0 && (
          <View className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-full bg-amber-100 items-center justify-center">
                  <Clock size={16} color="#d97706" />
                </View>
                <View>
                  <Text className="font-bold text-gray-900 text-sm">
                    Offline Outbox Queue ({outboxItems.length})
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {pendingCount > 0
                      ? `${pendingCount} item(s) waiting for auto-sync`
                      : 'All queued items processed'}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => void syncNow(true)}
                disabled={isSyncing}
                className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl ${
                  isSyncing ? 'bg-gray-100' : 'bg-amber-500 active:bg-amber-600'
                }`}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#d97706" />
                ) : (
                  <RotateCcw size={12} color="white" />
                )}
                <Text className={`text-xs font-bold ${isSyncing ? 'text-gray-400' : 'text-white'}`}>
                  {isSyncing ? 'Syncing...' : 'Sync Queue'}
                </Text>
              </Pressable>
            </View>

            <View className="gap-2">
              {outboxItems.map((item) => (
                <View
                  key={item.idempotencyKey}
                  className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex-row items-center justify-between"
                >
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-xs font-mono font-bold text-gray-500">
                        {item.idempotencyKey.slice(0, 10)}...
                      </Text>
                      <View
                        className={`px-2 py-0.5 rounded-full ${
                          item.syncStatus === 'SYNCED'
                            ? 'bg-green-100'
                            : item.syncStatus === 'SYNCING'
                            ? 'bg-blue-100'
                            : item.syncStatus === 'FAILED'
                            ? 'bg-red-100'
                            : 'bg-yellow-100'
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-bold ${
                            item.syncStatus === 'SYNCED'
                              ? 'text-green-800'
                              : item.syncStatus === 'SYNCING'
                              ? 'text-blue-800'
                              : item.syncStatus === 'FAILED'
                              ? 'text-red-800'
                              : 'text-yellow-800'
                          }`}
                        >
                          {item.syncStatus}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                      {item.payload.issueType} — {item.payload.area}
                    </Text>
                    {item.lastError && (
                      <Text className="text-[11px] text-red-600 mt-0.5" numberOfLines={1}>
                        Error: {item.lastError} (Attempt {item.retryCount}/5)
                      </Text>
                    )}
                  </View>

                  {item.syncStatus === 'FAILED' && (
                    <Pressable
                      onPress={() => void retryItem(item.idempotencyKey)}
                      className="px-2.5 py-1 bg-red-100 rounded-lg active:bg-red-200"
                    >
                      <Text className="text-xs font-bold text-red-700">Retry</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Detail View of a Selected Complaint */}
        {complaint ? (
          <View className="gap-4">
            {/* Back Button */}
            <Pressable
              onPress={() => setComplaint(null)}
              className="flex-row items-center gap-1.5 py-1"
            >
              <ChevronLeft size={16} color="#f97316" />
              <Text className="text-sm font-bold text-orange-600">Back to All Grievances</Text>
            </Pressable>

            {/* Header Card */}
            <View className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center gap-2 mb-1.5 flex-wrap">
                    <Text className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                      {complaint.trackingCode || complaint.complaint_number || complaint.id}
                    </Text>
                    <View
                      className={`px-2 py-0.5 rounded-full border ${
                        URGENCY_STYLES[complaint.urgency] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <Text className="text-xs font-bold">{complaint.urgency}</Text>
                    </View>
                    {(complaint.similar_count ?? 1) > 1 && (
                      <View className="flex-row items-center gap-1 px-2 py-0.5 bg-green-100 rounded-full">
                        <GitBranch size={10} color="#16a34a" />
                        <Text className="text-xs text-green-700 font-semibold">
                          {complaint.similar_count} in cluster
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-lg font-bold text-gray-900">
                    {complaint.category || complaint.issue_type || 'Civic Grievance'}
                  </Text>
                  <Text className="text-gray-500 text-sm mt-1 leading-snug">
                    {complaint.summary || complaint.description}
                  </Text>
                </View>

                {(() => {
                  const cfg = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.PENDING;
                  return (
                    <View className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl ${cfg.color}`}>
                      {cfg.icon}
                      <Text className={`text-xs font-bold ${cfg.text}`}>{complaint.status}</Text>
                    </View>
                  );
                })()}
              </View>

              <View className="pt-3 border-t border-gray-100 flex-row flex-wrap gap-4">
                <View className="min-w-[100]">
                  <Text className="text-xs text-gray-400 mb-0.5 font-medium">Citizen</Text>
                  <Text className="text-xs font-semibold text-gray-800">
                    {complaint.citizen_name || 'Verified Citizen'}
                  </Text>
                </View>
                <View className="min-w-[120]">
                  <Text className="text-xs text-gray-400 mb-0.5 font-medium">Location</Text>
                  <View className="flex-row items-center gap-1">
                    <MapPin size={11} color="#6b7280" />
                    <Text className="text-xs font-semibold text-gray-800">
                      {complaint.area || complaint.ward || 'Delhi NCR'}
                    </Text>
                  </View>
                </View>
                <View className="min-w-[100]">
                  <Text className="text-xs text-gray-400 mb-0.5 font-medium">SLA Target</Text>
                  <Text className="text-xs font-semibold text-orange-600">
                    {new Date(complaint.slaDueAt || Date.now() + 48 * 3600 * 1000).toLocaleDateString(
                      'en-IN',
                      { day: 'numeric', month: 'short' }
                    )}
                  </Text>
                </View>
              </View>
            </View>

            {/* Lifecycle Timeline */}
            <View className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <Text className="font-bold text-gray-900 mb-4 text-base">Grievance Lifecycle Timeline</Text>

              {complaint.status === 'ESCALATED' ? (
                <View className="flex-row items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <View className="w-10 h-10 rounded-full bg-red-500 items-center justify-center">
                    <AlertTriangle size={20} color="white" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-red-800 text-sm">Escalated to Vigilance</Text>
                    <Text className="text-xs text-red-600 mt-0.5">
                      Statutory SLA breached (over 48h). Forwarded to Department Commissioner.
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="gap-4">
                  {LIFECYCLE_STEPS.map((step, idx) => {
                    const currentIdx = getLifecycleIndex(complaint.status);
                    const isCompleted = idx <= currentIdx;
                    const isCurrent = idx === currentIdx;

                    return (
                      <View key={step.key} className="flex-row items-start gap-3">
                        <View
                          className={`w-7 h-7 rounded-full border-2 items-center justify-center ${
                            isCurrent
                              ? 'border-orange-500 bg-orange-500'
                              : isCompleted
                              ? 'border-green-600 bg-green-600'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle size={13} color="white" />
                          ) : (
                            <View className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                          )}
                        </View>
                        <View className="flex-1 pt-0.5">
                          <Text
                            className={`font-bold text-sm ${
                              isCurrent
                                ? 'text-orange-600'
                                : isCompleted
                                ? 'text-gray-900'
                                : 'text-gray-400'
                            }`}
                          >
                            {step.label}
                          </Text>
                          {isCurrent && (
                            <Text className="text-xs text-orange-500 mt-0.5 font-medium">
                              Current Stage — Live Updates Subscribed
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Evidence Photo */}
            {complaint.photoUrl && (
              <View className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <Text className="font-bold text-gray-900 mb-3 text-sm">Submitted Evidence</Text>
                <Image
                  source={{ uri: complaint.photoUrl }}
                  className="w-full h-48 rounded-xl bg-gray-100"
                  resizeMode="cover"
                />
              </View>
            )}

            {/* Original Citizen Narrative */}
            <View className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Original Citizen Text
              </Text>
              <Text className="text-gray-800 text-sm leading-relaxed italic bg-gray-50 p-3 rounded-xl border border-gray-100">
                "{complaint.description || complaint.raw_text || complaint.summary}"
              </Text>
            </View>
          </View>
        ) : (
          /* Search & Complaints Overview */
          <View className="gap-4">
            {/* Search Bar */}
            <View className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Track by Grievance Number
              </Text>
              <View className="flex-row gap-2">
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="e.g. JS-2026-DEL-1049"
                  onSubmitEditing={() => void handleSearch()}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono bg-white"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="characters"
                />
                <Pressable
                  onPress={() => void handleSearch()}
                  disabled={loading || !query.trim()}
                  className={`flex-row items-center gap-1.5 px-4 py-2.5 rounded-xl ${
                    loading || !query.trim() ? 'bg-gray-200' : 'bg-orange-500 active:bg-orange-600'
                  }`}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Search size={16} color="white" />
                  )}
                  <Text className="text-white text-sm font-bold">Search</Text>
                </Pressable>
              </View>
            </View>

            {/* Not Found Banner */}
            {notFound && (
              <View className="bg-white rounded-2xl border border-red-100 p-6 items-center shadow-sm">
                <AlertTriangle size={36} color="#f87171" />
                <Text className="font-bold text-gray-900 text-base mt-2 mb-1">Grievance Not Found</Text>
                <Text className="text-gray-500 text-xs text-center mb-4 leading-relaxed">
                  No record matched "{query}". Check the number or file a new grievance.
                </Text>
                <Pressable
                  onPress={() => router.push('/submit')}
                  className="flex-row items-center gap-2 px-4 py-2 bg-orange-500 rounded-xl active:bg-orange-600"
                >
                  <ArrowRight size={14} color="white" />
                  <Text className="text-white text-xs font-bold">File New Grievance</Text>
                </Pressable>
              </View>
            )}

            {/* My Submitted Grievances List */}
            <View>
              <View className="flex-row items-center justify-between mb-3 px-1">
                <Text className="text-base font-bold text-gray-900">
                  My Complaints ({allDisplayComplaints.length})
                </Text>
                <Pressable onPress={() => void onRefresh()} className="p-1">
                  <RefreshCw size={14} color="#f97316" />
                </Pressable>
              </View>

              {allDisplayComplaints.length === 0 ? (
                <View className="bg-white rounded-2xl border border-gray-100 p-8 items-center shadow-sm">
                  <FileText size={40} color="#d1d5db" />
                  <Text className="font-bold text-gray-800 text-base mt-3 mb-1">
                    No Grievances Filed Yet
                  </Text>
                  <Text className="text-gray-500 text-xs text-center mb-4">
                    Grievances filed online or offline will appear here with live tracking.
                  </Text>
                  <Pressable
                    onPress={() => router.push('/submit')}
                    className="flex-row items-center gap-1.5 px-5 py-2.5 bg-orange-500 rounded-xl active:bg-orange-600"
                  >
                    <ArrowRight size={14} color="white" />
                    <Text className="text-white text-sm font-bold">Report an Issue</Text>
                  </Pressable>
                </View>
              ) : (
                <View className="gap-3">
                  {allDisplayComplaints.map((item) => {
                    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
                    const code = item.trackingCode || item.complaint_number || item.id;
                    return (
                      <Pressable
                        key={item.id || code}
                        onPress={() => setComplaint(item)}
                        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm active:bg-gray-50"
                      >
                        <View className="flex-row items-start justify-between mb-2">
                          <View className="flex-1 pr-2">
                            <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                              <Text className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                {code}
                              </Text>
                              <View
                                className={`px-2 py-0.5 rounded-full border ${
                                  URGENCY_STYLES[item.urgency] || 'bg-gray-100'
                                }`}
                              >
                                <Text className="text-[10px] font-bold">{item.urgency}</Text>
                              </View>
                            </View>
                            <Text className="font-bold text-gray-900 text-sm" numberOfLines={1}>
                              {item.category || item.issue_type || 'Civic Issue'}
                            </Text>
                          </View>

                          <View className={`flex-row items-center gap-1 px-2.5 py-1 rounded-xl ${cfg.color}`}>
                            {cfg.icon}
                            <Text className={`text-xs font-bold ${cfg.text}`}>{item.status}</Text>
                          </View>
                        </View>

                        <Text className="text-xs text-gray-600 leading-snug mb-2" numberOfLines={2}>
                          {item.summary || item.description}
                        </Text>

                        <View className="flex-row items-center justify-between pt-2 border-t border-gray-50">
                          <View className="flex-row items-center gap-1">
                            <MapPin size={12} color="#9ca3af" />
                            <Text className="text-xs text-gray-500">
                              {item.area || item.ward || 'Delhi NCR'}
                            </Text>
                          </View>
                          <Text className="text-[11px] font-bold text-orange-600">
                            Track Live →
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
