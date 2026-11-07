import { useId, useState } from 'react'
import { panelAccessibility } from './slideTabs.js'

export default function SlideTabs({ label, tabs, children }) {
  const [index, setIndex] = useState(0)
  const uid = useId()
  const panels = Array.isArray(children) ? children : [children]
  const count = tabs.length
  return (
    <div className="slide-workspace">
      <div className="slide-tabs" role="tablist" aria-label={label}>
        {tabs.map((tab, tabIndex) => (
          <button key={tab} id={`${uid}-tab-${tabIndex}`} type="button" role="tab" aria-selected={tabIndex === index} aria-controls={`${uid}-panel-${tabIndex}`} className={tabIndex === index ? 'is-active' : ''} onClick={() => setIndex(tabIndex)}>{tab}</button>
        ))}
      </div>
      <div className="slide-viewport">
        <div className="slide-track" style={{ width: `${count * 100}%`, transform: `translateX(-${(index * 100) / count}%)` }}>
          {panels.map((child, childIndex) => (
            <div className="slide-page" id={`${uid}-panel-${childIndex}`} key={tabs[childIndex]} style={{ width: `${100 / count}%` }} {...panelAccessibility(childIndex === index)}>{child}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
