import { test, expect } from '@playwright/test';

test.describe('Officer Queue & Status Resolution Journey', () => {
  test('Officer logs in → views clustered map & ward queue → updates complaint status → citizen sees updated timeline', async ({
    page,
  }) => {
    // 1. Authenticate as Municipal Administrator / Ward Officer
    await page.goto('/login');
    const adminDemoBtn = page.locator('button', { hasText: 'Administrator' }).first();
    await adminDemoBtn.click();

    // 2. Navigate to Municipal Command Console
    await page.goto('/admin');
    await expect(page.locator('h1')).toContainText(/Admin Dashboard|Municipal Command|प्रशासक/i);

    // Verify KPI cards and Map are rendered
    await expect(page.getByText(/Clusters Overview|SLA Compliance/i).first()).toBeVisible();
    await expect(page.getByText(/Interactive Clustered Grievance & IoT Map/i)).toBeVisible();

    // 3. Switch to Officer Operations & Triage Queue tab
    const queueTabBtn = page.locator('button', { hasText: /Officer Operations & Triage Queue/i });
    await queueTabBtn.click();
    await expect(page).toHaveURL(/tab=queue/);

    // 4. Locate an open cluster in the queue and open resolution drawer
    await expect(page.getByText(/Triage & Cluster Resolution Queue/i)).toBeVisible();
    const openDrawerBtn = page.locator('button', { hasText: /Open Drawer/i }).first();
    await expect(openDrawerBtn).toBeVisible();
    await openDrawerBtn.click();

    // 5. Drawer slides in with cluster details and action forms
    await expect(page.getByText(/Update Resolution Status/i)).toBeVisible({ timeout: 10000 });

    // Select new status: IN_PROGRESS
    const statusSelect = page.locator('#status-select');
    await statusSelect.selectOption('IN_PROGRESS');

    // Fill mandatory inspection/resolution note
    const resolutionNote =
      'Emergency response team dispatched to site. High-voltage line isolated and pedestrians diverted with safety tape.';
    const noteTextarea = page.locator('#resolution-note');
    await noteTextarea.fill(resolutionNote);

    // Submit status update
    const updateStatusBtn = page.locator('button[type="submit"]', {
      hasText: /Submit Status Update|Update Cluster Status/i,
    });
    await updateStatusBtn.click();

    // Verify success feedback
    await expect(page.getByText(/Status successfully updated to IN_PROGRESS/i)).toBeVisible({ timeout: 10000 });

    // 6. Citizen verification: navigate to tracking portal for complaint JS-20261123-0101
    await page.goto('/track?code=JS-20261123-0101');
    await expect(page.locator('h1')).toContainText(/Track Status|Track Grievance|Track Complaint/i);

    // Verify the citizen sees updated timeline and complaint state
    await expect(page.getByText('JS-20261123-0101')).toBeVisible();
    await expect(page.locator('text=IN_PROGRESS').first()).toBeVisible();
  });
});
