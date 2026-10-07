import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx'
import { Users, ShieldCheck, Database, PlugZap, ScrollText, Construction } from 'lucide-react'

const modules = [
  { icon: Users, title: 'User management', body: 'Create, disable, and role-assign VPMS dashboard accounts.' },
  { icon: ShieldCheck, title: 'Role management', body: 'Define permissions for the Admin, GM, Board, Dept Head and Staff roles.' },
  { icon: Database, title: 'KPI / data administration', body: 'Review and correct KPI values, targets, and per-KPI colour thresholds.' },
  { icon: PlugZap, title: 'Integration configuration', body: 'Configure the Navision connection once an approved API/endpoint is available.' },
  { icon: ScrollText, title: 'Audit / activity monitoring', body: 'Review system-wide activity across all users, backed by a persisted audit log.' },
]

export default function Admin() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <Construction size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <div className="text-sm font-bold text-amber-900">Administration, not yet functional</div>
          <p className="text-xs text-amber-800 mt-1">
            Only Admins can see this page. That's enforced by permission, not just hidden
            navigation. None of the modules below are wired up yet, so nothing here changes live data.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader><CardTitle className="flex items-center gap-2"><Icon size={16} className="text-[#B42318]" />{title}</CardTitle></CardHeader>
            <CardContent><p className="text-xs text-slate-500">{body}</p></CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
