import FinancesSection from '../../vhpms/finances/FinancesSection.jsx'
import '../../vhpms/embed.css'

export default function FinancesPage() {
  return <div className="space-y-6 animate-fade-in">
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#2563EB]">Incomes · expenses · investments</p>
      <h2 className="text-xl font-bold text-slate-900 mt-1">Finances</h2>
      <p className="text-sm text-slate-500 mt-1">MoMo, Airtel and payment-buffer records in ZMW.</p>
    </div>
    <div className="vh-embed"><FinancesSection /></div>
  </div>
}
