export interface Complaint {
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
  photo_url?: string;
  similar_count: number;
  is_cluster_head: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  total_complaints: number;
  resolved_complaints: number;
  avg_resolution_days: number;
  pending_count: number;
  escalated_count: number;
  trust_score: number;
  created_at: string;
}

export type Page = 'home' | 'submit' | 'track' | 'admin' | 'login' | 'hazardmap' | 'rti';
