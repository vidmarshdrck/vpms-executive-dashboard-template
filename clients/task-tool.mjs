// One structured tool request on stdin. Never execute model-generated shell/SQL.
import {createTaskClient} from './task-client.js'
try {
 process.stdin.setEncoding('utf8')
 let text='';for await(const chunk of process.stdin){text+=chunk;if(Buffer.byteLength(text,'utf8')>16384)throw Error('body_too_large')}
 const input=JSON.parse(text)
 if(!input||!['read','create','update'].includes(input.action))throw Error('action_not_allowed')
 const allowed={read:['action','business','id'],create:['action','business','data','key'],update:['action','business','id','data','revision','key']}[input.action]
 if(Object.keys(input).some(k=>!allowed.includes(k)))throw Error('unexpected_parameters')
 if(!process.env.VHPMS_TASK_API_URL||!process.env.VHPMS_OWNER_ACCESS_TOKEN)throw Error('owner_session_required')
 const client=createTaskClient({baseUrl:process.env.VHPMS_TASK_API_URL,accessToken:async()=>process.env.VHPMS_OWNER_ACCESS_TOKEN})
 const result=input.action==='read'?await client.read(input.business,input.id):input.action==='create'?await client.create(input.business,input.data,input.key):await client.update(input.business,input.id,input.data,input.revision,input.key)
 process.stdout.write(JSON.stringify(result)+'\n')
} catch(error) {
 const safe=/^[a-z_]{1,80}$/.test(error.message)?error.message:'tool_failed'
 process.stdout.write(JSON.stringify({error:safe})+'\n');process.exitCode=1
}
