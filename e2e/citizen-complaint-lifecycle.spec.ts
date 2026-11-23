import { test, expect } from '@playwright/test';

test.describe('Citizen Complaint Lifecycle Journey', () => {
  test('Citizen registers/logs in → files complaint → receives tracking ID → views live status', async ({
    page,
  }) => {
    // 1. Visit Login page and authenticate as Citizen
    await page.goto('/login');
    await expect(page).toHaveTitle(/JanSetu Multiverse/);

    // Fast-authenticate via Citizen demo account
    const citizenButton = page.locator('button', { hasText: 'Citizen' }).first();
    await citizenButton.click();

    // Verify redirected to Home with authenticated session
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Ramesh Sharma')).toBeVisible();

    // 2. Navigate to Complaint Filing page
    await page.goto('/submit');
    await expect(page.locator('h1')).toContainText(/File Complaint|File a Civic Complaint|शिकायत दर्ज करें/i);

    // 3. Fill in complaint description
    const complaintDetails =
      'Hazardous open manhole and damaged road surface near Sector 4 primary market, causing severe traffic risk.';
    const textarea = page.locator('#complaint-text');
    await textarea.fill(complaintDetails);

    // 4. Submit Complaint
    const submitBtn = page.locator('button[type="submit"]', { hasText: /Submit Grievance|शिकायत दर्ज करें/i });
    await submitBtn.click();

    // 5. Verify confirmation modal with immutable tracking code
    await expect(page.getByText(/Complaint Successfully Filed!/i)).toBeVisible({ timeout: 15000 });

    const trackingCodeElement = page.locator('span.font-mono.font-black.text-orange-600');
    await expect(trackingCodeElement).toBeVisible();
    const trackingCode = (await trackingCodeElement.textContent())?.trim();

    expect(trackingCode).toBeDefined();
    expect(trackingCode).toMatch(/^JS-\d{8}-[A-Z0-9]+$/);

    // 6. Navigate to Live Tracking Portal via button
    const trackTimelineBtn = page.locator('button', { hasText: /Track Live Timeline/i });
    await trackTimelineBtn.click();

    // 7. Verify tracking page reflects live complaint state
    await expect(page).toHaveURL(new RegExp(`/track\\?code=${trackingCode}`));
    await expect(page.locator('h1')).toContainText(/Track Status|Track Grievance|Track Complaint|शिकायत ट्रैक करें/i);

    // Verify tracking code header and status badge are rendered
    await expect(page.getByText(trackingCode!)).toBeVisible();
    await expect(page.locator('text=PENDING').first()).toBeVisible();
    await expect(page.getByText(/COMPLAINT_CREATED|Complaint registered|Verified Events|Audit Trail/i).first()).toBeVisible();
  });
});
