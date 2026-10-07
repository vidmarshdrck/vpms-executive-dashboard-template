// Balanced Scorecard data: GM weighted scorecard, strategy map, and the
// departmental scorecards.
//
// Sources
//   gmScorecard, strategyMap -> the Strategic plan workbook shared with the
//     PMS project ("GM Weighted Scorecard-1" and "Balanced Scorecard" sheets).
//     Figures are copied as-is, including the workbook's own quirks, which are
//     called out in `note` fields rather than silently corrected.
//   departments -> DEMO DATA. The workbook's department sheets repeat the
//     same placeholder series in every department, so they cannot be used.
//     The values below are generated from a fixed seed (identical on every
//     load) to show how the scorecards will read once heads of department
//     submit monthly actuals. Replace `departments` with real submissions;
//     the pages and the scoring engine need no changes.

export const PERSPECTIVES = [
  { key: 'financial', name: 'Financial', weight: 1, color: '#B42318' },
  { key: 'customer', name: 'Customer', weight: 2, color: '#2563B0' },
  { key: 'internal', name: 'Internal processes', weight: 3, color: '#B7791F' },
  { key: 'learning', name: 'Learning & growth', weight: 4, color: '#6D4BA8' },
]

export const PERSPECTIVE_BY_KEY = Object.fromEntries(PERSPECTIVES.map((p) => [p.key, p]))

// ---------------------------------------------------------------------------
// GM weighted scorecard (organisation level). `achievement` is the workbook's
// "Value out of 100" against a target of 100.
// ---------------------------------------------------------------------------
export const gmScorecard = {
  period: 'Q1',
  source: 'Strategic plan workbook · GM Weighted Scorecard',
  kpis: [
    { code: 'FIN-01', perspective: 'financial', weight: 0.6, name: '15% return on capital employed (ROCE)', achievement: 80 },
    { code: 'FIN-02', perspective: 'financial', weight: 0.3, name: '60% operational cost against revenue annually', achievement: 65.8 },
    { code: 'FIN-03', perspective: 'financial', weight: 0.1, name: '1.5x asset turnover ratio attained', achievement: 80 },
    { code: 'CUS-01', perspective: 'customer', weight: 0.4, name: '0.2% LSG loss of total product handled', achievement: 100 },
    { code: 'CUS-02', perspective: 'customer', weight: 0.6, name: '0.4% PMS loss of total product handled', achievement: 90 },
    { code: 'CUS-03', perspective: 'customer', weight: 0.5, name: 'Particle count ISO code 18/16/13 (LSG)', achievement: 60 },
    { code: 'CUS-04', perspective: 'customer', weight: 0.5, name: 'Stakeholder satisfaction above 4.5 / 5', achievement: 91.7 },
    { code: 'INT-01', perspective: 'internal', weight: 2, name: '45-minute truck turnaround time', achievement: 100 },
    { code: 'INT-02', perspective: 'internal', weight: 1, name: 'Zero recordable incidents', achievement: 50 },
    { code: 'LRN-01', perspective: 'learning', weight: 1, name: '10% of staff certified in ATG, AI, instrumentation and marketing', achievement: 20 },
    { code: 'LRN-02', perspective: 'learning', weight: 1, name: 'Construct 300,000 m³ storage tanks', achievement: 10 },
    {
      code: 'LRN-03', perspective: 'learning', weight: 1, name: 'Pipeline interconnecting depots (LFD link)', achievement: 0, reported: 40,
      note: 'Progress of 40% is recorded, but the performance cell is blank in the workbook, so it scores 0 in the approved 54.1%.',
    },
    { code: 'LRN-04', perspective: 'learning', weight: 1, name: 'Procure one 100,000 MT cargo annually', achievement: 15 },
  ],
}

