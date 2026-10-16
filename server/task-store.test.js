import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture,command} from './fixtures.js'
test('transaction persists canonical task, exact matrix, idempotency, revision and audit',async()=>{
 const db=await fixture()
 try {
 const created=await command(db)
 assert.equal(created.task.effective_priority,'critical')
 assert.equal(created.task.source,'command')
 assert.equal(created.task.revision,1)
 assert.equal((await db.query('SELECT * FROM vhpms_tasks')).rows.length,1)
 const replay=await command(db)
 assert.equal(replay.task.external_id,created.task.external_id)
 assert.equal(replay.replayed,true)
 await assert.rejects(command(db,{data:{title:'Changed',category_id:'safety'}}),/idempotency_conflict/)
 const updated=await command(db,{op:'update',id:created.task.external_id,key:'request-2',revision:1,data:{title:'Updated',category_id:null}})
 assert.equal(updated.task.title,'Updated')
 assert.equal(updated.task.revision,2)
 assert.equal(updated.task.effective_priority,'low')
 await assert.rejects(command(db,{op:'update',id:created.task.external_id,key:'request-3',revision:1,data:{title:'Lost update'}}),/revision_conflict/)
 assert.equal((await db.query('SELECT * FROM vhpms_activities')).rows.length,2)
 assert.equal((await db.query('SELECT * FROM vhpms_task_commands')).rows.length,2)
 } finally {await db.close()}
})



test('RPC is service-only; unauthorized or malformed commands roll back all state',async()=>{
 const db=await fixture()
 try {
 await assert.rejects(command(db,{actor:'00000000-0000-0000-0000-000000000002'}),/forbidden/)
 await db.exec('SET ROLE authenticated')
 await assert.rejects(command(db),/permission denied/)
 await db.exec('RESET ROLE; SET ROLE anon')
 await assert.rejects(command(db),/permission denied/)
 await db.exec('RESET ROLE; SET ROLE service_role')
 await assert.rejects(command(db,{data:{title:'Relative date',category_id:'safety',due_at:'tomorrow'}}),/invalid_due_at/)
 await assert.rejects(command(db,{data:{title:'Bad project',category_id:'safety',project_external_id:'missing'}}),/foreign key/)
 await assert.rejects(command(db,{data:{title:'Bad category',category_id:'unknown'}}),/foreign key/)
 await assert.rejects(command(db,{data:{title:'Bad override',category_id:'safety',override_priority:'critical'}}),/invalid_field/)
 assert.equal((await db.query('SELECT * FROM vhpms_tasks')).rows.length,0)
 assert.equal((await db.query('SELECT * FROM vhpms_task_commands')).rows.length,0)
 assert.equal((await db.query('SELECT * FROM vhpms_activities')).rows.length,0)
 const results=await Promise.all([command(db),command(db)])
 assert.equal(results[0].task.external_id,results[1].task.external_id)
 assert.equal(results.filter(r=>r.replayed).length,1)
 assert.equal((await db.query('SELECT * FROM vhpms_activities')).rows.length,1)
 await db.exec('RESET ROLE')
 await db.exec("INSERT INTO vhpms_tasks(business_id,external_id,title,source_status) VALUES ('BSG','imported','Source','todo')")
 await assert.rejects(command(db,{op:'update',id:'imported',key:'import-update',revision:1,data:{title:'Unsafe'}}),/source_read_only/)
 await db.exec("UPDATE vhpms_tasks SET title='Source sync' WHERE external_id='imported'")
 assert.equal((await db.query("SELECT revision FROM vhpms_tasks WHERE external_id='imported'")).rows[0].revision,2)
 }finally{await db.close()}
})


test('canonical records, deduplication and audit survive database restart (disposable disk only)',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises')
 const {tmpdir}=await import('node:os')
 const {join}=await import('node:path')
 const {PGlite}=await import('@electric-sql/pglite')
 const directory=await mkdtemp(join(tmpdir(),'vhpms-task-test-'))
 let db
 try{
 db=await fixture(directory)
 const created=await command(db)
 await db.close();db=new PGlite(directory)
 const replay=await command(db)
 assert.equal(replay.task.external_id,created.task.external_id)
 assert.equal(replay.replayed,true)
 assert.equal((await db.query('SELECT * FROM vhpms_activities')).rows.length,1)
 }finally{if(db)await db.close();await rm(directory,{recursive:true,force:true})}
})
