import { test, expect } from '@playwright/test';
import { sendIotEvent } from './helpers/iot.js';

test.describe('IoT Streetlight Telemetry & Auto-Resolution Journey', () => {
  test('IoT simulator triggers FAULT_CONFIRMED → appears on admin map → simulator triggers FAULT_CLEARED → cluster auto-resolves', async ({
    page,
    request,
  }) => {
    const backendUrl = 'http://localhost:3000';
    const deviceUid = 'UNO_Q_01';

    // 1. Send simulated FAULT event signed with HMAC-SHA256
    const faultResponse = await sendIotEvent({
      backendUrl,
      deviceUid,
      status: 'FAULT',
      seq: 101,
    });

    expect(faultResponse.success).toBe(true);
    expect(faultResponse.event).toBe('FAULT_RECORDED');
    expect(faultResponse.clusterId).toBeDefined();

    const clusterId = faultResponse.clusterId!;

    // 2. Verify cluster is returned by Map Clusters API
    const mapClustersRes = await request.get(`${backendUrl}/api/v1/map/clusters`);
    expect(mapClustersRes.ok()).toBe(true);
    const mapClustersJson = await mapClustersRes.json();
    const clustersList = mapClustersJson.clusters || mapClustersJson.data || [];

    const faultCluster = clustersList.find((c: { id: string }) => c.id === clusterId);
    expect(faultCluster).toBeDefined();

    // 3. Officer logs into Admin Console to view the live fault on the dashboard
    await page.goto('/login');
    const adminDemoBtn = page.locator('button', { hasText: 'Administrator' }).first();
    await adminDemoBtn.click();

    await page.goto('/admin');
    await expect(page.locator('h1')).toContainText(/Admin Dashboard|Municipal Command|प्रशासक/i);

    // Verify IoT layer / telemetry indicators are active
    await expect(page.getByText(/Interactive Clustered Grievance & IoT Map/i)).toBeVisible();
    await expect(page.getByText(/Indirapuram|Electrical/i).first()).toBeVisible();

    // 4. Send simulated FAULT_CLEARED (RESOLVED/NORMAL) event
    const resolveResponse = await sendIotEvent({
      backendUrl,
      deviceUid,
      status: 'RESOLVED',
      seq: 102,
    });

    expect(resolveResponse.success).toBe(true);
    expect(resolveResponse.event).toBe('FAULT_CLEARED');
    expect(resolveResponse.activeClusterIdResolved).toBe(clusterId);

    // 5. Verify the cluster auto-resolved with IOT_CLEARED audit event
    const timelineRes = await request.get(`${backendUrl}/api/v1/clusters/${clusterId}/timeline`);
    expect(timelineRes.ok()).toBe(true);
    const timelineJson = await timelineRes.json();

    const iotClearedEvent = timelineJson.events?.find(
      (ev: { eventType: string }) => ev.eventType === 'IOT_CLEARED' || ev.eventType.includes('RESOLVED')
    );
    expect(iotClearedEvent).toBeDefined();

    // 6. Refresh admin view and verify cluster status is RESOLVED
    const updatedClustersRes = await request.get(`${backendUrl}/api/v1/map/clusters?fresh=true`);
    const updatedClustersJson = await updatedClustersRes.json();
    const updatedList = updatedClustersJson.clusters || updatedClustersJson.data || [];
    const resolvedCluster = updatedList.find((c: { id: string }) => c.id === clusterId);

    if (resolvedCluster) {
      expect(resolvedCluster.status).toBe('RESOLVED');
    }
  });
});
