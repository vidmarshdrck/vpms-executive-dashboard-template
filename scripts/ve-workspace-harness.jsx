import { createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Shell, { LoginScreen } from '../src/vhpms/Shell.jsx'
import VeWorkspace from '../src/vhpms/VeWorkspace.jsx'
import ActivitiesBoard from '../src/vhpms/ActivitiesBoard.jsx'
import { emptyBooks } from '../src/vhpms/books.js'
import { emptyActivities } from '../src/vhpms/activities.js'
import { findAccount } from '../src/vhpms/directory.js'
import { buildWorkspace } from '../src/vhpms/veData.js'

const TODAY = '2026-11-08'
const model = buildWorkspace({
  familyAccounts: {
    access: 'ok',
    rows: [
      { fid: 12, aaid: 'AG1', product: 'Netflix', due_date: '2026-12-05', paid_status: 'Unpaid', slots_total: 5, slots_taken: 3, slot_1: 'C1', slot_2: 'C2', slot_3: 'C3', password: 'must-not-render' },
      { fid: 18, product: 'Apple Music', due_date: '2027-01-15', paid_status: 'Unpaid', slots_total: 5, slots_taken: 1, slot_1: 'C4' },
      { fid: 4, product: 'Spotify', due_date: '2026-08-06', paid_status: 'Unpaid', slots_total: 5, slots_taken: 2, slot_1: 'C5', slot_2: 'C6' },
      { fid: 9, product: 'Prime Video', due_date: '2026-05-24', paid_status: 'Unpaid', slots_total: 5, slots_taken: 0 },
    ],
  },
  customers: {
    access: 'ok',
    rows: [
      { cid: 'C1', name: 'Amara Banda', phone: '0977000111', products: ['Netflix'], status: 'CONNECTED', total_spent: 1860, due_date: '2026-12-05' },
      { cid: 'C2', name: 'Lombe Phiri', phone: '0977000222', products: ['Netflix', 'Spotify'], status: 'CONNECTED', total_spent: 940, due_date: '2026-12-05' },
      { cid: 'C3', name: 'Chipo Mwale', phone: '', products: ['Netflix'], status: 'DISCONNECTED', total_spent: 220, due_date: '2026-09-01' },
      { cid: 'C4', name: 'Thabo Zulu', phone: '+260977000333', products: ['Apple Music'], status: 'CONNECTED', total_spent: 480, due_date: '2027-01-15' },
      { cid: 'C5', name: 'Natasha Bwalya', phone: '0977000444', products: ['Spotify'], status: 'CONNECTED', total_spent: 360, due_date: '2026-11-20' },
      { cid: 'C6', name: 'Kelvin Sakala', phone: '0977000555', products: ['Prime Video'], status: 'DISCONNECTED', total_spent: 150, due_date: null },
    ],
  },
  orders: {
    access: 'ok',
    rows: [
      { oid: 'O1', date: '2026-11-02', amount: 150, product: 'Netflix', months: 1, cid: 'C1', status: 'CONNECTED' },
      { oid: 'O2', date: '2026-11-08', amount: 80, product: 'Spotify', months: 1, cid: 'C2', status: 'CONNECTED' },
      { oid: 'O3', date: '2026-10-14', amount: 150, product: 'Netflix', months: 1, cid: 'C3', status: 'DISCONNECTED' },
      { oid: 'O4', date: '2026-10-20', amount: 60, product: 'Apple Music', months: 1, cid: 'C4', status: 'CONNECTED' },
      { oid: 'O5', date: '2026-09-05', amount: 45, product: 'Prime Video', months: 1, cid: 'C6', status: '' },
    ],
  },
  expenses: {
    access: 'ok',
    rows: [
      { id: 1, date: '2026-11-03', amount: 220, category: 'Netflix', status: 'Paid', payee: 'Netflix', family_account_id: 12 },
      { id: 2, date: '2026-11-04', amount: 40, category: 'Airtime', status: 'Paid', payee: 'Airtel' },
      { id: 3, date: '2026-11-06', amount: 90, category: 'Apple Music', status: 'Paid', payee: 'Apple', family_account_id: 18 },
      { id: 4, date: '2026-10-11', amount: 180, category: 'Spotify', status: 'Paid', payee: 'Spotify', family_account_id: 4 },
      { id: 5, date: '2026-10-18', amount: 75, category: 'Boost Post', status: 'Paid', payee: 'Meta' },
      { id: 6, date: '', amount: 15, category: 'Transaction fees', status: 'Paid', payee: 'Bank' },
    ],
  },
  marketing: {
    access: 'ok',
    rows: [
      { id: 1, date: '2026-12-01', channel: 'Meta', campaign: 'December renewals', hook_used: 'Renew before Friday', cta_used: 'Pay now' },
      { id: 2, date: '2026-11-01', channel: 'WhatsApp', campaign: 'Slot openings', hook_used: 'Two Netflix slots open', cta_used: 'Reply JOIN' },
    ],
  },
  marketingSpend: {
    access: 'ok',
    rows: [
      { id: 1, date: '2026-10-01', channel: 'Meta', campaign: 'October renewals', amount: 800, conversions: 16, cac: '' },
      { id: 2, date: '2026-11-01', channel: 'WhatsApp', campaign: 'November referrals', amount: 200, conversions: 8, cac: '' },
    ],
  },
  products: {
    access: 'ok',
    rows: [
      { id: 'p1', name: 'Netflix', category: 'streaming', is_shared_plan: true, slots_per_account: 5, price_zmw: 150, is_active: true },
      { id: 'p2', name: 'Spotify', category: 'music', is_shared_plan: true, slots_per_account: 5, price_zmw: 80, is_active: true },
      { id: 'p3', name: 'Apple Music', category: 'music', is_shared_plan: true, slots_per_account: 5, price_zmw: 70, is_active: true },
      { id: 'p4', name: 'Prime Video', category: 'streaming', is_shared_plan: true, slots_per_account: 5, price_zmw: 90, is_active: true },
    ],
  },
}, TODAY)

const books = emptyBooks()
const user = findAccount('shadrickvidmar')

export function Harness() {
  const [view, setView] = useState(() => (window.location.hash === '#login' ? 'login' : 'business'))
  const [menu, setMenu] = useState(false)
  const [composing, setComposing] = useState(false)
  const [activities, setActivities] = useState(() => emptyActivities())
  const business = books.businesses.find((item) => item.id === 've')
  if (view === 'login') return createElement(LoginScreen, { error: '', busy: false, onSubmit: (event) => event.preventDefault() })
  return createElement(Shell, {
    user,
    view,
    menu,
    setMenu,
    mode: 'businesses',
    books,
    businessId: 've',
    title: view === 'activities' ? 'Activities' : business.name,
    onOpen: (id) => { setView(id); setMenu(false) },
    onLive: () => {},
    onBack: () => setView('business'),
    onBusiness: () => { setView('business'); setMenu(false) },
    onLogout: () => {},
    onRole: () => {},
    headerAction: view === 'activities' ? createElement('button', { type: 'button', className: 'btn btn-primary', onClick: () => setComposing(true) }, 'Add task') : null,
  }, view === 'activities'
    ? createElement(ActivitiesBoard, { state: activities, composing, onChange: setActivities })
    : createElement(VeWorkspace, { business, model, today: TODAY }))
}

createRoot(document.getElementById('root')).render(createElement(Harness))
