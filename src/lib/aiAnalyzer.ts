export interface AIAnalysis {
  issue_type: string;
  summary: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  department: string;
  language: 'hi' | 'en';
  risk_tags: string[];
}

const ISSUE_RULES: {
  keywords: string[];
  issue_type: string;
  department: string;
  base_urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}[] = [
  {
    keywords: ['street light', 'light kharab', 'lamp', 'bijli light', 'andhera', 'dark', 'lighting', 'bulb', 'streetlight', 'street-light', 'light not working', 'light band', 'light nhi'],
    issue_type: 'Street Light',
    department: 'Municipal Corporation - Electrical Division',
    base_urgency: 'HIGH',
  },
  {
    keywords: ['pothole', 'road damage', 'road kharab', 'sadak', 'crack', 'broken road', 'gaddha', 'road repair', 'broken road', 'damaged road', 'road khali', 'gaddhe', 'road mein gaddha', 'potholes', 'road surface'],
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
    keywords: ['toilet', 'sanitation', 'shauchalay', 'public toilet', 'hygiene', 'shauchalaya', 'sulabh shauchalay', 'community toilet', 'cleanliness', 'swachhata'],
    issue_type: 'Sanitation',
    department: 'Municipal Corporation - Health & Sanitation',
    base_urgency: 'MEDIUM',
  },
  {
    keywords: ['park', 'garden', 'tree', 'bench', 'playground', 'udyan', 'park mein', 'children park', 'jogging park', 'park maintenance'],
    issue_type: 'Public Park',
    department: 'Municipal Corporation - Parks & Gardens',
    base_urgency: 'LOW',
  },
  {
    keywords: ['hospital', 'health', 'medical', 'doctor', 'medicine', 'hospital mein', 'doctor nahi', 'medical facility', 'health center', 'dispensary', 'primary health', 'treatment', 'clinic'],
    issue_type: 'Healthcare',
    department: 'Health Department / Medical Services',
    base_urgency: 'HIGH',
  },
  {
    keywords: ['bridge', 'flyover', 'underpass', 'construction', 'building', 'pul', 'bridge repair', 'flyover repair', 'underpass water', 'bridge collapse', 'building repair'],
    issue_type: 'Infrastructure',
    department: 'Public Works Department (PWD) - Infrastructure',
    base_urgency: 'HIGH',
  },
  {
    keywords: ['traffic', 'signal', 'jam', 'traffic light', 'accident', 'speed breaker', 'speed breaker lagao', 'traffic signal', 'traffic police', 'road marking', 'zebra crossing', 'traffic jam', 'signal kharab'],
    issue_type: 'Traffic & Road Safety',
    department: 'Traffic Police / Municipal Corporation',
    base_urgency: 'MEDIUM',
  },
  {
    keywords: ['stray', 'dog', 'monkey', 'animal', 'stray dog', 'kutta', 'bandar', 'stray animals', 'dog menace', 'animal attack', 'street dog', 'kutte'],
    issue_type: 'Stray Animals',
    department: 'Municipal Corporation - Veterinary Services',
    base_urgency: 'MEDIUM',
  },
  {
    keywords: ['mosquito', 'dengue', 'malaria', 'fogging', 'machhar', 'mosquito breeding', 'dengue case', 'malaria case', 'insect', 'pest control'],
    issue_type: 'Vector Control',
    department: 'Municipal Corporation - Health Department',
    base_urgency: 'HIGH',
  },
  {
    keywords: ['encroachment', 'illegal', 'occupation', 'zabardasti', 'illegal construction', 'road pe dukan', 'footpath pe', 'encroached', 'illegal shop'],
    issue_type: 'Encroachment',
    department: 'Municipal Corporation - Enforcement',
    base_urgency: 'MEDIUM',
  },
  {
    keywords: ['ration', 'ration card', 'aadhaar', 'document', 'certificate', 'ration dukandar', 'pds', 'public distribution', 'ration shop'],
    issue_type: 'Public Distribution System',
    department: 'Food & Civil Supplies Department',
    base_urgency: 'MEDIUM',
  },
];

