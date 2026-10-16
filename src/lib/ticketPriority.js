// The Tazai ticket priority rules supplied by the PMS owner. Task owners and
// affected departments are distinct: an ICT task can concern Finance, for
// example. Existing historical task priorities are never recalculated.
export const ISSUE_CATEGORIES = [
  'Hardware', 'Software', 'Network', 'Account Access',
  'Email Issues', 'Printer Issues', 'Security Issues',
]

export const TICKET_DEPARTMENTS = [
  'Administration', 'Finance', 'Human Resource', 'Security', 'Operations',
  'Maintenance', 'Boom Gate', 'Commercial', 'Dispatch',
]

export const PRIORITY_MATRIX = {
  Administration: ['Medium', 'Medium', 'Medium', 'Medium', 'Medium', 'Low', 'High'],
  Finance: ['High', 'High', 'Critical', 'High', 'High', 'Medium', 'Critical'],
  'Human Resource': ['Medium', 'Medium', 'High', 'High', 'High', 'Low', 'Critical'],
  Security: ['High', 'High', 'Critical', 'Critical', 'High', 'Low', 'Critical'],
  Operations: ['High', 'High', 'Critical', 'High', 'High', 'Medium', 'Critical'],
  Maintenance: ['High', 'High', 'High', 'Medium', 'Medium', 'Medium', 'Critical'],
  'Boom Gate': ['Critical', 'Critical', 'Critical', 'Critical', 'High', 'Medium', 'Critical'],
  Commercial: ['High', 'High', 'Critical', 'High', 'High', 'Medium', 'Critical'],
  Dispatch: ['Critical', 'Critical', 'Critical', 'Critical', 'High', 'High', 'Critical'],
}

export const PRIORITY_EXPLANATIONS = {
  Critical: 'Immediate operational, financial, security, access-control, or core-system impact. A Critical issue may significantly interrupt essential business operations and requires immediate attention.',
  High: 'Significant disruption to an important business function, but operations can continue temporarily. A High-priority issue affects an important business activity and should be addressed promptly.',
  Medium: 'Individual or team productivity impact with a reasonable workaround available. A Medium-priority issue affects normal work but does not normally stop critical business operations.',
  Low: 'Minor inconvenience or issue involving a non-essential service, device, or function. A Low-priority issue has limited operational impact and can normally be addressed during routine support work.',
}

const DEPARTMENT_ALIASES = { 'Human Resources': 'Human Resource', Boomgate: 'Boom Gate' }

export function priorityFor(department, category) {
  if (!department || !category) return null
  const canonicalDepartment = DEPARTMENT_ALIASES[department] ?? department
  const categoryIndex = ISSUE_CATEGORIES.indexOf(category)
  return categoryIndex < 0 ? null : PRIORITY_MATRIX[canonicalDepartment]?.[categoryIndex] ?? null
}
