import { useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx'
import { StatusBadge } from '../../components/ui/StatusBadge.jsx'
import { InlineMessage } from '../../components/ui/InlineMessage.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { departments } from '../../data/scorecardData.js'
import { STATUS, listPendingForGM, listAllSubmissions, approveSubmission, returnSubmission } from '../../lib/kpiSubmissions.js'
import { useKpiSubmissionsVersion } from '../../lib/useKpiSubmissionsVersion.js'

const STATUS_TONE = {
  [STATUS.DRAFT]: 'neutral',
  [STATUS.SUBMITTED]: 'warning',
  [STATUS.RETURNED]: 'negative',
  [STATUS.APPROVED]: 'positive',
}

const STATUS_LABEL = {
  [STATUS.DRAFT]: 'Draft',
  [STATUS.SUBMITTED]: 'Submitted',
  [STATUS.RETURNED]: 'Returned',
  [STATUS.APPROVED]: 'Approved',
}

function departmentName(id) {
  return departments.find((d) => d.id === id)?.name ?? id
}

export default function KpiApprovals() {
  const { user } = useAuth()
  const version = useKpiSubmissionsVersion()
  const [selectedId, setSelectedId] = useState(null)
  const [comment, setComment] = useState('')
  const [message, setMessage] = useState(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run on version, which listPendingForGM reads via localStorage rather than as an argument
  const pending = useMemo(() => listPendingForGM(user), [user, version])
  const recent = useMemo(
    () => listAllSubmissions(user).filter((s) => s.status === STATUS.APPROVED || s.status === STATUS.RETURNED).slice(0, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same as above
    [user, version],
  )

  const selected = pending.find((s) => s.id === selectedId) ?? pending[0] ?? null
  const department = selected ? departments.find((d) => d.id === selected.departmentId) : null

  function handleApprove() {
    try {
      approveSubmission(selected.id, user, comment.trim() || null)
      setMessage({ tone: 'positive', text: `${departmentName(selected.departmentId)} · ${selected.period} approved and published.` })
      setComment('')
      setSelectedId(null)
    } catch (err) {
      setMessage({ tone: 'negative', text: err.message })
    }
  }

  function handleReturn() {
    try {
      returnSubmission(selected.id, user, comment.trim())
      setMessage({ tone: 'positive', text: `${departmentName(selected.departmentId)} · ${selected.period} returned for revision.` })
      setComment('')
      setSelectedId(null)
    } catch (err) {
      setMessage({ tone: 'negative', text: err.message })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">KPI approvals</h2>
        <p className="text-sm text-slate-500">{pending.length} submission{pending.length === 1 ? '' : 's'} awaiting review. Approving publishes the figures to that department's dashboard immediately.</p>
      </div>

      {message && <InlineMessage tone={message.tone}>{message.text}</InlineMessage>}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <Card>
          <CardHeader><CardTitle>Pending review</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {pending.length === 0 && <p className="text-xs text-slate-500">Nothing is waiting on you right now.</p>}
            {pending.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setSelectedId(s.id); setComment(''); setMessage(null) }}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selected?.id === s.id ? 'bg-[#FDECEC] text-[#B42318]' : 'hover:bg-slate-50 text-slate-700'}`}
              >
                <div className="font-semibold">{departmentName(s.departmentId)}</div>
                <div className="text-xs text-slate-500">{s.period} · submitted {new Date(s.updatedAt).toLocaleDateString()}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        {selected ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>{department?.name} · {selected.period}</CardTitle>
              <StatusBadge label={STATUS_LABEL[selected.status]} tone={STATUS_TONE[selected.status]} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="table-wrap">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>KPI</th>
                      <th className="numeric">Target</th>
                      <th className="numeric">Submitted actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {department.kpis.map((kpi) => (
                      <tr key={kpi.code}>
                        <td className="text-slate-800 min-w-[220px]">{kpi.name}</td>
                        <td className="numeric">{kpi.target} {kpi.unit}</td>
                        <td className="numeric font-semibold text-slate-800">
                          {selected.values[kpi.code] !== undefined && selected.values[kpi.code] !== '' ? `${selected.values[kpi.code]} ${kpi.unit}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                Review comment {' '}<span className="text-xs font-normal text-slate-400">(required to return, optional to approve)</span>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="Visible to the department as the GM's review comment — never a silent edit of their figures."
                />
              </label>

              <div className="flex items-center gap-3">
                <button type="button" onClick={handleApprove} className="rounded-lg bg-[#B42318] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a1d13]">
                  Approve & publish
                </button>
                <button type="button" onClick={handleReturn} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Return for revision
                </button>
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-2">
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">History</div>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  {selected.history.slice().reverse().map((entry, i) => (
                    <li key={i}>
                      <StatusBadge label={STATUS_LABEL[entry.status]} tone={STATUS_TONE[entry.status]} />{' '}
                      by {entry.by?.name} · {new Date(entry.at).toLocaleString()}
                      {entry.comment && <> — "{entry.comment}"</>}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent className="py-10 text-center text-sm text-slate-500">Select a submission to review it.</CardContent></Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Recent decisions</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-xs text-slate-500">No approvals or returns yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="dashboard-table">
                <thead>
                  <tr><th>Department</th><th>Period</th><th>Status</th><th>When</th></tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.id}>
                      <td className="text-slate-800">{departmentName(s.departmentId)}</td>
                      <td>{s.period}</td>
                      <td><StatusBadge label={STATUS_LABEL[s.status]} tone={STATUS_TONE[s.status]} /></td>
                      <td className="text-slate-500">{new Date(s.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
