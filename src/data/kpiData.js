// KPI Data — [Your Company]
//
// Current source: manual Excel import (Strategic KPI workbook). This is a
// development/import pathway, not the production data flow — see
// src/lib/navisionIntegration.js for the intended
// Navision -> integration layer -> Dashboard architecture and its current (unimplemented)
// status. The dashboard consumes this canonical shape regardless of origin,
// so swapping the source later does not require UI changes.
//
// Reporting periods are computed dynamically from the data itself
// (see src/lib/reportingPeriod.js) — there is no hardcoded financial year.

import { classifyKpi } from '../lib/kpiThresholds.js'

export const companyInfo = {
  name: 'Your Company',
  shortName: 'VPMS',
  vision: 'A leader in the procurement, hospitality and logistics of bulk petroleum products to ensure energy security through customer centric service',
  employees: 222,
  employeesPrev: 223,
  currency: 'ZMW',
  symbol: 'K',
  // Data provenance (section 17 of the revision brief) — every figure on
  // this dashboard currently traces back to this single manual import.
  // Per-KPI provenance (source record, HOD, sync time) requires the
  // canonical KPI data model described in src/lib/navisionIntegration.js
  // and does not exist yet.
  dataSource: 'Entered via VPMS, GM-approved',
  dataIsProvisional: true,
};

export const overallScores = {
  overall: 54.1,
  financial: 75.7,
  customer: 84.9,
  internalProcesses: 83.3,
  learningGrowth: 11.3,
};

// Q3/Q4 are illustrative placeholders (`isDemo: true`), not reported
// actuals — requested so the Q3/Q4 side of these charts isn't empty while
// real figures are pending. Each is the prior quarter scaled up 8-15%
// (Q3 +12%, Q4 +9% on Q3), a made-up but plausible growth curve. Replace
// with real reported figures and drop `isDemo` the moment Finance approves
// them; never carry `isDemo` rows into an approved/exported report.
export const quarterlyRevenue = [
  { quarter: 'Q1', target: -12000000, actual: 10000000 },
  { quarter: 'Q2', target: 18160000, actual: 44610000 },
  { quarter: 'Q3', target: 20339200, actual: 49963200, isDemo: true },
  { quarter: 'Q4', target: 22169728, actual: 54459888, isDemo: true },
];

// `estimated` is an illustrative planning line (no real monthly budget
// figures exist yet) — flat month-on-month step so the Monthly Revenue
// Trend chart has something to compare `revenue` (actual) against. Replace
// with the real monthly estimate/budget series once Finance provides one.
export const monthlyRevenue = [
  { month: 'Jan', revenue: 200000, estimated: 250000 },
  { month: 'Feb', revenue: 300000, estimated: 300000 },
  { month: 'Mar', revenue: 400000, estimated: 350000 },
  { month: 'Apr', revenue: 500000, estimated: 450000 },
  { month: 'May', revenue: 600000, estimated: 550000 },
  { month: 'Jun', revenue: 700000, estimated: 650000 },
  { month: 'Jul', revenue: 800000, estimated: 750000 },
  { month: 'Aug', revenue: 900000, estimated: 850000 },
  { month: 'Sep', revenue: 1000000, estimated: 950000 },
  { month: 'Oct', revenue: 1100000, estimated: 1050000 },
  { month: 'Nov', revenue: 1200000, estimated: 1150000 },
  { month: 'Dec', revenue: 1300000, estimated: 1250000 },
];

// Q3/Q4 volumes are illustrative placeholders (`isDemo: true`, same +12%/+9%
// curve as quarterlyRevenue below) — not reported actuals.
export const operations = {
  productReceived: [
    { quarter: 'Q1', volume: 347232.59 },
    { quarter: 'Q2', volume: 482512.58 },
    { quarter: 'Q3', volume: 540574.09, isDemo: true },
    { quarter: 'Q4', volume: 589225.76, isDemo: true },
  ],
  productDistributed: [
    { quarter: 'Q1', volume: 385931.18 },
    { quarter: 'Q2', volume: 379112.20 },
    { quarter: 'Q3', volume: 424605.66, isDemo: true },
    { quarter: 'Q4', volume: 462820.17, isDemo: true },
  ],
};

// `received`/`distributed` are null for quarters not yet reported — charts
// and tables must treat null as "no data", never as zero volume. Q3/Q4 below
// are illustrative placeholders (`isDemo: true`), not reported actuals —
// each is the prior quarter scaled up 8-15% (Q3 +12%, Q4 +9% on Q3).
// Replace with real reported figures and drop `isDemo` once Operations
// approves them.
export const operationsChart = [
  { quarter: 'Q1', received: 347232.59, distributed: 385931.18 },
  { quarter: 'Q2', received: 482512.58, distributed: 379112.20 },
  { quarter: 'Q3', received: 540574.09, distributed: 424605.66, isDemo: true },
  { quarter: 'Q4', received: 589225.76, distributed: 462820.17, isDemo: true },
];

