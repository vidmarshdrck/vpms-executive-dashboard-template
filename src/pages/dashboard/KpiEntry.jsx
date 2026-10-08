import { useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx'
import { StatusBadge } from '../../components/ui/StatusBadge.jsx'
import { InlineMessage } from '../../components/ui/InlineMessage.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { departments, REPORTED_MONTHS } from '../../data/scorecardData.js'
import { QUARTERS, monthIndexToQuarter } from '../../lib/reportingPeriod.js'
import {
  STATUS, createDraft, saveDraft, submitForReview, listSubmissionsForDepartment, getPublishedKpiValue,
} from '../../lib/kpiSubmissions.js'
import { useKpiSubmissionsVersion } from '../../lib/useKpiSubmissionsVersion.js'

// Default to the quarter the organization's own reporting clock is
// currently in, not the real-world calendar quarter: the department
// scorecard pages only ever show the months scorecardData.js marks as
// reported (REPORTED_MONTHS), independent of today's date (see
// DepartmentScorecards.jsx). Defaulting here to that same quarter means a
// newly-approved submission is visible on the dashboard immediately instead
// of landing in a quarter the scorecard views don't render yet.
const DEFAULT_PERIOD = monthIndexToQuarter(REPORTED_MONTHS - 1)

const STATUS_TONE = {
  [STATUS.DRAFT]: 'neutral',
  [STATUS.SUBMITTED]: 'warning',
  [STATUS.RETURNED]: 'negative',
  [STATUS.APPROVED]: 'positive',
}

const STATUS_LABEL = {
  [STATUS.DRAFT]: 'Draft',
  [STATUS.SUBMITTED]: 'Submitted · awaiting GM review',
  [STATUS.RETURNED]: 'Returned for revision',
  [STATUS.APPROVED]: 'Approved & published',
}

export default function KpiEntry() {
  const { user } = useAuth()
  const department = departments.find((d) => d.id === user.departmentId)
  const [period, setPeriod] = useState(DEFAULT_PERIOD)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">KPI entry · {department.name}</h2>
          <p className="text-sm text-slate-500">Enter this department's actual KPI figures, then submit them to the GM for approval.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Reporting period
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
          >
            {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </label>
      </div>

      {/* Keyed by (department, period): switching period mounts a fresh
          instance so its draft loads from lazy initial state rather than an
          effect reaching back to setState after mount. */}
      <KpiEntryPeriod key={`${department.id}:${period}`} user={user} department={department} period={period} />
    </div>
  )
}

function KpiEntryPeriod({ user, department, period }) {
  const [submission, setSubmission] = useState(() => createDraft(user, department.id, period))
  const [values, setValues] = useState(() => submission.values)
  const [message, setMessage] = useState(null)
  const version = useKpiSubmissionsVersion()

  const history = useMemo(
    () => listSubmissionsForDepartment(user, department.id).filter((s) => s.period === period),
    // `version` intentionally included so another tab's approve/return shows up here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, department.id, period, version],
  )

  const editable = submission.status === STATUS.DRAFT || submission.status === STATUS.RETURNED

  function updateValue(code, raw) {
    setValues((prev) => ({ ...prev, [code]: raw }))
  }

  function handleSave() {
    try {
      const saved = saveDraft(submission.id, values, user)
      setSubmission(saved)
      setMessage({ tone: 'positive', text: 'Draft saved.' })
    } catch (err) {
      setMessage({ tone: 'negative', text: err.message })
    }
  }

  function handleSubmit() {
    try {
      saveDraft(submission.id, values, user)
      const submitted = submitForReview(submission.id, user)
      setSubmission(submitted)
      setMessage({ tone: 'positive', text: 'Submitted for GM review.' })
    } catch (err) {
      setMessage({ tone: 'negative', text: err.message })
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>{period} figures</CardTitle>
          <StatusBadge label={STATUS_LABEL[submission.status]} tone={STATUS_TONE[submission.status]} />
        </CardHeader>
        <CardContent className="space-y-4">
          {submission.status === STATUS.RETURNED && submission.reviewComment && (
            <InlineMessage tone="negative">
              <strong>GM comment:</strong> {submission.reviewComment}
            </InlineMessage>
          )}
          {!editable && (
            <InlineMessage tone={submission.status === STATUS.APPROVED ? 'positive' : 'neutral'}>
              {submission.status === STATUS.APPROVED
                ? 'This period has been approved and published. Submitting again will start a new revision for GM review.'
                : 'This submission is awaiting GM review and can no longer be edited.'}
            </InlineMessage>
          )}
          {message && <InlineMessage tone={message.tone}>{message.text}</InlineMessage>}

          <div className="table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>KPI</th>
                  <th className="numeric">Target</th>
                  <th className="numeric">Published</th>
                  <th className="numeric">Actual ({period})</th>
                </tr>
              </thead>
              <tbody>
                {department.kpis.map((kpi) => {
                  const published = getPublishedKpiValue(department.id, kpi.code, period)
                  return (
                    <tr key={kpi.code}>
                      <td className="text-slate-800 min-w-[220px]">
                        {kpi.name}
                        {kpi.direction === 'lower' && <span className="ml-1.5 text-[10.5px] text-slate-500 whitespace-nowrap">↓ lower is better</span>}
                      </td>
                      <td className="numeric">{kpi.target} {kpi.unit}</td>
                      <td className="numeric text-slate-500">{published ? `${published.value} ${kpi.unit}` : '—'}</td>
                      <td className="numeric">
                        <input
                          type="number"
                          step="any"
                          disabled={!editable}
                          value={values[kpi.code] ?? ''}
                          onChange={(e) => updateValue(kpi.code, e.target.value)}
                          placeholder="—"
                          className="w-28 rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-sm disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {editable && (
            <div className="flex items-center gap-3 pt-2">
              <button type="button" onClick={handleSave} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Save draft
              </button>
              <button type="button" onClick={handleSubmit} className="rounded-lg bg-[#B42318] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a1d13]">
                Submit for GM review
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Status history · {period}</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 || history[0].history.length === 0 ? (
            <p className="text-xs text-slate-500">No activity recorded yet for this period.</p>
          ) : (
            <ul className="space-y-2 text-xs text-slate-600">
              {history[0].history.slice().reverse().map((entry, i) => (
                <li key={i} className="flex items-start gap-2">
                  <StatusBadge label={STATUS_LABEL[entry.status]} tone={STATUS_TONE[entry.status]} />
                  <span>
                    by {entry.by?.name} ({entry.by?.role}) · {new Date(entry.at).toLocaleString()}
                    {entry.comment && <> — "{entry.comment}"</>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}
