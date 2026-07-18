const PROXY_URL = process.env.EXPO_PUBLIC_NEO4J_PROXY_URL!;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

async function getAuthToken(): Promise<string> {
  return ANON_KEY;
}

async function callProxy<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getAuthToken()}`,
      'Apikey': ANON_KEY,
    },
    body: JSON.stringify({ action, params }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'no body');
    throw new Error(`Proxy error ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data as T;
}

export interface Neo4jComplaint {
  id: string;
  complaint_number: string;
  citizen_name: string;
  citizen_phone?: string;
  raw_text: string;
  language: string;
  issue_type: string;
  summary: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  department: string;
  area: string;
  ward: string;
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED';
  similar_count: number;
  is_cluster_head: boolean;
  created_at: string;
  updated_at: string;
  similar_complaints?: Neo4jComplaint[];
}

export interface Neo4jDepartment {
  id: string;
  name: string;
  total_complaints: number;
  resolved_complaints: number;
  avg_resolution_days: number;
  pending_count: number;
  escalated_count: number;
  trust_score: number;
}

export interface GraphStats {
  total: number;
  clustered: number;
  escalated: number;
  hotspots: Array<{ area: string; count: number }>;
}

export interface Neo4jOfficer {
  id: string;
  name: string;
  rank: string;
  department: string;
  badge_number: string;
  phone?: string;
  ward?: string;
  is_active: boolean;
  created_at: string;
}

function generateComplaintNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `JS-${dateStr}-${rand}`;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function createComplaint(data: {
  citizenName: string;
  citizenPhone: string;
  rawText: string;
  language: string;
  issueType: string;
  summary: string;
  urgency: string;
  department: string;
  area: string;
  ward: string;
  userId?: string;
}): Promise<string> {
  const complaintId = generateId();
  const complaintNumber = generateComplaintNumber();
  const citizenId = data.userId || `anon_${generateId()}`;

  const result = await callProxy<{ complaint_number: string }>('createComplaint', {
    complaintId,
    complaintNumber,
    citizenId,
    citizenName: data.citizenName,
    citizenPhone: data.citizenPhone,
    rawText: data.rawText,
    language: data.language,
    issueType: data.issueType,
    summary: data.summary,
    urgency: data.urgency,
    department: data.department,
    area: data.area,
    ward: data.ward,
    userId: data.userId || '',
  });

  return result.complaint_number;
}

export async function getAllComplaints(): Promise<Neo4jComplaint[]> {
  return callProxy<Neo4jComplaint[]>('getAllComplaints');
}

export async function getComplaintByNumber(complaintNumber: string): Promise<Neo4jComplaint | null> {
  return callProxy<Neo4jComplaint | null>('getComplaintByNumber', { complaint_number: complaintNumber });
}

export async function updateComplaintStatus(id: string, status: string): Promise<void> {
  await callProxy('updateStatus', { id, status });
}

export async function getDepartmentStats(): Promise<Neo4jDepartment[]> {
  return callProxy<Neo4jDepartment[]>('getDepartmentStats');
}

export async function getGraphStats(): Promise<GraphStats> {
  return callProxy<GraphStats>('getGraphStats');
}

export async function runEscalationCheck(): Promise<{ escalated_count: number }> {
  return callProxy<{ escalated_count: number }>('runEscalationCheck');
}

export async function initNeo4jSchema(): Promise<void> {
  await callProxy('initSchema');
  // Also seed officers and departments if needed
  await callProxy('seedOfficers').catch(() => {/* already seeded */});
}

// Officer management functions
export async function createOfficer(data: {
  name: string;
  rank: string;
  department: string;
  badge_number: string;
  phone?: string;
  ward?: string;
}): Promise<{ id: string; badge_number: string }> {
  return callProxy<{ id: string; badge_number: string }>('createOfficer', {
    name: data.name,
    rank: data.rank,
    department: data.department,
    badge_number: data.badge_number,
    phone: data.phone || '',
    ward: data.ward || '',
  });
}

export async function getAllOfficers(): Promise<Neo4jOfficer[]> {
  return callProxy<Neo4jOfficer[]>('getAllOfficers');
}

export async function getOfficersByDepartment(department: string): Promise<Neo4jOfficer[]> {
  return callProxy<Neo4jOfficer[]>('getOfficersByDepartment', { department });
}

export async function assignOfficerToComplaint(complaintId: string, officerId: string): Promise<void> {
  await callProxy('assignOfficer', { complaintId, officerId });
}

export async function escalateComplaintToOfficer(
  complaintId: string,
  escalationOfficerId: string,
  reason?: string
): Promise<void> {
  await callProxy('escalateComplaint', {
    complaintId,
    escalationOfficerId,
    reason: reason || 'SLA breach',
  });
}

export async function getComplaintWithOfficers(complaintNumber: string): Promise<{
  complaint: Neo4jComplaint;
  assigned_officer: Neo4jOfficer | null;
  escalation_officer: Neo4jOfficer | null;
} | null> {
  const result = await callProxy<{
    id: string;
    complaint_number: string;
    citizen_name: string;
    raw_text: string;
    language: string;
    issue_type: string;
    summary: string;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    department: string;
    area: string;
    ward: string;
    status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED';
    similar_count: number;
    is_cluster_head: boolean;
    created_at: string;
    updated_at: string;
    assigned_officer: Neo4jOfficer | null;
    escalation_officer: Neo4jOfficer | null;
  } | null>('getComplaintWithOfficers', { complaint_number: complaintNumber });

  if (!result) return null;

  const { assigned_officer, escalation_officer, ...complaintData } = result;
  return {
    complaint: complaintData as Neo4jComplaint,
    assigned_officer,
    escalation_officer,
  };
}

export async function seedOfficers(): Promise<{ seeded: number }> {
  return callProxy<{ seeded: number }>('seedOfficers');
}
