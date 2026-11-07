import { QUARTERS, ragFor, ragLabel, departmentCoverage } from './score.js'
import { Donut, ScoreGauge, PageFooter } from './Donut.jsx'

function Trend({ model }) {
  const width = 600
  const height = 270
  const left = 44
  const right = 16
  const top = 14
  const bottom = 32
  const innerW = width - left - right
  const innerH = height - top - bottom
  const max = 150
  const x = (index) => left + innerW * (index / 3)
  const y = (value) => top + innerH * (1 - Math.min(value, max) / max)
  const series = [
    ...model.perspectives.map((perspective) => ({ name: perspective.label, color: perspective.color, values: perspective.q, width: 2.6 })),
    { name: 'Overall', color: 'var(--text-primary)', values: model.overallQ, width: 3.6 },
  ]
  const any = series.some((item) => item.values.some((value) => value != null))
  if (!any) return <p className="empty">No quarterly actuals recorded yet.</p>
  return (
    <>
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Achievement percentage by quarter for each perspective">
        {[0, 50, 100, 150].map((mark) => <g key={mark}><line x1={left} x2={width - right} y1={y(mark)} y2={y(mark)} stroke={mark === 100 ? 'var(--text-muted)' : 'var(--chart-grid)'} strokeWidth={mark === 100 ? 1.4 : 1} strokeDasharray={mark === 100 ? '5 4' : undefined} /><text x={left - 8} y={y(mark) + 4} fontSize="10.5" textAnchor="end">{mark}%</text></g>)}
        {QUARTERS.map((quarter, index) => <text key={quarter} x={x(index)} y={height - 10} fontSize="11.5" fontWeight="700" textAnchor="middle">{quarter}</text>)}
        {series.map((item) => {
          const points = item.values.flatMap((value, index) => value == null ? [] : [[x(index), y(value), value, index]])
          if (!points.length) return null
          return (
            <g key={item.name}>
              {points.length > 1 && <path d={`M${points.map((point) => point.slice(0, 2).join(',')).join(' L')}`} fill="none" stroke={item.color} strokeWidth={item.width} strokeLinecap="round" strokeLinejoin="round" />}
              {points.map((point) => <circle key={point[3]} cx={point[0]} cy={point[1]} r={item.width + 1.4} fill="#fff" stroke={item.color} strokeWidth="2.2"><title>{`${item.name} · ${QUARTERS[point[3]]}: ${Math.round(point[2])}%`}</title></circle>)}
            </g>
          )
        })}
      </svg>
      <div className="lg">{series.map((item) => <span key={item.name}><i className="dot" style={{ background: item.color }} />{item.name}</span>)}</div>
    </>
  )
}

function Radar({ model }) {
  if (model.perspectives.every((perspective) => perspective.perf == null)) return <p className="empty">No quarterly actuals recorded yet.</p>
  const cx = 150
  const cy = 135
  const radius = 92
  const count = model.perspectives.length
  const point = (index, value) => {
    const angle = -Math.PI / 2 + 2 * Math.PI * index / count
    const span = radius * Math.min(value, 150) / 150
    return [cx + span * Math.cos(angle), cy + span * Math.sin(angle)]
  }
  return (
    <>
      <svg className="chart-svg" viewBox="0 0 300 270" role="img" aria-label="Radar of perspective performance">
        {[50, 100, 150].map((mark) => <polygon key={mark} points={model.perspectives.map((_, index) => point(index, mark).join(',')).join(' ')} fill="none" stroke={mark === 100 ? 'var(--text-muted)' : 'var(--chart-grid)'} strokeWidth={mark === 100 ? 1.4 : 1} strokeDasharray={mark === 100 ? '4 3' : undefined} />)}
        {model.perspectives.map((perspective, index) => {
          const end = point(index, 150)
          const label = point(index, 180)
          return <g key={perspective.name}><line x1={cx} y1={cy} x2={end[0]} y2={end[1]} stroke="var(--chart-grid)" /><text x={label[0]} y={label[1]} fontSize="11" fontWeight="600" textAnchor={Math.abs(label[0] - cx) < 8 ? 'middle' : label[0] > cx ? 'start' : 'end'}>{perspective.label}</text></g>
        })}
        <polygon points={model.perspectives.map((perspective, index) => point(index, perspective.perf || 0).join(',')).join(' ')} fill="rgba(20,84,192,.18)" stroke="var(--brand)" strokeWidth="2.4" strokeLinejoin="round" />
        {model.perspectives.map((perspective, index) => {
          const spot = point(index, perspective.perf || 0)
          return <circle key={perspective.name} cx={spot[0]} cy={spot[1]} r="4.5" fill={perspective.color} stroke="#fff" strokeWidth="1.8"><title>{`${perspective.label}: ${perspective.perf == null ? 'no data' : `${Math.round(perspective.perf)}%`}`}</title></circle>
        })}
      </svg>
      <div className="lg"><span><i className="dot" style={{ background: 'var(--brand)' }} />Actual</span><span><i className="dot" style={{ background: 'var(--text-muted)' }} />100% target ring</span></div>
    </>
  )
}