const RISK_ESCALATORS = [
  'accident', 'dangerous', 'hazard', 'unsafe', 'death', 'injury', 'fire', 'emergency', 'urgent',
  'critical', 'khatarnak', 'tehlik', 'emergency', 'life threat', 'serious', 'immediate', 'immediate attention',
  'bahut kharab', 'serious problem', 'accident hua', 'injury hui', 'bachche', 'children', 'school',
];

const HINDI_INDICATORS = [
  'hai', 'hain', 'nahi', 'mein', 'ka', 'ke', 'ki', 'se', 'par', 'ko', 'aur', 'kya', 'tha',
  'gaya', 'uthaya', 'kharab', 'bahut', 'se', 'me', 'ka', 'ki', 'ne', 'ko', 'par', 'tak',
  'raha', 'rah', 'de', 'diya', 'liya', 'aata', 'jaata', 'karna', 'karna hai', 'kardo',
];

function detectLanguage(text: string): 'hi' | 'en' {
  const words = text.toLowerCase().split(/\s+/);
  const hindiCount = words.filter(w => HINDI_INDICATORS.includes(w)).length;
  return hindiCount >= 2 ? 'hi' : 'en';
}

function matchIssue(text: string) {
  const lower = text.toLowerCase();

  const matches: { rule: typeof ISSUE_RULES[0]; score: number }[] = [];

  for (const rule of ISSUE_RULES) {
    let matchCount = 0;
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      matches.push({ rule, score: matchCount });
    }
  }

  if (matches.length > 0) {
    matches.sort((a, b) => b.score - a.score);
    return matches[0].rule;
  }

  return {
    issue_type: 'General Complaint',
    department: 'Municipal Corporation - General Administration',
    base_urgency: 'MEDIUM' as const,
  };
}

function extractRiskTags(text: string): string[] {
  const lower = text.toLowerCase();
  return RISK_ESCALATORS.filter(r => lower.includes(r.toLowerCase())).map(r =>
    r.charAt(0).toUpperCase() + r.slice(1)
  );
}

function translateSummary(text: string, issueType: string, lang: 'hi' | 'en'): string {
  if (lang === 'hi') {
    if (issueType === 'Street Light') return 'Street light kaam nahi kar rahi, raat mein area mein andhera hai jo safety concern hai';
    if (issueType === 'Road Damage') return 'Road kharab hai, gaddhe se accident ka khatra hai aur vehicles aur pedestrians ke liye problem hai';
    if (issueType === 'Waste Management') return 'Kachra utaya nahi ja raha, swachhta ki samasya hai aur swasthya par asar pad sakta hai';
    if (issueType === 'Water Supply') return 'Water supply mein dikkat, gharon mein rozana paani nahi aata';
    if (issueType === 'Sewage') return 'Nali jam hai, overflow ho rahi hai jo swasthya ke liye khatarnaak hai';
    if (issueType === 'Electricity Hazard') return 'Bijli ka taar khula hai ya current aa raha hai, turant dhyan dena zaruri hai';
    if (issueType === 'Sanitation') return 'Shauchalay mein saafai nahi hai ya facility kharab hai';
    if (issueType === 'Traffic & Road Safety') return 'Traffic信号 ya road safety ka issue hai jo movement affect kar raha hai';
    if (issueType === 'Stray Animals') return 'Stray animals ki samasya hai jo logon ko pareshan kar rahe hain';
    if (issueType === 'Vector Control') return 'Machhar ya dengue malaria ki samasya hai, fogging zaruri hai';
    return `Nagarik samasya: ${issueType.toLowerCase()} - department ki action zaruri hai`;
  }
  if (text.length > 100) {
    return text.substring(0, 100) + '...';
  }
  return text;
}

export function analyzeComplaint(text: string): AIAnalysis {
  const lang = detectLanguage(text);
  const matched = matchIssue(text);
  const riskTags = extractRiskTags(text);

  let urgency = matched.base_urgency;
  if (riskTags.length >= 2 && urgency !== 'CRITICAL') {
    const levels: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const idx = levels.indexOf(urgency);
    urgency = levels[Math.min(idx + 1, 3)];
  }

  return {
    issue_type: matched.issue_type,
    summary: translateSummary(text, matched.issue_type, lang),
    urgency,
    department: matched.department,
    language: lang,
    risk_tags: riskTags,
  };
}
