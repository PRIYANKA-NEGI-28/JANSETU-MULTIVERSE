import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiSummaryCards } from '../pages/admin/KpiSummaryCards.js';
import { SlaBreachWatchlist } from '../pages/admin/SlaBreachWatchlist.js';
import { SlaEscalationTracker } from '../pages/admin/SlaEscalationTracker.js';
import type { AdminKpiStats } from '../pages/admin/types.js';

describe('SLA Badge & Escalation Tracker Rendering', () => {
  const dummyStats: AdminKpiStats = {
    totalIntake: 250,
    resolvedCount: 195,
    activeCount: 55,
    openClusters: 12,
    resolvedClusters: 30,
    slaComplianceRatePercent: 94,
    averageResolutionHours: 18.5,
    activeEscalations: 5,
  };

  it('renders SLA Compliance metric card with target badge', () => {
    render(<KpiSummaryCards analytics={null} stats={dummyStats} loading={false} />);

    expect(screen.getByText('94%')).toBeInTheDocument();
    expect(screen.getByText(/Target 95%/i)).toBeInTheDocument();
    expect(screen.getByText(/Clusters Overview/i)).toBeInTheDocument();
    expect(screen.getByText(/Avg Resolution Time/i)).toBeInTheDocument();
  });

  it('renders SLA Breach Watchlist with overdue tags and urgency badges', () => {
    const breaches = [
      {
        complaintId: 'comp-101',
        trackingCode: 'JS-20261123-0101',
        title: 'Dangerous hanging wire',
        category: 'Electricity Hazard',
        urgency: 'CRITICAL',
        status: 'ESCALATED',
        wardId: 'Ghaziabad Ward 1',
        departmentId: 'Electrical Division',
        slaDueAt: new Date().toISOString(),
        overdueHours: 8.5,
        escalationLevel: 2,
      },
    ];

    render(<SlaBreachWatchlist breaches={breaches} loading={false} />);

    expect(screen.getByText('JS-20261123-0101')).toBeInTheDocument();
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('+8.5h')).toBeInTheDocument();
    expect(screen.getByText(/Escalation L2/i)).toBeInTheDocument();
  });

  it('renders SLA Escalation Tracker with Approaching Deadlines Radar', () => {
    render(<SlaEscalationTracker />);

    expect(
      screen.getByText(/Approaching SLA Deadlines Radar \(< 4 Hours Remaining\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Escalation Level 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Escalation Level 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Escalation Level 1/i)).toBeInTheDocument();
  });
});