function ragColor(rag) {
  if (rag === 'amber') return '#D69E2E'
  if (rag === 'green') return 'var(--rag-green)'
  if (rag === 'red') return 'var(--rag-red)'
  return 'var(--rag-na)'
}

export default function GmDashboard({ model, scorecard, viewOnly }) {
  const reported = model.kpis.filter((kpi) => kpi.latest != null)
  const coverage = departmentCoverage(scorecard.kpis, scorecard.departments)
  const maxTracked = Math.max(1, ...coverage.map((department) => department.tracked))
  const statusItems = [
    { name: 'On target', value: model.status.green, color: 'var(--rag-green)' },
    { name: 'Near target', value: model.status.amber, color: '#D69E2E' },
    { name: 'Off target', value: model.status.red, color: 'var(--rag-red)' },
    { name: 'No data yet', value: model.status.na, color: '#CBD5E1' },
  ]
  const perspectiveItems = model.perspectives.map((perspective) => ({ name: perspective.label, value: perspective.total, color: perspective.color }))
  return (
    <div className="wrap gm">
      <div className="topbar">
        <div>
          <p className="brand-eyebrow">Vidmar Holdings · General Manager</p>
          <h1>GM Dashboard{viewOnly && <span className="view-only">View only</span>}</h1>
          <p className="sub">Balanced Scorecard · {model.year}</p>
        </div>
        <div className="legend" aria-label="Performance status legend">
          <span><i className="dot" style={{ background: 'var(--rag-green)' }} />On target (≥100%)</span>
          <span><i className="dot" style={{ background: 'var(--rag-amber)' }} />Near target (90–99%)</span>
          <span><i className="dot" style={{ background: 'var(--rag-red)' }} />Off target (&lt;90%)</span>
          <span><i className="dot" style={{ background: 'var(--rag-na)' }} />No data</span>
        </div>
      </div>
      <div className="kpi-strip">
        <div className="tile" style={{ '--t': 'var(--brand)' }}><div className="lab">Overall score</div><div className="val">{model.overall == null ? '—' : `${Math.round(model.overall)}%`}</div><div className="foot">avg. of perspectives with data</div></div>
        <div className="tile" style={{ '--t': 'var(--teal)' }}><div className="lab">GM KPIs tracked</div><div className="val">{model.stats.tracked}</div><div className="foot">of {model.stats.totalKpis} in the strategy</div></div>
        <div className="tile" style={{ '--t': 'var(--green)' }}><div className="lab">Reporting actuals</div><div className="val">{model.stats.reporting}</div><div className="foot">{model.stats.onTarget} currently on target</div></div>
        <div className="tile" style={{ '--t': 'var(--violet)' }}><div className="lab">Departments tracked</div><div className="val">{coverage.length}</div><div className="foot">with KPI targets set</div></div>
        <div className="tile" style={{ '--t': 'var(--orange)' }}><div className="lab">Active objectives</div><div className="val">{model.stats.objectives}</div><div className="foot">across 4 perspectives</div></div>
      </div>
      <div className="hero">
        <section className="card"><div className="card-body"><ScoreGauge pct={model.overall} caption="Overall balanced scorecard" /></div></section>
        <div className="grid-4">
          {model.perspectives.map((perspective) => {
            const rag = perspective.perf == null ? 'na' : ragFor(perspective.perf)
            return (
              <div key={perspective.name} className="persp-card" style={{ '--persp': perspective.color }}>
                <div className="persp-head"><span className="persp-dot" />{perspective.label}</div>
                <div className="persp-value">{perspective.perf == null ? '—' : `${Math.round(perspective.perf)}%`}</div>
                <div className="persp-track"><i style={{ width: `${perspective.perf == null ? 0 : Math.min(100, perspective.perf)}%`, background: `var(--rag-${rag})` }} /></div>
                <div className="persp-foot"><span className={`chip ${rag}`}>{ragLabel(rag)}</span><span>{perspective.reporting}/{perspective.total} KPIs reporting</span></div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="two">
        <section className="card accent-violet"><div className="card-head"><h2>Performance trend by quarter</h2></div><div className="card-body"><Trend model={model} /></div></section>
        <section className="card accent-teal"><div className="card-head"><h2>Perspective balance</h2></div><div className="card-body"><Radar model={model} /></div></section>
      </div>
      <div className="two">
        <section className="card accent-orange">
          <div className="card-head"><h2>KPI heat grid · quarterly achievement</h2></div>
          <div className="card-body">
            {reported.length ? (
              <div className="hm" style={{ gridTemplateColumns: 'minmax(150px, 1fr) repeat(4, 62px)' }}>
                <div />
                {QUARTERS.map((quarter) => <div key={quarter} className="hh">{quarter}</div>)}
                {reported.map((kpi) => (
                  <HeatRow key={kpi.id} kpi={kpi} />
                ))}
              </div>
            ) : <p className="empty">No KPI actuals have been recorded yet.</p>}
          </div>
        </section>
        <section className="card accent-green">
          <div className="card-head"><h2>Status mix & strategy coverage</h2></div>
          <div className="card-body">
            {model.stats.tracked ? <Donut items={statusItems} center="GM KPIs" format={(value) => String(value)} /> : <p className="empty">No KPI actuals have been recorded yet.</p>}
            <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '18px 0' }} />
            <Donut items={perspectiveItems} center="strategy KPIs" format={(value) => String(value)} />
          </div>
        </section>
      </div>
      <section className="card accent-magenta" style={{ marginBottom: 18 }}>
        <div className="card-head"><h2>KPI performance · latest quarter vs target</h2><span className="stat-desc" style={{ margin: 0, fontSize: 12 }}>Black marker = 100% of target</span></div>
        <div className="card-body">
          {reported.length ? [...reported].sort((a, b) => a.latest - b.latest).map((kpi) => {
            const rag = ragFor(kpi.latest)
            const quarter = kpi.q[kpi.latestQ]
            return (
              <div className="bul" key={kpi.id}>
                <div><div className="nm">{kpi.name}</div><div className="pn">{model.perspectives[kpi.p].label} · {QUARTERS[kpi.latestQ]} · target {quarter.t ?? '—'} · actual {quarter.a ?? '—'}{kpi.dir === 'LOWER_BETTER' ? ' · lower is better' : ''}</div></div>
                <div className="track"><div className="fill" style={{ width: `${kpi.latest / 150 * 100}%`, background: ragColor(rag) }} /><div className="mark" style={{ left: `${100 / 150 * 100}%` }} /></div>
                <div className="pv" style={{ color: ragColor(rag) }}>{Math.round(kpi.latest)}%</div>
              </div>
            )
          }) : <p className="empty">No KPI actuals have been recorded yet.</p>}
        </div>
      </section>
      <section className="card accent-yellow">
        <div className="card-head"><h2>Department KPI coverage</h2></div>
        <div className="card-body">
          {coverage.length ? coverage.map((department) => (
            <div className="dep" key={department.code}>
              <div className="dn">{department.name}</div>
              <div className="track">
                <div className="fill trk" style={{ width: `${department.tracked / maxTracked * 100}%` }} />
                <div className="fill rep" style={{ width: `${department.reporting / maxTracked * 100}%` }} />
              </div>
              <div className="dv">{department.reporting} / {department.tracked}</div>
            </div>
          )) : <p className="empty">No department KPI targets found.</p>}
          <div className="lg"><span><i className="dot" style={{ background: 'var(--rag-green)' }} />KPIs reporting actuals</span><span><i className="dot" style={{ background: '#CBD5E1' }} />KPIs with targets only</span></div>
        </div>
      </section>
      <PageFooter>Achievement = actual ÷ target (target ÷ actual for lower-is-better KPIs), capped at 150%. Thresholds: green ≥ 100%, amber 90–99%, red &lt; 90%.{viewOnly ? ' You are signed in with view-only access.' : ''}</PageFooter>
    </div>
  )
}

function HeatRow({ kpi }) {
  const label = kpi.name.length > 46 ? `${kpi.name.slice(0, 44)}…` : kpi.name
  return (
    <>
      <div className="hn" title={kpi.name}>{label}</div>
      {kpi.q.map((cell, index) => {
        const pct = cell?.p
        const rag = pct == null ? 'na' : ragFor(pct)
        return <div key={QUARTERS[index]} className={`cell ${rag}`} title={`${kpi.name} · ${QUARTERS[index]}`}>{pct == null ? '–' : `${Math.round(pct)}%`}</div>
      })}
    </>
  )
}
