import { Hono } from 'hono';
import {
  COMPLAINT_CATEGORIES,
  DEPARTMENTS,
  BASE_SLA_BY_URGENCY,
  CATEGORY_SLA_OVERRIDES,
  type ComplaintCategory,
  type DepartmentName,
  type SlaPolicy,
  type UrgencyLevel,
} from '@jansetu/shared';
import type { AppEnv } from '../types/index.js';
import { createCacheService } from '../services/cache.js';
import { getComplaintStore } from '../services/complaint-store.js';

export const metaRoute = new Hono<AppEnv>();

export interface DepartmentMetaItem {
  readonly id: string;
  readonly code: string;
  readonly nameEn: DepartmentName;
  readonly nameHi: string;
  readonly defaultSlaHours: number;
}

export interface MetaResponse {
  readonly departments: readonly DepartmentMetaItem[];
  readonly categories: readonly ComplaintCategory[];
  readonly slaPolicies: {
    readonly baseByUrgency: Readonly<Record<UrgencyLevel, SlaPolicy>>;
    readonly categoryOverrides: Partial<Record<ComplaintCategory, SlaPolicy>>;
  };
  readonly timestamp: string;
}

const HINDI_DEPT_NAMES: Readonly<Record<DepartmentName, string>> = {
  'Municipal Corporation - Electrical Division': 'नगर निगम - विद्युत प्रभाग',
  'Public Works Department (PWD)': 'लोक निर्माण विभाग (पीडब्ल्यूडी)',
  'Municipal Corporation - Sanitation Department': 'नगर निगम - स्वच्छता विभाग',
  'Delhi Jal Board / Water Supply Department': 'दिल्ली जल बोर्ड / जल आपूर्ति विभाग',
  'Municipal Corporation - Sewerage Division': 'नगर निगम - सीवरेज प्रभाग',
  'Electricity Distribution Company (DISCOM)': 'विद्युत वितरण कंपनी (डिस्कॉम)',
  'Municipal Corporation - Health & Sanitation': 'नगर निगम - स्वास्थ्य एवं स्वच्छता',
  'Municipal Corporation - Horticulture Department': 'नगर निगम - उद्यान विभाग',
  'Traffic Police / Transport Department': 'यायात पुलिस / परिवहन विभाग',
  'Delhi Pollution Control Committee (DPCC) / Environment': 'दिल्ली प्रदूषण नियंत्रण समिति (डीपीसीसी)',
  'Delhi Police / Local Law Enforcement': 'दिल्ली पुलिस / स्थानीय कानून प्रवर्तन',
  'Municipal Corporation - Revenue & Estate': 'नगर निगम - राजस्व एवं संपदा',
  'Animal Welfare Board / Veterinary Department': 'पशु कल्याण बोर्ड / पशु चिकित्सा विभाग',
  'Municipal Corporation - Building & Housing': 'नगर निगम - भवन एवं आवास',
  'Fire Services / Disaster Management': 'अग्निशमन सेवाएं / आपदा प्रबंधन',
  'Municipal Corporation - General Administration': 'नगर निगम - सामान्य प्रशासन',
};

function generateDepartmentCode(dept: DepartmentName): string {
  const words = dept.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 3).map((w) => w[0]?.toUpperCase()).join('');
  return initials.padEnd(3, 'X');
}

export const CACHE_KEY_META = 'jansetu:meta:v1:civic';
export const CACHE_TTL_SECONDS = 3600; // 1 hour

metaRoute.get('/meta', async (c) => {
  const env = c.get('env');
  const cache = createCacheService(env);

  const cached = await cache.get<MetaResponse>(CACHE_KEY_META);
  if (cached) {
    c.header('X-Cache', 'HIT');
    return c.json(cached, 200);
  }

  const departmentItems: DepartmentMetaItem[] = DEPARTMENTS.map((name, index) => ({
    id: `dept-${String(index + 1).padStart(3, '0')}`,
    code: generateDepartmentCode(name),
    nameEn: name,
    nameHi: HINDI_DEPT_NAMES[name] ?? name,
    defaultSlaHours: name.includes('Fire') || name.includes('Electrical') ? 12 : 48,
  }));

  const responsePayload: MetaResponse = {
    departments: departmentItems,
    categories: COMPLAINT_CATEGORIES,
    slaPolicies: {
      baseByUrgency: BASE_SLA_BY_URGENCY,
      categoryOverrides: CATEGORY_SLA_OVERRIDES,
    },
    timestamp: new Date().toISOString(),
  };

  await cache.set(CACHE_KEY_META, responsePayload, CACHE_TTL_SECONDS);

  c.header('X-Cache', 'MISS');
  return c.json(responsePayload, 200);
});

async function handleStats(c: import('hono').Context<AppEnv>) {
  const store = getComplaintStore();
  const analytics = await store.getAnalytics();
  return c.json(
    {
      totalComplaints: analytics.totalComplaints,
      resolvedComplaints: analytics.resolvedComplaints,
      activeComplaints: analytics.activeComplaints,
      totalClusters: analytics.totalClusters,
      complaints: {
        total: analytics.totalComplaints,
        resolved: analytics.resolvedComplaints,
        pending: analytics.statusBreakdown.PENDING ?? 0,
        escalated: analytics.statusBreakdown.ESCALATED ?? 0,
      },
      clusters: {
        total: analytics.totalClusters,
        active: analytics.totalClusters,
      },
      timestamp: new Date().toISOString(),
    },
    200
  );
}

metaRoute.get('/stats', handleStats);
metaRoute.get('/meta/stats', handleStats);
