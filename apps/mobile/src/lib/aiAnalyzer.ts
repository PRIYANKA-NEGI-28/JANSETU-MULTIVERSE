import type { UrgencyLevel } from '@jansetu/shared';

export interface AIAnalysis {
  readonly issue_type: string;
  readonly summary: string;
  readonly urgency: UrgencyLevel;
  readonly department: string;
  readonly language: 'hi' | 'en';
  readonly risk_tags: readonly string[];
}

interface IssueRule {
  readonly keywords: readonly string[];
  readonly issue_type: string;
  readonly department: string;
  readonly base_urgency: UrgencyLevel;
}

const ISSUE_RULES: readonly IssueRule[] = [
  {
    keywords: ['street light', 'light kharab', 'lamp', 'bijli light', 'andhera', 'dark', 'lighting', 'bulb', 'streetlight', 'street-light', 'light not working', 'light band', 'light nhi'],
    issue_type: 'Street Light',
    department: 'Municipal Corporation - Electrical Division',
    base_urgency: 'HIGH',
  },
  {
    keywords: ['pothole', 'road damage', 'road kharab', 'sadak', 'crack', 'broken road', 'gaddha', 'road repair', 'damaged road', 'road khali', 'gaddhe', 'road mein gaddha', 'potholes', 'road surface'],
    issue_type: 'Road Damage',
    department: 'Public Works Department (PWD)',
    base_urgency: 'HIGH',
  },
  {
    keywords: ['garbage', 'kachra', 'waste', 'trash', 'dump', 'safai', 'clean', 'kachra uta', 'garbage collection', 'kachra nahi', 'nikasi nahi', 'dustbin', 'garbage dump', 'raddi', 'kooda', 'solid waste'],
    issue_type: 'Waste Management',
    department: 'Municipal Corporation - Sanitation Department',
    base_urgency: 'MEDIUM',
  },
  {
    keywords: ['water', 'paani', 'supply band', 'no water', 'pani nahi', 'leakage', 'pipe', 'water supply', 'pani aata', 'pani nahi aata', 'water pipeline', 'pani ka pipeline', 'water leakage', 'tanker', 'pani ki samasya', 'drinking water', 'water problem', 'water connection'],
    issue_type: 'Water Supply',
    department: 'Delhi Jal Board / Water Supply Department',
    base_urgency: 'HIGH',
  },
  {
    keywords: ['sewage', 'drainage', 'nali', 'overflow', 'drain block', 'sewer', 'nali jam', 'sewer line', 'gutter block', 'sewerage', 'drainage block', 'nali ka jam', 'nali overflow', 'underground sewer'],
    issue_type: 'Sewage',
    department: 'Municipal Corporation - Sewerage Division',
    base_urgency: 'CRITICAL',
  },
  {
    keywords: ['electricity', 'bijli', 'wire', 'current', 'power cut', 'transformer', 'electric', 'bijli ka taar', 'hanging wire', 'live wire', 'electric pole', 'bijli girna', 'shock', 'danger wire', 'power supply', 'bijli nahi', 'power failure', 'electric supply'],
    issue_type: 'Electricity Hazard',
    department: 'Electricity Distribution Company (DISCOM)',
    base_urgency: 'CRITICAL',
  },
  {
    keywords: ['sanitation', 'cleanliness', 'dirty', 'bad smell', 'badboo', 'toilet', 'public toilet', 'cleaning', 'stagnant water', 'mosquito', 'dengue', 'hygiene', 'health hazard', 'gandagi'],
    issue_type: 'Sanitation',
    department: 'Municipal Corporation - Health & Sanitation',
    base_urgency: 'HIGH',
  },
  {
    keywords: ['traffic', 'jam', 'signal', 'red light', 'traffic light', 'congestion', 'challan', 'crossing', 'zebra crossing', 'parking', 'illegal parking'],
    issue_type: 'Traffic & Transport',
    department: 'Traffic Police / Transport Department',
    base_urgency: 'MEDIUM',
  },
  {
    keywords: ['encroachment', 'kabza', 'footpath block', 'illegal shop', 'hawker', 'thela', 'pathway blocked', 'illegal construction', 'unauthorized', 'pedestrian'],
    issue_type: 'Encroachment',
    department: 'Municipal Corporation - Encroachment Cell',
    base_urgency: 'MEDIUM',
  },
  {
    keywords: ['park', 'tree', 'fallen tree', 'ped gir gaya', 'garden', 'grass', 'maintenance', 'playground', 'green belt', 'horticulture', 'branch fallen'],
    issue_type: 'Horticulture & Parks',
    department: 'Horticulture Department',
    base_urgency: 'LOW',
  },
  {
    keywords: ['stray animal', 'dog', 'kutta', 'monkey', 'cow', 'cattle', 'bandar', 'dog bite', 'rabies', 'animal menace', 'stray dogs'],
    issue_type: 'Stray Animals',
    department: 'Veterinary Services / Animal Control',
    base_urgency: 'HIGH',
  },
  {
    keywords: ['pollution', 'smoke', 'dhuaan', 'burning garbage', 'air quality', 'dust', 'construction dust', 'aqi', 'air pollution', 'noise', 'sound pollution', 'loudspeaker'],
    issue_type: 'Pollution & Environment',
    department: 'Pollution Control Board',
    base_urgency: 'HIGH',
  },
  {
    keywords: ['building', 'illegal building', 'crack in building', 'collapse risk', 'danger building', 'unsafe structure', 'demolition', 'unauthorized floor'],
    issue_type: 'Building Safety',
    department: 'Building Department / Disaster Management',
    base_urgency: 'CRITICAL',
  },
  {
    keywords: ['fire', 'aag', 'cylinder', 'gas leak', 'fire safety', 'no extinguisher', 'fire hazard', 'flame', 'spark'],
    issue_type: 'Fire Safety',
    department: 'Fire Services Department',
    base_urgency: 'CRITICAL',
  },
  {
    keywords: ['health', 'hospital', 'dispensary', 'doctor', 'medicine', 'clinic', 'mohalla clinic', 'ambulance', 'emergency health', 'dawa'],
    issue_type: 'Public Health',
    department: 'Directorate of Health Services',
    base_urgency: 'CRITICAL',
  },
];

