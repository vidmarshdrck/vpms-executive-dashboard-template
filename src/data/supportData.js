// IT Help Desk — Support KPI data
//
// TEST / MOCK DATA FOR UI DEVELOPMENT ONLY. This dashboard is NOT connected
// to a live help desk system. The lookup values below (priorities/SLA
// hours, statuses, categories, departments) are representative of a
// typical IT help desk schema — but every count/figure here is a
// placeholder pending a real ingestion pathway. The intended production
// flow mirrors src/lib/navisionIntegration.js's pattern:
//   HELPDESK -> integration/ingestion layer -> canonical
//   support KPI model -> dashboard API -> this dashboard.
// No such connection exists yet — do not present this page's numbers as
// live ticketing data.

export const priorities = [
  { name: 'Critical', slaHours: 2 },
  { name: 'High', slaHours: 8 },
  { name: 'Medium', slaHours: 24 },
  { name: 'Low', slaHours: 72 },
]

export const statuses = ['New', 'Assigned', 'In Progress', 'On Hold', 'Resolved', 'Closed']

// Business-wide categories rather than IT-only ones — every department
// raises tickets, not just IT, so the category should describe the nature
// of the request (a billing query, a maintenance job, a vehicle claim)
// rather than assume an IT service desk shape.
export const categories = ['Software & Systems', 'Network & Connectivity', 'Access & Security', 'Income', 'Expense', 'Maintenance', 'Transport']

export const departments = ['Administration', 'Finance', 'Human Resources', 'Security', 'Operations', 'Maintenance', 'Boomgate', 'Commercial', 'Dispatch', 'Transport']

export const summary = {
  totalTickets: 229,
  open: 39,
  closed: 190,
  avgResolutionHours: 14.6,
}

// Reported (non-null) months only cover H1 2026 — same reporting-period
// convention as kpiData.js. Later months are null, not fabricated.
export const monthlyTicketVolume = [
  { month: 'Jan', tickets: 31 },
  { month: 'Feb', tickets: 34 },
  { month: 'Mar', tickets: 38 },
  { month: 'Apr', tickets: 36 },
  { month: 'May', tickets: 39 },
  { month: 'Jun', tickets: 36 },
  { month: 'Jul', tickets: null },
  { month: 'Aug', tickets: null },
  { month: 'Sep', tickets: null },
  { month: 'Oct', tickets: null },
  { month: 'Nov', tickets: null },
  { month: 'Dec', tickets: null },
]

export const ticketsByPriority = [
  { name: 'Critical', slaHours: 2, count: 13, withinSla: 10, breached: 3 },
  { name: 'High', slaHours: 8, count: 49, withinSla: 41, breached: 8 },
  { name: 'Medium', slaHours: 24, count: 105, withinSla: 95, breached: 10 },
  { name: 'Low', slaHours: 72, count: 62, withinSla: 60, breached: 2 },
]

export const ticketsByCategory = [
  { name: 'Software & Systems', count: 60 },
  { name: 'Access & Security', count: 40 },
  { name: 'Network & Connectivity', count: 29 },
  { name: 'Maintenance', count: 33 },
  { name: 'Income', count: 28 },
  { name: 'Expense', count: 24 },
  { name: 'Transport', count: 15 },
]

export const ticketsByDepartment = [
  { name: 'Operations', count: 52 },
  { name: 'Dispatch', count: 38 },
  { name: 'Finance', count: 27 },
  { name: 'Commercial', count: 24 },
  { name: 'Administration', count: 22 },
  { name: 'Security', count: 19 },
  { name: 'Maintenance', count: 17 },
  { name: 'Transport', count: 15 },
  { name: 'Human Resources', count: 10 },
  { name: 'Boomgate', count: 5 },
]

const totalWithinSla = ticketsByPriority.reduce((sum, row) => sum + row.withinSla, 0)
const totalBreached = ticketsByPriority.reduce((sum, row) => sum + row.breached, 0)

export const slaCompliance = {
  withinSla: totalWithinSla,
  breached: totalBreached,
  percent: Number(((totalWithinSla / (totalWithinSla + totalBreached)) * 100).toFixed(1)),
}