// ---------------------------------------------------------------------------
// Strategy map: perspective -> objective -> measure -> five-year targets ->
// initiative. From the workbook's "Balanced Scorecard" sheet.
// ---------------------------------------------------------------------------
export const strategyMap = {
  vision: 'A leader in the procurement, hospitality and logistics of bulk petroleum products to ensure energy security through customer centric service',
  years: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
  perspectives: [
    {
      key: 'financial',
      objectives: [
        {
          name: 'Enhance financial management',
          initiatives: ['Focused, high-return capital allocation'],
          measures: [
            { name: '15% return on capital employed (ROCE)', targets: ['5%', '8%', '10%', '12%', '15%'] },
            { name: '60% operational cost against revenue annually', targets: ['79%', '75%', '70%', '65%', '60%'], direction: 'lower' },
          ],
        },
        {
          name: 'Maximise asset utilisation',
          initiatives: [],
          measures: [
            {
              name: '1.5x asset turnover ratio attained', targets: ['0.05', '0.08', '0.10', '0.12', '0.15'],
              note: 'Yearly targets in the workbook do not match the 1.5x headline. Confirm with Finance.',
            },
          ],
        },
      ],
    },
    {
      key: 'customer',
      objectives: [
        {
          name: 'Enhance storage and stock management',
          initiatives: ['Real-time stock monitoring at all depots', 'Product filtration at all depots'],
          measures: [
            { name: 'LSG loss as % of product handled', targets: ['0.30%', '0.28%', '0.25%', '0.22%', '0.20%'], direction: 'lower' },
            { name: 'PMS loss as % of product handled', targets: ['0.50%', '0.48%', '0.42%', '0.41%', '0.40%'], direction: 'lower' },
            { name: 'Particle count ISO code (LSG)', targets: ['21/19/17', '19/18/14', '18/16/13', '18/16/13', '18/16/13'], direction: 'lower' },
          ],
        },
        {
          name: 'Improve branding and corporate image',
          initiatives: ['Quarterly stakeholder surveys, with 90% of complaints resolved'],
          measures: [
            { name: 'Stakeholder satisfaction (target above 4.5 / 5)', targets: ['60%', '62%', '64%', '66%', '70%'] },
          ],
        },
      ],
    },
    {
      key: 'internal',
      objectives: [
        {
          name: 'Improve management systems',
          initiatives: ['System integration for paperless depots', 'Safety awareness index'],
          measures: [
            { name: 'Truck turnaround time (minutes)', targets: ['140', '120', '90', '60', '45'], direction: 'lower' },
            { name: 'Recordable incidents per year', targets: ['20', '15', '10', '5', '0'], direction: 'lower' },
          ],
        },
      ],
    },
    {
      key: 'learning',
      objectives: [
        {
          name: 'Improve human capital and innovation',
          initiatives: ['Certified training in core competencies'],
          measures: [
            { name: 'Staff certified in ATG, AI, instrumentation and marketing', targets: ['2%', '4%', '6%', '8%', '10%'] },
          ],
        },
        {
          name: 'Improve infrastructure and technology',
          initiatives: ['PPP for 300,000 m³ storage capacity', 'PPP for an 8" interconnecting pipeline', 'Supplier partnerships for cargo procurement'],
          measures: [
            { name: '300,000 m³ storage tanks built (cumulative)', targets: ['20%', '40%', '60%', '80%', '100%'] },
            { name: 'Pipeline interconnecting depots (LFD link)', targets: ['', '', 'Complete', '', ''] },
            { name: 'Cargoes procured', targets: ['', '1', '1', '1', '1'] },
          ],
        },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Departmental scorecards: DEMO DATA (see header).
// ---------------------------------------------------------------------------
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const REPORTED_MONTHS = 8 // Jan-Aug closed; September onwards not yet submitted

export const departmentSource = 'Demo data · for layout review only'

// [perspective, name, unit, target, direction, weight, typical achievement, monthly spread]
const DEPARTMENT_KPIS = {
  operations: {
    name: 'Operations',
    kpis: [
      ['financial', 'Throughput against plan', '%', 95, 'higher', 2, 0.95, 0.04],
      ['financial', 'Overtime to basic pay ratio', '%', 10, 'lower', 1, 0.87, 0.07],
      ['customer', 'Trucks loaded within scheduled window', '%', 98, 'higher', 2, 0.93, 0.03],
      ['customer', 'Product gains and losses within tolerance', '%', 100, 'higher', 1, 0.95, 0.03],
      ['internal', 'Average truck turnaround', 'min', 90, 'lower', 2, 0.83, 0.06],
      ['learning', 'Operators certified on TMS and ATG', '%', 60, 'higher', 1, 0.72, 0.05],
    ],
  },
  engineering: {
    name: 'Engineering',
    kpis: [
      ['financial', 'Maintenance spend within budget', '%', 100, 'higher', 1, 0.96, 0.03],
      ['customer', 'Meter calibration compliance', '%', 100, 'higher', 1, 0.97, 0.02],
      ['internal', 'Preventive maintenance done on schedule', '%', 95, 'higher', 2, 0.95, 0.03],
      ['internal', 'Critical equipment availability', '%', 98, 'higher', 2, 0.985, 0.01],
      ['learning', 'Technicians trained in instrumentation', '%', 50, 'higher', 1, 0.88, 0.05],
    ],
  },
  finance: {
    name: 'Finance',
    kpis: [
      ['financial', 'Budget variance within ±5%', '%', 100, 'higher', 2, 0.93, 0.04],
      ['financial', 'Debtors collected within 30 days', '%', 90, 'higher', 1, 0.89, 0.05],
      ['customer', 'Supplier payments made on time', '%', 95, 'higher', 1, 0.91, 0.04],
      ['internal', 'Days to close the month', 'days', 5, 'lower', 1, 0.84, 0.08],
      ['learning', 'Staff holding a professional qualification', '%', 70, 'higher', 1, 0.82, 0.02],
    ],
  },
  procurement: {
    name: 'Procurement',
    kpis: [
      ['financial', 'Contracts awarded within budget', '%', 100, 'higher', 1, 0.85, 0.05],
      ['customer', 'Requisitions fulfilled within lead time', '%', 90, 'higher', 2, 0.77, 0.06],
      ['internal', 'Average procurement cycle', 'days', 21, 'lower', 2, 0.73, 0.07],
      ['internal', 'Spend on approved contracts', '%', 85, 'higher', 1, 0.81, 0.04],
      ['learning', 'Staff trained on PPA 2020 compliance', '%', 100, 'higher', 1, 0.63, 0.04],
    ],
  },
  ict: {
    name: 'ICT',
    kpis: [
      ['financial', 'ICT spend within budget', '%', 100, 'higher', 1, 0.94, 0.03],
      ['customer', 'Help desk tickets resolved within SLA', '%', 90, 'higher', 2, 0.93, 0.04],
      ['internal', 'Core system uptime', '%', 99.5, 'higher', 2, 0.997, 0.003],
      ['internal', 'Security patches applied within 14 days', '%', 95, 'higher', 1, 0.87, 0.05],
      ['learning', 'Staff completing cyber-awareness training', '%', 100, 'higher', 1, 0.79, 0.05],
    ],
  },
  hr: {
    name: 'Human Resource',
    kpis: [
      ['financial', 'Payroll processed without errors', '%', 100, 'higher', 1, 0.975, 0.015],
      ['customer', 'Vacancies filled within 60 days', '%', 80, 'higher', 1, 0.69, 0.08],
      ['internal', 'Performance contracts signed', '%', 100, 'higher', 2, 0.72, 0.05],
      ['learning', 'Training plan delivered', '%', 90, 'higher', 2, 0.63, 0.06],
      ['learning', 'Staff certified in core competencies', '%', 10, 'higher', 1, 0.46, 0.06],
    ],
  },
  safety: {
    name: 'Safety',
    kpis: [
      ['financial', 'Insurance claims within limit', '%', 100, 'higher', 1, 0.97, 0.02],
      ['customer', 'Regulatory inspections passed', '%', 100, 'higher', 2, 0.98, 0.02],
      ['internal', 'Lost-time injury frequency rate', 'LTIFR', 0.5, 'lower', 2, 0.93, 0.08],
      ['internal', 'Safety drills held as scheduled', '%', 100, 'higher', 1, 0.93, 0.04],
      ['learning', 'Staff inducted in HSE procedures', '%', 100, 'higher', 1, 0.95, 0.02],
    ],
  },
  security: {
    name: 'Security',
    kpis: [
      ['financial', 'Asset losses within insured limit', '%', 100, 'higher', 1, 0.9, 0.05],
      ['customer', 'Security complaints resolved', '%', 95, 'higher', 1, 0.88, 0.05],
      ['internal', 'Access control compliance at depots', '%', 100, 'higher', 2, 0.85, 0.04],
      ['internal', 'CCTV coverage operational', '%', 98, 'higher', 1, 0.82, 0.05],
      ['learning', 'Guards trained in incident response', '%', 100, 'higher', 1, 0.71, 0.04],
    ],
  },
  productMonitoring: {
    name: 'Product Monitoring',
    kpis: [
      ['financial', 'Stock reconciliation within tolerance', '%', 100, 'higher', 1, 0.91, 0.04],
      ['customer', 'LSG loss within 0.2% target', '%', 100, 'higher', 2, 0.93, 0.04],
      ['customer', 'PMS loss within 0.4% target', '%', 100, 'higher', 2, 0.88, 0.05],
      ['internal', 'Samples meeting ISO 18/16/13', '%', 100, 'higher', 2, 0.75, 0.08],
      ['learning', 'Staff trained on real-time stock monitoring', '%', 80, 'higher', 1, 0.69, 0.05],
    ],
  },
}

// Small deterministic PRNG so the demo figures never change between loads.
function seededRandom(seedText) {
  let h = 2166136261
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619)
  return () => {
    h = (h + 0x6D2B79F5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function roundFor(unit, value) {
  if (unit === 'min' || unit === 'days') return Math.round(value * 10) / 10
  if (unit === 'LTIFR') return Math.round(value * 100) / 100
  return Math.round(value * 10) / 10
}

function buildActuals(seed, [, , unit, target, direction, , level, spread]) {
  const random = seededRandom(seed)
  const drift = (random() - 0.4) * 0.012 // most KPIs improve slightly through the year
  return MONTHS.map((_, month) => {
    if (month >= REPORTED_MONTHS) return null
    const noise = (random() + random() - 1) * spread
    const ratio = Math.max(0.3, level + drift * (month - 3.5) + noise)
    let actual = direction === 'lower' ? target / ratio : target * ratio
    if (unit === '%') actual = Math.min(actual, 100)
    return roundFor(unit, actual)
  })
}

export const departments = Object.entries(DEPARTMENT_KPIS).map(([id, dept]) => ({
  id,
  name: dept.name,
  kpis: dept.kpis.map((row, index) => {
    const [perspective, name, unit, target, direction, weight] = row
    return {
      code: `${id.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(2, '0')}`,
      perspective,
      name,
      unit,
      target,
      direction,
      weight,
      actuals: buildActuals(`${id}:${name}`, row),
    }
  }),
}))
