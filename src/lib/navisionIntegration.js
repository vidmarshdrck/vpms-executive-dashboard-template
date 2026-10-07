// Navision -> integration layer -> Dashboard architecture (design + status document).
//
// STATUS: NOT IMPLEMENTED. This file describes the intended architecture so
// the codebase carries it forward; it does not connect to Navision. No
// function here talks to a real Navision instance, and nothing in the
// dashboard should be presented as "live from Navision" until this is
// replaced with a real integration and it has been tested against your
// organization's authorised Navision environment.
//
// ─────────────────────────────────────────────────────────────────────────
// Intended production flow (per the VPMS revision brief, section 14–17):
//
//   Department -> HOD -> Microsoft Navision -> GM review/approval
//     -> Navision Integration/API -> integration/ingestion service
//     -> Canonical KPI data model -> KPI calculation/validation
//     -> Dashboard API -> VPMS Dashboard (this app)
//
// The dashboard frontend must only ever talk to the Dashboard API layer below —
// never to Navision directly. That keeps the source system swappable
// (Excel today, Navision tomorrow) without a UI rewrite.
//
// ─────────────────────────────────────────────────────────────────────────
// Canonical KPI data model (section 17 — data provenance).
//
// Every KPI record the dashboard renders should eventually carry:
//
//   {
//     kpi: string,               // e.g. "ROCE"
//     department: string,        // owning department
//     period: { type: 'monthly' | 'quarterly' | 'weekly', label: string },
//     target: number,
//     actual: number,
//     thresholds?: KpiThresholds,     // see src/lib/kpiThresholds.js
//     source: 'excel' | 'navision',
//     sourceRef: string,          // e.g. workbook name, Navision doc/entry no.
//     lastUpdated: string,        // ISO timestamp
//     syncedAt: string,           // ISO timestamp of ingestion into the dashboard backend
//     responsibleHod?: string,
//   }
//
// src/data/kpiData.js currently stores plain { name, target, quarters }
// shapes without this envelope — it has not been migrated to the canonical
// model yet, because doing so with fabricated provenance fields would
// violate the "do not invent data" requirement. Migrating requires either
// (a) backfilling real provenance for the existing Excel-sourced figures, or
// (b) a fresh import once Navision is connected.
//
// ─────────────────────────────────────────────────────────────────────────
// What needs to exist before a real Navision integration can be built:
//
// 1. Confirmation of the Navision deployment's integration surface —
//    Business Central API (OData v4 / ODataV4 pages), on-prem NAV web
//    services (SOAP/OData), or a custom middleware export. This has not
//    been inspected/confirmed in this revision; it requires access to (or
//    documentation of) your organization's actual Navision instance.
// 2. An authorised service account / API key scoped to the relevant
//    KPI-bearing entities in Navision.
// 3. An ingestion service (backend, not in this frontend repo) that
//    pulls or receives pushed data from Navision, maps it onto the
//    canonical KPI model above, and exposes it via a dashboard API.
// 4. This dashboard swapping its data import from `src/data/kpiData.js`
//    to fetch calls against that dashboard API.
//
// None of steps 1–4 exist yet. This file exists so the intended shape is
// documented in the codebase rather than only in the requirements doc.

export const NAVISION_INTEGRATION_STATUS = 'not_implemented'

export async function fetchKpiDataFromNavision() {
  throw new Error(
    'Navision integration is not implemented. Do not call this in production code paths — ' +
    'the dashboard currently reads from src/data/kpiData.js (Excel-sourced import).'
  )
}
