import { useState } from 'react'

export default function SlideTabs({ label, tabs, children }) {
  const [index, setIndex] = useState(0)
  const count = tabs.length
  return (
    <div className="slide-workspace">
      <div className="slide-tabs" role="tablist" aria-label={label}>
        {tabs.map((tab, tabIndex) => (
          <button key={tab} type="button" role="tab" aria-selected={tabIndex === index} className={tabIndex === index ? 'is-active' : ''} onClick={() => setIndex(tabIndex)}>{tab}</button>
        ))}
      </div>
      <div className="slide-viewport">
        <div className="slide-track" style={{ width: `${count * 100}%`, transform: `translateX(-${(index * 100) / count}%)` }}>
          {children.map((child, childIndex) => <div className="slide-page" key={tabs[childIndex]} style={{ width: `${100 / count}%` }}>{child}</div>)}
        </div>
      </div>
    </div>
  )
}
