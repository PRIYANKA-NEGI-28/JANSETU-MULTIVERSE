import { z } from 'zod';

export const DEPARTMENTS = [
  'Municipal Corporation - Electrical Division',
  'Public Works Department (PWD)',
  'Municipal Corporation - Sanitation Department',
  'Delhi Jal Board / Water Supply Department',
  'Municipal Corporation - Sewerage Division',
  'Electricity Distribution Company (DISCOM)',
  'Municipal Corporation - Health & Sanitation',
  'Municipal Corporation - Horticulture Department',
  'Traffic Police / Transport Department',
  'Delhi Pollution Control Committee (DPCC) / Environment',
  'Delhi Police / Local Law Enforcement',
  'Municipal Corporation - Revenue & Estate',
  'Animal Welfare Board / Veterinary Department',
  'Municipal Corporation - Building & Housing',
  'Fire Services / Disaster Management',
  'Municipal Corporation - General Administration',
] as const;

export type DepartmentName = (typeof DEPARTMENTS)[number];

export const DepartmentSchema = z.enum(DEPARTMENTS);

export interface DepartmentInfo {
  readonly id: string;
  readonly name: DepartmentName;
  readonly contactPhone?: string;
  readonly escalationLevel: number;
}
