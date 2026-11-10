import { useEffect, useState } from 'react'
import SlideTabs from './SlideTabs.jsx'
import { PageFooter } from './Donut.jsx'
import { StandardBudget, StandardFunds, StandardMarketing, StandardOverview } from './businessPanels.jsx'
import { adapterFor, buildAdapterModel, fetchBusinessWorkspace } from './businessSources.js'
import { todayIso } from './veData.js'

export default function BusinessWorkspace({ business, token = '', model = null, today, loadWorkspace, extraTabs = [], extraPages = [] }) {
  const clock = today || todayIso()
  const [remote, setRemote] = useState(null)
  const [stamp, setStamp] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (model != null || !token) return undefined
    let cancelled = false
    const run = loadWorkspace || ((accessToken) => fetchBusinessWorkspace({ businessId: business.id, token: accessToken, today: clock, env: import.meta.env }))
    run(token).then((next) => {
      if (!cancelled) { setRemote(next); setStamp(token); setFailed(false) }
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [model, token, clock, loadWorkspace, business.id])
  const signedOut = buildAdapterModel(business.id, Object.fromEntries((adapterFor(business.id).reads || []).map((item) => [item.key, { access: 'signed-out', rows: [], message: '' }])), clock)
  const data = model || (!token ? signedOut : (stamp === token ? remote : null))
  if (!data && !failed) return <div className="wrap biz"><p className="empty" role="status">Loading records.</p><PageFooter /></div>
  if (!data) return <div className="wrap biz"><p className="empty" role="status">Could not load these records.</p><PageFooter /></div>
  const tabs = ['Overview', 'Funds', 'Marketing', 'Budget', ...extraTabs]
  return (
    <div className="wrap biz">
      <div className="topbar"><div><p className="brand-eyebrow">{business?.code || business?.id}</p><h1>{business?.name || 'Business'}</h1></div></div>
      <SlideTabs label="Business sections" tabs={tabs}>
        {[
          <div key="overview"><StandardOverview model={data} /></div>,
          <div key="funds"><StandardFunds model={data} /></div>,
          <div key="marketing"><StandardMarketing model={data} /></div>,
          <div key="budget"><StandardBudget model={data} /></div>,
          ...extraPages,
        ]}
      </SlideTabs>
      <PageFooter />
    </div>
  )
}
