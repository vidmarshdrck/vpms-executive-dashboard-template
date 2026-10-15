export function resolvePriority(task, rules) {
 if(task.override_priority&&task.override_reason?.trim()&&task.override_by) return {priority:task.override_priority,source:'audited override',rationale:task.override_reason,ruleId:null}
 const rule=rules.find(r=>r.business_id===task.business_id && r.category_id===task.category_id && r.approved_by)
 return rule ? {priority:rule.priority,source:'business/category',rationale:rule.rationale,ruleId:rule.id} : {priority:task.source_priority||null,source:'source',rationale:'No approved business/category rule; source priority retained.',ruleId:null}
}
export function isStale(syncedAt,now=Date.now()) {
 const time=Date.parse(syncedAt)
 return !Number.isFinite(time)||time>now||now-time>15*60*1000
}