const CRITICAL_KEYWORDS: readonly string[] = [
  'accident', 'death', 'injury', 'blood', 'fatal', 'ghayal', 'mrit', 'chot',
  'hospital', 'emergency', 'danger', 'khatra', 'khun', 'risk to life',
  'child', 'baccha', 'elderly', 'senior citizen', 'woman', 'mahila',
  'near school', 'school ke pas', 'near hospital', 'crowded', 'bheed',
  'collapse', 'gir gaya', 'spark', 'current lag gaya', 'short circuit',
  'drowning', 'doob', 'cylinder blast', 'gas leak',
];

const HIGH_KEYWORDS: readonly string[] = [
  'urgent', 'immediate', 'jaldi', 'turant', 'severe', 'major', 'heavy',
  'completely blocked', 'poora band', 'all lights out', 'no water 3 days',
  '3 din se', 'week', 'hafta', 'spreading', 'overflowing on road',
  'foul smell', 'school', 'hospital', 'bus stop', 'metro station',
];

function detectLanguage(text: string): 'hi' | 'en' {
  const hindiChars = /[\u0900-\u097F]/;
  const hindiWords = ['hai', 'ke', 'ka', 'ki', 'ko', 'se', 'mein', 'par', 'yeh', 'woh', 'bhi', 'aur', 'nahi', 'karo', 'gaya', 'raha', 'rahe', 'karna', 'kripya'];
  if (hindiChars.test(text)) return 'hi';
  const lower = text.toLowerCase();
  const tokens = lower.split(/\s+/);
  const matchCount = tokens.filter(t => hindiWords.includes(t)).length;
  return matchCount >= 2 ? 'hi' : 'en';
}

export function analyzeComplaint(text: string): AIAnalysis {
  const lower = text.toLowerCase();
  const lang = detectLanguage(text);

  let bestMatch: IssueRule | null = null;
  let maxScore = 0;

  for (const rule of ISSUE_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        score += kw.split(' ').length * 2;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = rule;
    }
  }

  const selectedRule: IssueRule = bestMatch ?? {
    keywords: [],
    issue_type: 'General Civic Issue',
    department: 'Municipal Corporation - Public Grievance Cell',
    base_urgency: 'MEDIUM',
  };

  const riskTags: string[] = [];
  let urgency: UrgencyLevel = selectedRule.base_urgency;

  for (const ckw of CRITICAL_KEYWORDS) {
    if (lower.includes(ckw)) {
      riskTags.push(ckw);
      urgency = 'CRITICAL';
    }
  }

  if (urgency !== 'CRITICAL') {
    for (const hkw of HIGH_KEYWORDS) {
      if (lower.includes(hkw)) {
        riskTags.push(hkw);
        if (urgency === 'LOW' || urgency === 'MEDIUM') {
          urgency = 'HIGH';
        }
      }
    }
  }

  const words = text.trim().split(/\s+/);
  const summary = words.length > 15 ? words.slice(0, 15).join(' ') + '...' : text.trim();

  return {
    issue_type: selectedRule.issue_type,
    summary,
    urgency,
    department: selectedRule.department,
    language: lang,
    risk_tags: riskTags.slice(0, 4),
  };
}