// `target` is the completion percentage that counts as "delivered" (100 for
// all current projects). Health is derived from completion vs. target via
// the shared KPI threshold classifier — it is not a separately hardcoded
// field, so it always reflects the same red/orange/yellow/green rules used
// everywhere else on the dashboard.
// `deadline` is illustrative (no real project schedule exists yet) — it
// drives the priority shown on the Projects & actions page: the closer the
// deadline, the higher the priority. See getPriorityFromDeadline in
// dashboardMetrics.js. `department` (also illustrative) is the owning
// department, used for the project-count-by-department chart.
export const projects = [
  { name: 'Vehicle Reg No. Reader', completion: 98, target: 100, status: 'On Track', deadline: '2026-10-15', department: 'Operations' },
  { name: 'Meter Upgrade (Colioris)', completion: 80, target: 100, status: 'In Progress', deadline: '2026-11-30', department: 'Commercial' },
  { name: 'Tank 7 Conversion', completion: 5, target: 100, status: 'Early Stage', deadline: '2027-03-31', department: 'Maintenance' },
  { name: 'Terminal Management System', completion: 20, target: 100, status: 'In Progress', deadline: '2026-12-15', department: 'Dispatch' },
];

export const issues = {
  unresolved: 1,
  revisions: 2,
  pendingActions: 3,
};

// Q3/Q4 are illustrative placeholders (`isDemo: true`, same +12%/+9% curve
// as above), not reported actuals.
// `budget` is the quarterly purchasing budget. Procurement has not supplied
// figures yet, so it is null (the chart shows no budget bar rather than an
// invented one). Fill these in when the budget is confirmed.
export const purchasing = [
  { quarter: 'Q1', budget: null, amount: 7760000 },
  { quarter: 'Q2', budget: null, amount: 16400000 },
  { quarter: 'Q3', budget: null, amount: 18368000, isDemo: true },
  { quarter: 'Q4', budget: null, amount: 20021120, isDemo: true },
];

export const safety = {
  preventiveMaintenance: 89,
  prevMaintenancePrev: 88,
  totalEmployees: 222,
  prevEmployees: 223,
  // Confirmed each period by Ops/HSE as a standing assurance statement — not
  // derived from a KPI figure, unlike the fields above. Update the wording
  // itself if a period's safety record actually changes.
  narrative: 'Acceptable industrial standards of safety and environmental practice were maintained at all sites.',
};

// Balanced Scorecard KPIs
export const financialKPIs = [
  {
    name: 'ROCE',
    target: 100,
    quarters: { Q1: 80, Q2: 120, Q3: 80, Q4: null },
  },
  {
    name: 'Operational Cost vs Revenue',
    target: 100,
    quarters: { Q1: 65.8, Q2: 0, Q3: 20.3, Q4: null },
  },
  {
    name: 'Asset Turnover',
    target: 100,
    quarters: { Q1: 80, Q2: 0, Q3: 0, Q4: null },
  },
];

export const customerKPIs = [
  {
    name: 'LSG Loss Compliance',
    target: 100,
    quarters: { Q1: 100, Q2: 120, Q3: null, Q4: null },
  },
  {
    name: 'PMS Loss Compliance',
    target: 100,
    quarters: { Q1: 90, Q2: 110, Q3: 113, Q4: null },
  },
  {
    name: 'ISO Code Compliance',
    target: 100,
    quarters: { Q1: 60, Q2: 70, Q3: 100, Q4: null },
  },
  {
    name: 'Stakeholder Satisfaction',
    target: 100,
    quarters: { Q1: 91.7, Q2: 66.7, Q3: 111.7, Q4: null },
  },
];

export const internalKPIs = [
  {
    name: 'Truck Turnaround',
    target: 100,
    quarters: { Q1: 100, Q2: 80, Q3: 120, Q4: null },
  },
  {
    name: 'Zero Recordable Incidents',
    target: 100,
    quarters: { Q1: 50, Q2: 60, Q3: null, Q4: null },
  },
];

export const learningKPIs = [
  {
    name: 'Staff Certification',
    target: 100,
    quarters: { Q1: 20, Q2: null, Q3: null, Q4: null },
    performance: 20,
  },
  {
    name: 'Storage Tank Construction',
    target: 100,
    quarters: { Q1: 10, Q2: null, Q3: null, Q4: null },
    performance: 10,
  },
  {
    name: 'Pipeline Construction',
    target: 100,
    quarters: { Q1: 40, Q2: null, Q3: null, Q4: null },
    performance: 40,
  },
  {
    name: 'Cargo Procurement',
    target: 100,
    quarters: { Q1: 15, Q2: null, Q3: null, Q4: null },
    performance: 15,
  },
];

// Heatmap cell colour, driven by the shared configurable KPI threshold
// classifier (src/lib/kpiThresholds.js) rather than one hardcoded rule.
// `thresholds` lets a specific KPI override the default red/orange/yellow/
// green cutoffs, or flip `lowerIsBetter` when its methodology calls for it.
export function getHeatClass(value, thresholds) {
  return `heat-${classifyKpi(value, thresholds)}`;
}

// Plain calculated figure — no currency symbol/prefix — to 2 decimal places.
// Used where the underlying number itself is what matters (e.g. the
// Executive Overview management-brief header), as distinct from
// formatKwacha which is for contexts that are explicitly currency amounts.
export function formatFigure(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

// Format ZMW currency
export function formatKwacha(value, compact = false) {
  if (compact) {
    if (Math.abs(value) >= 1000000) return `K${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `K${(value / 1000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-ZM', { style: 'currency', currency: 'ZMW', currencyDisplay: 'symbol' })
    .format(value)
    .replace('ZMW', 'K');
}
