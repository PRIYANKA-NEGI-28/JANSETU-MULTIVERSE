import {
  getDatabase,
  rtiApplications as rtiTable,
  eq,
} from '@jansetu/db';
import type { ValidatedEnv } from '../config/env.js';
import { getComplaintStore } from './complaint-store.js';

export interface RtiApplicationEntity {
  readonly id: string;
  readonly citizenId: string | null;
  readonly clusterId?: string | null;
  readonly applicantName: string;
  readonly fatherOrSpouseName?: string | null;
  readonly address: string;
  readonly contactNumber: string;
  readonly email?: string | null;
  readonly bplCardNo?: string | null;
  readonly bplYear?: string | null;
  readonly authorityName: string;
  readonly publicAuthorityAddress?: string | null;
  readonly subject: string;
  readonly description: string;
  readonly specificQuestions: string[];
  readonly englishDraft: string;
  readonly hindiDraft: string;
  readonly isBplExempt: boolean;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateRtiParams {
  readonly citizenId?: string | null;
  readonly clusterId?: string | null;
  readonly applicantName: string;
  readonly fatherOrSpouseName?: string | null;
  readonly address: string;
  readonly contactNumber: string;
  readonly email?: string | null;
  readonly bplCardNo?: string | null;
  readonly bplYear?: string | null;
  readonly authorityName: string;
  readonly publicAuthorityAddress?: string | null;
  readonly subject: string;
  readonly description: string;
  readonly specificQuestions?: string[];
  readonly isBplExempt?: boolean;
}

function buildEnglishStatutoryDraft(params: {
  id: string;
  applicantName: string;
  address: string;
  authorityName: string;
  publicAuthorityAddress?: string | null;
  subject: string;
  description: string;
  questions: string[];
  isBpl: boolean;
  bplCardNo?: string | null;
  dateStr: string;
}): string {
  const qLines = params.questions.map((q, i) => `   (${i + 1}) ${q}`).join('\n');
  return `FORM 'A'
APPLICATION UNDER SECTION 6(1) OF THE RIGHT TO INFORMATION ACT, 2005

To,
The Public Information Officer (PIO),
${params.authorityName}
${params.publicAuthorityAddress || 'Municipal Administrative Headquarters'}

1. Full Name of Applicant: ${params.applicantName}
2. Address for Correspondence: ${params.address}
3. Particulars of Information Required:
   Subject: ${params.subject}
   Description: ${params.description}
   Specific Questions:
${qLines}
4. Whether Applicant belongs to BPL Category: ${params.isBpl ? `YES (Card No: ${params.bplCardNo || 'Enclosed'})` : 'NO'}
5. Application Fee: ${params.isBpl ? 'Exempted under Section 7(5)' : 'Rs. 10/- paid via Indian Postal Order / Online Receipt'}

Place: Delhi NCR
Date: ${params.dateStr}

Signature of Applicant`;
}

function buildHindiStatutoryDraft(params: {
  id: string;
  applicantName: string;
  address: string;
  authorityName: string;
  publicAuthorityAddress?: string | null;
  subject: string;
  description: string;
  questions: string[];
  isBpl: boolean;
  bplCardNo?: string | null;
  dateStr: string;
}): string {
  const qLines = params.questions.map((q, i) => `   (${i + 1}) ${q}`).join('\n');
  return `प्रपत्र 'क'
सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) के अंतर्गत आवेदन

सेवा में,
लोक सूचना अधिकारी (PIO),
${params.authorityName}
${params.publicAuthorityAddress || 'नगर निगम मुख्यालय'}

1. आवेदक का पूरा नाम: ${params.applicantName}
2. पत्राचार का पता: ${params.address}
3. मांगी गई सूचना का विवरण:
   विषय: ${params.subject}
   विवरण: ${params.description}
   विशिष्ट प्रश्न:
${qLines}
4. क्या आवेदक बीपीएल श्रेणी से संबंधित है: ${params.isBpl ? `हाँ (कार्ड संख्या: ${params.bplCardNo || 'संलग्न'})` : 'नहीं'}
5. आवेदन शुल्क: ${params.isBpl ? 'धारा 7(5) के तहत शुल्क मुक्त' : 'रु. 10/- पोस्टल आर्डर / चालान द्वारा भुगतान'}

स्थान: दिल्ली एनसीआर
दिनांक: ${params.dateStr}

आवेदक के हस्ताक्षर`;
}

export class RtiStore {
  private inMemoryApplications = new Map<string, RtiApplicationEntity>();

