// Server-side only. Never ship source credentials, descriptions or agent config.
export function readbackMatches(expected,actual) {
 return !!actual&&Object.entries(expected).every(([k,v])=>k.endsWith('_at')&&v!==null ? Date.parse(actual[k])===Date.parse(v) : actual[k]===v)
}
export function projectSnapshot({projects,issues,agents},bindings,now) {
 const bound=projects.filter(p=>Object.hasOwn(bindings,p.id))
 const ids=new Set(bound.map(p=>p.id)); const names=new Map(agents.map(a=>[a.id,a.name]))
 return {
 projects:bound.map(p=>({business_id:bindings[p.id],external_id:p.id,title:p.name,source_status:p.status,source_updated_at:p.updatedAt||null,due_at:p.targetDate||null,synced_at:now})),
 tasks:issues.filter(i=>ids.has(i.projectId)&&!i.hiddenAt).map(i=>({business_id:bindings[i.projectId],external_id:i.id,identifier:i.identifier||null,title:i.title,project_external_id:i.projectId,source_status:i.status,source_priority:i.priority||null,owner_name:names.get(i.assigneeAgentId)||null,source_updated_at:i.updatedAt||null,synced_at:now}))
 }
}
