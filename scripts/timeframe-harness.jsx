import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import Shell from '../src/vhpms/Shell.jsx'
import { ReportingPeriodProvider, TimeframePopover } from '../src/vhpms/TimeframePopover.jsx'
import { findAccount } from '../src/vhpms/directory.js'
import { emptyBooks } from '../src/vhpms/books.js'

const TODAY = '2026-11-10'

const shot = new URLSearchParams(window.location.search).get('shot')
const user = findAccount('shadrickvidmar')
const noop = () => {}

export function HeaderPreview() {
  return createElement('div', { className: 'vh-app', style: { minHeight: '100vh', background: '#F5F4F1' } },
    createElement(ReportingPeriodProvider, { userId: 'shadrickvidmar', today: TODAY },
      createElement('header', { className: 'app-header' },
        createElement('div', { style: { minWidth: 0 } },
          createElement('div', { className: 'eyebrow' }, 'VHPMS performance management'),
          createElement('div', { className: 'page-title' }, 'Executive Dashboard'),
        ),
        createElement('div', { className: 'header-tools' },
          createElement(TimeframePopover, { pageTitle: 'Executive Dashboard', today: TODAY }),
        ),
      ),
    ),
  )
}

function shell(view, title) {
  return createElement(Shell, {
    user,
    view,
    menu: false,
    setMenu: noop,
    mode: view === 'activities' ? 'businesses' : 'management',
    books: emptyBooks(),
    businessId: 've',
    title,
    today: TODAY,
    onOpen: noop,
    onLive: noop,
    onBack: noop,
    onBusiness: noop,
    onRole: noop,
  }, createElement('p', null, title))
}

const view = shot === 'activities' ? shell('activities', 'Activities') : shot === 'shell' ? shell('gm', 'GM Dashboard') : createElement(HeaderPreview)
createRoot(document.getElementById('root')).render(view)
