import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx'
import {
  financialKPIs,
  customerKPIs,
  internalKPIs,
  learningKPIs,
  getHeatClass,
} from '../../data/kpiData.js'
import { PERSPECTIVE_BY_KEY } from '../../data/scorecardData.js'

const quarters = ['Q1', 'Q2', 'Q3', 'Q4']

// Year to date: average of the quarters that have been reported so far.
function ytdAverage(kpi) {
  const reported = quarters.map((q) => kpi.quarters[q]).filter((v) => v !== null && v !== undefined)
  return reported.length ? Math.round((reported.reduce((a, b) => a + b, 0) / reported.length) * 10) / 10 : null
}

function HeatCell({ value, thresholds }) {
  const cls = getHeatClass(value, thresholds)
  return (
    <td className={`py-2.5 px-3 text-center text-xs font-semibold border ${cls} rounded`}>
      {value === null || value === undefined ? 'N/A' : `${value}%`}
    </td>
  )
}

function KPISection({ title, kpis, accentColor }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ backgroundColor: accentColor }} />
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase w-1/2">KPI</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Target</th>
                {quarters.map((q) => (
                  <th key={q} className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">
                    {q}
                  </th>
                ))}
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">YTD avg</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((kpi) => (
                <tr key={kpi.name} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2.5 px-3 text-sm font-medium text-gray-800">{kpi.name}</td>
                  <td className="py-2.5 px-3 text-center text-xs font-semibold text-gray-500">
                    {kpi.target}%
                  </td>
                  {quarters.map((q) => (
                    <HeatCell key={q} value={kpi.quarters[q]} thresholds={kpi.thresholds} />
                  ))}
                  <HeatCell value={ytdAverage(kpi)} thresholds={kpi.thresholds} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

export default function KPIHeatmap() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Legend */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center gap-6">
            <span className="text-sm font-semibold text-gray-700">Heatmap Legend:</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded heat-green border" />
              <span className="text-xs text-gray-600">≥ 85% — On target</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded heat-yellow border" />
              <span className="text-xs text-gray-600">50–84% — Approaching target</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded heat-orange border" />
              <span className="text-xs text-gray-600">2–49% — Below target</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded heat-red border" />
              <span className="text-xs text-gray-600">0–1% — Poor performance</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded heat-na border" />
              <span className="text-xs text-gray-600">N/A — No data</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">
            Defaults shown above. Any KPI can override these cutoffs, or flip the scale for measures
            where lower is better, once its methodology is confirmed with the owning department.
          </p>
        </CardContent>
      </Card>

      <KPISection
        title="Financial KPIs"
        kpis={financialKPIs}
        accentColor={PERSPECTIVE_BY_KEY.financial.color}
      />
      <KPISection
        title="Customer KPIs"
        kpis={customerKPIs}
        accentColor={PERSPECTIVE_BY_KEY.customer.color}
      />
      <KPISection
        title="Internal Process KPIs"
        kpis={internalKPIs}
        accentColor={PERSPECTIVE_BY_KEY.internal.color}
      />
      <KPISection
        title="Learning & Growth KPIs"
        kpis={learningKPIs}
        accentColor={PERSPECTIVE_BY_KEY.learning.color}
      />
    </div>
  )
}
