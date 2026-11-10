import { useId, useState } from 'react'
import { NavIcon, SECTION_ICONS } from './icons.jsx'
import { panelAccessibility } from './slideTabs.js'

function tabText(tab) {
  return typeof tab === 'string' ? tab : tab.label
}

export default function SlideTabs({ label, tabs, children }) {
  const [index, setIndex] = useState(0)
  const uid = useId()
  const panels = Array.isArray(children) ? children : [children]
  const count = tabs.length
  return (
    <div className="slide-workspace">
      <div className="slide-tabs" role="tablist" aria-label={label}>
        {tabs.map((tab, tabIndex) => {
          const text = tabText(tab)
          const icon = (typeof tab === 'object' && tab.icon) || SECTION_ICONS[text]
          return (
            <button key={text} id={`${uid}-tab-${tabIndex}`} type="button" role="tab" aria-selected={tabIndex === index} aria-controls={`${uid}-panel-${tabIndex}`} className={tabIndex === index ? 'is-active' : ''} onClick={() => setIndex(tabIndex)}>
              {icon ? <NavIcon name={icon} /> : null}
              <span>{text}</span>
            </button>
          )
        })}
      </div>
      <div className="slide-viewport">
        <div className="slide-track" style={{ width: `${count * 100}%`, transform: `translateX(-${(index * 100) / count}%)` }}>
          {panels.map((child, childIndex) => (
            <div className="slide-page" id={`${uid}-panel-${childIndex}`} key={tabText(tabs[childIndex])} style={{ width: `${100 / count}%` }} {...panelAccessibility(childIndex === index)}>{child}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