  async createApplication(
    params: CreateRtiParams,
    env?: ValidatedEnv
  ): Promise<RtiApplicationEntity> {
    const id = `rti-${crypto.randomUUID()}`;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    let subject = params.subject;
    let description = params.description;
    const questions = params.specificQuestions && params.specificQuestions.length > 0
      ? [...params.specificQuestions]
      : [];

    // Auto-inject linked cluster details if clusterId is provided
    if (params.clusterId) {
      const complaintStore = getComplaintStore();
      const cluster = await complaintStore.findClusterById(params.clusterId, env);

      if (cluster) {
        let trackingRef = cluster.id;
        let slaDueAt: Date | string = new Date(new Date(cluster.createdAt).getTime() + 48 * 3600 * 1000);

        const complaintsList = await complaintStore.queryComplaints({}, env);
        const linkedComplaint = complaintsList.items.find((c) => c.clusterId === cluster.id);
        if (linkedComplaint) {
          trackingRef = linkedComplaint.trackingCode;
          slaDueAt = linkedComplaint.slaDueAt;
        }

        const isBreached = now.getTime() > new Date(slaDueAt).getTime();
        const slaStatusText = isBreached ? 'SLA BREACHED' : 'ACTIVE / WITHIN SLA';
        const clusterDate = new Date(cluster.createdAt).toLocaleDateString('en-IN');
        const slaDate = new Date(slaDueAt).toLocaleDateString('en-IN');

        subject = `[Grievance Ref: ${trackingRef} | Dept: ${cluster.departmentId || 'Civic'}] ${subject}`;
        description = `${description}\n\n[Auto-Injected Grievance Details]\n- Cluster ID: ${cluster.id}\n- Tracking Reference: ${trackingRef}\n- Department: ${cluster.departmentId || 'Civic Works'}\n- Ward: ${cluster.wardId || 'Unassigned'}\n- Submission Date: ${clusterDate}\n- Citizen Charter SLA Deadline: ${slaDate}\n- Current Grievance Status: ${cluster.status} (${slaStatusText})`;

        if (questions.length === 0) {
          questions.push(
            `Certified copies of all site inspection reports, file notings, and engineering estimates recorded in connection with Grievance Cluster ID '${cluster.id}' (Tracking Ref: ${trackingRef}, Department: ${cluster.departmentId}).`,
            `Daily progress report, diary entries, and list of all municipal officers/staff to whom this grievance was assigned from ${clusterDate} to date.`,
            `Names, designations, and contact numbers of the municipal officers mandated to rectify this issue within the Citizen Charter SLA deadline of ${slaDate}.`,
            `Reasons recorded in writing for the non-redressal and SLA breach (${slaStatusText}) of this civic complaint.`
          );
        }
      }
    }

    if (questions.length === 0) {
      questions.push(
        'Certified copies of all official records, file notings, and orders concerning the subject matter.',
        'Current administrative status of the matter along with reasons for delay, if any.',
        'Names and designations of public servants responsible for processing this matter.'
      );
    }

    const isBpl = Boolean(params.isBplExempt);

    const englishDraft = buildEnglishStatutoryDraft({
      id,
      applicantName: params.applicantName,
      address: params.address,
      authorityName: params.authorityName,
      publicAuthorityAddress: params.publicAuthorityAddress,
      subject,
      description,
      questions,
      isBpl,
      bplCardNo: params.bplCardNo,
      dateStr,
    });

    const hindiDraft = buildHindiStatutoryDraft({
      id,
      applicantName: params.applicantName,
      address: params.address,
      authorityName: params.authorityName,
      publicAuthorityAddress: params.publicAuthorityAddress,
      subject,
      description,
      questions,
      isBpl,
      bplCardNo: params.bplCardNo,
      dateStr,
    });

    const entity: RtiApplicationEntity = {
      id,
      citizenId: params.citizenId ?? null,
      clusterId: params.clusterId ?? null,
      applicantName: params.applicantName,
      fatherOrSpouseName: params.fatherOrSpouseName ?? null,
      address: params.address,
      contactNumber: params.contactNumber,
      email: params.email ?? null,
      bplCardNo: params.bplCardNo ?? null,
      bplYear: params.bplYear ?? null,
      authorityName: params.authorityName,
      publicAuthorityAddress: params.publicAuthorityAddress ?? null,
      subject,
      description,
      specificQuestions: questions,
      englishDraft,
      hindiDraft,
      isBplExempt: isBpl,
      status: 'FILED',
      createdAt: now,
      updatedAt: now,
    };

    if (env?.DATABASE_URL) {
      try {
        const db = getDatabase(env.DATABASE_URL);
        await db.insert(rtiTable).values({
          id: entity.id,
          citizenId: entity.citizenId,
          clusterId: entity.clusterId,
          applicantName: entity.applicantName,
          fatherOrSpouseName: entity.fatherOrSpouseName,
          address: entity.address,
          contactNumber: entity.contactNumber,
          email: entity.email,
          bplCardNo: entity.bplCardNo,
          bplYear: entity.bplYear,
          authorityName: entity.authorityName,
          publicAuthorityAddress: entity.publicAuthorityAddress,
          subject: entity.subject,
          description: entity.description,
          specificQuestions: entity.specificQuestions,
          englishDraft: entity.englishDraft,
          hindiDraft: entity.hindiDraft,
          isBplExempt: entity.isBplExempt,
          status: entity.status,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        });
      } catch {
        // Fallback to in-memory store
      }
    }

    this.inMemoryApplications.set(id, entity);
    return entity;
  }

