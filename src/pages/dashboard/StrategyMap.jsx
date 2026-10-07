import { Card, CardContent } from '../../components/ui/Card.jsx'
import { DataStatus } from '../../components/ui/StatusBadge.jsx'
import { PERSPECTIVE_BY_KEY, strategyMap } from '../../data/scorecardData.js'
import { companyInfo } from '../../data/kpiData.js'
import { ArrowUp, Info } from 'lucide-react'

// Classic strategy-map order: financial at the top, learning & growth at the
// base. Arrows point upward, as the workbook specifies: learning and growth
// enables internal processes, which serve customers, which deliver the
// financial result.
const readingOrder = ['financial', 'customer', 'internal', 'learning']

function Measure({ measure, years }) {
  return (
    <div className="py-2.5 border-t border-slate-100 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-2 text-[13px] text-slate-800">
        <span className="flex-1">{measure.name}</span>
        {measure.direction === 'lower' && <span className="text-[10.5px] text-slate-500 whitespace-nowrap mt-0.5">↓ lower is better</span>}
      </div>
      <ol className="mt-2 grid grid-cols-5 gap-1" aria-label="Five-year targets">
        {measure.targets.map((target, i) => (
          <li key={years[i]} className={`rounded-md px-1.5 py-1 text-center ${target ? 'bg-slate-50' : 'bg-transparent border border-dashed border-slate-200'}`}>
            <div className="text-[9.5px] uppercase tracking-wide text-slate-400">{years[i]}</div>
            <div className={`text-[12px] font-semibold tabular-nums ${target ? 'text-slate-800' : 'text-slate-300'}`}>{target || '—'}</div>
          </li>
        ))}
      </ol>
      {measure.note && <p className="flex gap-1.5 text-[11px] text-slate-500 mt-1.5"><Info size={12} className="mt-0.5 shrink-0" />{measure.note}</p>}
    </div>
  )
}

export default function StrategyMap() {
  const perspectives = readingOrder.map((key) => ({ ...strategyMap.perspectives.find((p) => p.key === key), meta: PERSPECTIVE_BY_KEY[key] }))

  return (
    <div className="space-y-5 animate-fade-in">
      <section className="vpms-gradient rounded-xl p-5 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#B42318] mb-2">Strategy map · {companyInfo.shortName}</p>
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900 leading-snug max-w-3xl text-balance">{strategyMap.vision}</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-3xl text-pretty">
          Every objective, its measures, the five-year target path and the initiatives that deliver it, grouped by Balanced Scorecard perspective.
        </p>
        <div className="mt-3"><DataStatus source="Strategic plan workbook · Balanced Scorecard" isProvisional={companyInfo.dataIsProvisional} /></div>
      </section>

      {perspectives.map((perspective, index) => (
        <div key={perspective.key}>
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100" style={{ boxShadow: `inset 3px 0 0 ${perspective.meta.color}` }}>
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: perspective.meta.color }} aria-hidden="true" />
              <h3 className="card-title">{perspective.meta.name}</h3>
              <span className="ml-auto text-[11px] text-slate-500 tabular-nums">
                {perspective.objectives.length} {perspective.objectives.length === 1 ? 'objective' : 'objectives'} · weight {perspective.meta.weight} of 10
              </span>
            </div>
            <CardContent className="pt-4">
              <div className="hidden lg:grid strategy-objective !border-0 !py-0 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Objective</span><span>Measures and targets</span><span>Initiatives</span>
              </div>
              {perspective.objectives.map((objective) => (
                <div key={objective.name} className="strategy-objective">
                  <div className="text-[14px] font-semibold text-slate-900 leading-snug">{objective.name}</div>
                  <div>{objective.measures.map((m) => <Measure key={m.name} measure={m} years={strategyMap.years} />)}</div>
                  <div>
                    {objective.initiatives.length > 0 ? (
                      <ul className="space-y-1.5">
                        {objective.initiatives.map((initiative) => (
                          <li key={initiative} className="text-[12.5px] text-slate-600 leading-snug pl-3 relative">
                            <span className="absolute left-0 top-[7px] w-1.5 h-1.5 rounded-full" style={{ background: perspective.meta.color }} aria-hidden="true" />
                            {initiative}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[12px] text-slate-400">No initiative recorded in the plan</p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          {index < perspectives.length - 1 && (
            <div className="flex justify-center py-1.5 text-slate-300" aria-hidden="true"><ArrowUp size={16} /></div>
          )}
        </div>
      ))}
    </div>
  )
}
