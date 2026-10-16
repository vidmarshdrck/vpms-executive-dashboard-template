import { useMemo, useState } from 'react'
import { DepartmentEntryBook } from '../../components/ui/EntryBooks.jsx'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx'
import { StatusBadge } from '../../components/ui/StatusBadge.jsx'
import { InlineMessage } from '../../components/ui/InlineMessage.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { departments } from '../../data/scorecardData.js'
import { QUARTERS, quarterOfDate } from '../../lib/reportingPeriod.js'
import { useKpiSetup } from '../../lib/useKpiSetup.js'
import { kpiPeriod, periodLabel, submissionValues } from '../../lib/kpiSetup.js'
import { useEntryBooks } from '../../lib/useEntryBooks.js'
import { STATUS, createDraft, saveDraft, submitForReview, listSubmissionsForDepartment, getPublishedKpiValue } from '../../lib/kpiSubmissions.js'
import { useKpiSubmissionsVersion } from '../../lib/useKpiSubmissionsVersion.js'
const STATUS_TONE = { DRAFT: 'neutral', SUBMITTED: 'warning', RETURNED: 'negative', APPROVED: 'positive' }
const STATUS_LABEL = { DRAFT: 'Draft', SUBMITTED: 'Awaiting review', RETURNED: 'Returned', APPROVED: 'Approved & published' }
const control = 'min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
export default function KpiEntry() {
  const { user } = useAuth(), setup = useKpiSetup()
  const department = departments.find(item => item.id === user.departmentId)
  const [selected, setSelected] = useState(() => {
    const current = kpiPeriod(new Date().getFullYear(), quarterOfDate())
    const activations = Object.values(setup.activations).filter(item => item.departmentId === user.departmentId).sort((a, b) => b.period.localeCompare(a.period))
    return activations.find(item => item.period === current)?.period || activations[0]?.period || current
  })
  const [year, quarter] = selected.split('-')
  const activation = setup.activations[`${department.id}::${selected}`]
  const years = [...new Set([new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1, ...Object.values(setup.activations).map(item => item.year)])].sort((a, b) => a - b)
  return <div className="space-y-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-lg font-semibold text-slate-900">KPI entry · {department.name}</h2><p className="mt-1 text-sm text-slate-600">Enter actuals for the KPIs activated by the GM, then submit for review.</p></div><div className="flex flex-wrap gap-3"><label className="text-sm text-slate-700">Year<select aria-label="KPI entry year" value={year} onChange={event => setSelected(kpiPeriod(event.target.value, quarter))} className={`${control} ml-2`}>{years.map(item => <option key={item}>{item}</option>)}</select></label><label className="text-sm text-slate-700">Quarter<select aria-label="KPI entry quarter" value={quarter} onChange={event => setSelected(kpiPeriod(year, event.target.value))} className={`${control} ml-2`}>{QUARTERS.map(item => <option key={item}>{item}</option>)}</select></label></div></div>
    <DepartmentEntryBook />
    <InlineMessage tone="negative">{setup.error}</InlineMessage>
    {activation ? <KpiEntryPeriod key={`${department.id}:${selected}:${activation.id}`} user={user} department={department} activation={activation} /> : <Card><CardHeader><CardTitle>{periodLabel(selected)} · KPI figures</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-600">The GM has not activated KPIs for {department.name} in this quarter. Once activated, the assigned KPIs and targets will appear here.</p></CardContent></Card>}
  </div>
}
function KpiEntryPeriod({ user, department, activation }) {
  const period = activation.period
  const [initial] = useState(() => { try { const history = listSubmissionsForDepartment(user, department.id).filter(item => item.period === period); return { submission: history[0] || createDraft(user, department.id, period), error: '' } } catch (error) { return { submission: null, error: error.message } } })
  const [draft, setDraft] = useState(initial.submission), [values, setValues] = useState(initial.submission?.values || {}), [message, setMessage] = useState(null)
  const version = useKpiSubmissionsVersion(), books = useEntryBooks()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version subscribes to persisted submission changes
  const history = useMemo(() => listSubmissionsForDepartment(user, department.id).filter(item => item.period === period), [user, department.id, period, version])
  const submission = history.find(item => item.id === draft?.id) || draft
  if (!submission) return <InlineMessage tone="negative">{initial.error}</InlineMessage>
  const editable = [STATUS.DRAFT, STATUS.RETURNED].includes(submission.status)
  let displayed = editable ? values : submission.values, sourceError = books.error
  if (editable && !sourceError) { try { displayed = submissionValues(activation.kpis, values, period) } catch (error) { sourceError = error.message } }
  function save(submit) {
    try { const saved = saveDraft(submission.id, values, user); setDraft(submit ? submitForReview(saved.id, user) : saved); setMessage({ tone: 'positive', text: submit ? 'Submitted for review.' : 'Draft saved.' }) }
    catch (error) { setMessage({ tone: 'negative', text: error.message }) }
  }
  function revise() { try { const next = createDraft(user, department.id, period); setDraft(next); setValues(next.values); setMessage(null) } catch (error) { setMessage({ tone: 'negative', text: error.message }) } }
  return <><Card><CardHeader className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{periodLabel(period)} · KPI figures</CardTitle><p className="mt-1 text-xs text-slate-600">Targets fixed by this quarter’s activation. Enter every assigned actual; automatic values come from approved books.</p></div><StatusBadge label={STATUS_LABEL[submission.status]} tone={STATUS_TONE[submission.status]} /></CardHeader><CardContent className="space-y-4">
    {submission.reviewComment && <InlineMessage tone={submission.status === STATUS.RETURNED ? 'negative' : 'neutral'}><strong>Comment:</strong> {submission.reviewComment}</InlineMessage>}
    {message && <InlineMessage tone={message.tone}>{message.text}</InlineMessage>}
    <InlineMessage tone="negative">{sourceError}</InlineMessage>
    {!editable && <p className="text-sm text-slate-600">{submission.status === STATUS.APPROVED ? 'These figures are approved. Start a revision to propose a correction.' : 'These figures are awaiting review and cannot be edited.'}</p>}
    <div className="table-wrap"><table className="dashboard-table"><thead><tr><th>KPI</th><th className="numeric">Target</th><th className="numeric">Published</th><th className="numeric">Actual</th></tr></thead><tbody>{activation.kpis.map(kpi => {
      const published = getPublishedKpiValue(department.id, kpi.code, period), automatic = kpi.source !== 'manual'
      return <tr key={kpi.code}><td className="min-w-56 text-slate-800">{kpi.name}<p className="text-xs text-slate-500">{kpi.direction === 'lower' ? 'Lower' : 'Higher'} is better{automatic ? ' · From approved book' : ''}</p></td><td className="numeric">{kpi.target} {kpi.unit}</td><td className="numeric text-slate-500">{published ? `${published.value} ${kpi.unit}` : '—'}</td><td className="numeric"><input aria-label={`Actual ${kpi.name}`} type="number" min={0} step="any" readOnly={automatic} disabled={!editable} value={displayed[kpi.code] ?? ''} onChange={event => setValues(current => ({ ...current, [kpi.code]: event.target.value }))} placeholder={automatic ? 'No approved figures' : '—'} className={`min-h-10 w-36 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm disabled:bg-slate-50 ${automatic ? 'bg-slate-50' : 'bg-white'}`} /></td></tr>
    })}</tbody></table></div>
    {editable && <div className="flex flex-wrap gap-3"><button type="button" disabled={Boolean(sourceError)} onClick={() => save(false)} className={`${control} font-semibold text-slate-700`}>Save draft</button><button type="button" disabled={Boolean(sourceError)} onClick={() => save(true)} className="min-h-11 rounded-lg bg-[#1E4DFF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Submit</button></div>}
    {submission.status === STATUS.APPROVED && <button type="button" onClick={revise} className={`${control} font-semibold text-slate-700`}>Start revision</button>}
  </CardContent></Card><Card><CardHeader><CardTitle>Status history · {periodLabel(period)}</CardTitle></CardHeader><CardContent>{!history.length ? <p className="text-sm text-slate-600">No submissions yet.</p> : <ul className="space-y-3">{history.flatMap(item => item.history.map((entry, index) => <li key={`${item.id}:${index}`} className="text-xs text-slate-600"><StatusBadge label={STATUS_LABEL[entry.status]} tone={STATUS_TONE[entry.status]} /> {entry.by?.name} · {new Date(entry.at).toLocaleString()}{entry.comment && ` · ${entry.comment}`}</li>)).reverse()}</ul>}</CardContent></Card></>
}