  async findById(id: string, env?: ValidatedEnv): Promise<RtiApplicationEntity | null> {
    if (env?.DATABASE_URL) {
      try {
        const db = getDatabase(env.DATABASE_URL);
        const result = await db.select().from(rtiTable).where(eq(rtiTable.id, id)).limit(1);
        if (result[0]) {
          return {
            id: result[0].id,
            citizenId: result[0].citizenId,
            clusterId: result[0].clusterId,
            applicantName: result[0].applicantName,
            fatherOrSpouseName: result[0].fatherOrSpouseName,
            address: result[0].address,
            contactNumber: result[0].contactNumber,
            email: result[0].email,
            bplCardNo: result[0].bplCardNo,
            bplYear: result[0].bplYear,
            authorityName: result[0].authorityName,
            publicAuthorityAddress: result[0].publicAuthorityAddress,
            subject: result[0].subject,
            description: result[0].description,
            specificQuestions: (result[0].specificQuestions as string[]) ?? [],
            englishDraft: result[0].englishDraft,
            hindiDraft: result[0].hindiDraft,
            isBplExempt: result[0].isBplExempt,
            status: result[0].status,
            createdAt: result[0].createdAt,
            updatedAt: result[0].updatedAt,
          };
        }
      } catch {
        // Fallback
      }
    }

    return this.inMemoryApplications.get(id) ?? null;
  }

  async listApplications(
    citizenId?: string,
    _env?: ValidatedEnv
  ): Promise<RtiApplicationEntity[]> {
    let list = Array.from(this.inMemoryApplications.values());
    if (citizenId) {
      list = list.filter((app) => app.citizenId === citizenId);
    }
    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  reset(): void {
    this.inMemoryApplications.clear();
  }
}

let rtiStoreInstance: RtiStore | null = null;

export function getRtiStore(): RtiStore {
  if (!rtiStoreInstance) {
    rtiStoreInstance = new RtiStore();
  }
  return rtiStoreInstance;
}
