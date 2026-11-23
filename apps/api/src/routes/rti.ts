import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types/index.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error-handler.js';
import { getRtiStore } from '../services/rti-store.js';
import { generateRtiSection6Pdf } from '../services/rti-pdf.js';
import { getStorageService } from '../services/storage.js';

export const rtiRoute = new Hono<AppEnv>();

const CreateRtiPayloadSchema = z.object({
  applicantName: z.string().trim().min(1, 'Applicant name is required').max(150),
  fatherOrSpouseName: z.string().trim().optional(),
  address: z.string().trim().min(5, 'Address is required').max(300),
  contactNumber: z.string().trim().min(8, 'Valid contact number is required').max(20),
  email: z.string().trim().email().optional().or(z.literal('')),
  authorityName: z.string().trim().min(1, 'Public authority name is required').max(150),
  publicAuthorityAddress: z.string().trim().optional(),
  subject: z.string().trim().min(3, 'Subject is required').max(300),
  description: z.string().trim().min(5, 'Description is required').max(3000),
  clusterId: z.string().trim().optional(),
  specificQuestions: z.array(z.string().trim().min(1)).optional(),
  isBplExempt: z.boolean().optional(),
  bplCardNo: z.string().trim().optional(),
  bplYear: z.string().trim().optional(),
});

// POST /api/v1/rti - Create statutory RTI Section 6(1) application
rtiRoute.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const validated = CreateRtiPayloadSchema.parse(body);

  const rtiStore = getRtiStore();
  const application = await rtiStore.createApplication(
    {
      ...validated,
      citizenId: user?.id ?? null,
      applicantName: validated.applicantName || user?.name || 'Citizen Applicant',
      email: validated.email || user?.email || undefined,
    },
    c.get('env')
  );

  return c.json({ rti: application }, 201);
});

// GET /api/v1/rti - List RTI applications
rtiRoute.get('/', requireAuth, async (c) => {
  const user = c.get('user');
  const rtiStore = getRtiStore();

  // Citizens only see their own RTI filings; officers/admins see all
  const citizenFilter = user?.role === 'citizen' ? user.id : undefined;
  const applications = await rtiStore.listApplications(citizenFilter, c.get('env'));

  return c.json({ applications, total: applications.length }, 200);
});

// GET /api/v1/rti/:id/pdf - Generate or fetch cached statutory RTI Section 6(1) PDF
rtiRoute.get('/:id/pdf', requireAuth, async (c) => {
  const id = c.req.param('id');
  const storage = getStorageService();
  const r2Bucket = c.env?.MEDIA_BUCKET;
  const pdfKey = `rti-pdfs/${id}.pdf`;

  // 1. Check R2 storage cache
  const cachedPdf = await storage.getObject(pdfKey, c.get('env'), r2Bucket);
  if (cachedPdf) {
    return new Response(cachedPdf.data.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="rti-section6-${id}.pdf"`,
        'X-Cache': 'HIT',
      },
    });
  }

  // 2. Query application record from store
  const rtiStore = getRtiStore();
  const application = await rtiStore.findById(id, c.get('env'));
  if (!application) {
    throw new HttpError(404, 'Not Found', `RTI application '${id}' not found`);
  }

  // 3. Generate clean statutory PDF via pdf-lib
  const pdfBytes = await generateRtiSection6Pdf(application);

  // 4. Cache in R2 storage
  await storage.putObject(pdfKey, pdfBytes, 'application/pdf', c.get('env'), r2Bucket);

  return new Response(pdfBytes.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="rti-section6-${id}.pdf"`,
      'X-Cache': 'MISS',
    },
  });
});
