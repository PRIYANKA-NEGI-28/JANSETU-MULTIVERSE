import { z } from 'zod';

export const COMPLAINT_CATEGORIES = [
  'Street Light',
  'Road Damage',
  'Waste Management',
  'Water Supply',
  'Sewage',
  'Electricity Hazard',
  'Sanitation',
  'Public Park',
  'Traffic / Transport',
  'Pollution / Air Quality',
  'Encroachment / Public Safety',
  'Property Tax / Civic Services',
  'Stray Animals',
  'Illegal Construction',
  'Fire Hazard',
  'General Complaint',
] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export const ComplaintCategorySchema = z.enum(COMPLAINT_CATEGORIES);
