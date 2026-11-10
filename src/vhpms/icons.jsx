import {
  Activity, Building2, Calculator, Calendar, ClipboardList, Clapperboard, Cpu, Eye, EyeOff, Hexagon,
  House, Inbox, Landmark, Layers, LayoutDashboard, Mail, Megaphone, MessageCircle, Package,
  Receipt, Shield, Shirt, Smartphone, Target, Truck, Upload, UserRound, Users, Wallet,
} from 'lucide-react'

const ICONS = {
  dashboard: LayoutDashboard,
  wallet: Wallet,
  calculator: Calculator,
  megaphone: Megaphone,
  landmark: Landmark,
  users: Users,
  user: UserRound,
  calendar: Calendar,
  package: Package,
  mail: Mail,
  layers: Layers,
  receipt: Receipt,
  message: MessageCircle,
  building: Building2,
  upload: Upload,
  clipboard: ClipboardList,
  shield: Shield,
  target: Target,
  activity: Activity,
  inbox: Inbox,
  house: House,
  truck: Truck,
  shirt: Shirt,
  smartphone: Smartphone,
  cpu: Cpu,
  clapperboard: Clapperboard,
  hexagon: Hexagon,
  eye: Eye,
  'eye-off': EyeOff,
}

export const BUSINESS_ICONS = {
  ve: 'clapperboard',
  vai: 'cpu',
  rez: 'house',
  bsg: 'smartphone',
  vt: 'truck',
  eunique: 'shirt',
  digital: 'package',
}

export const SECTION_ICONS = {
  Overview: 'dashboard',
  Funds: 'wallet',
  Budget: 'calculator',
  Marketing: 'megaphone',
  Accounts: 'landmark',
  Customers: 'users',
  'Family Accounts': 'users',
  Expenses: 'receipt',
  Income: 'wallet',
  Counts: 'layers',
}

export function NavIcon({ name }) {
  const Icon = ICONS[name] || LayoutDashboard
  return <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
}

export function MenuIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
}

export function ColumnLabel({ icon, children }) {
  return <span className="th-icon"><NavIcon name={icon} />{children}</span>
}
