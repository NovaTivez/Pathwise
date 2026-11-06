import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
const root='http://127.0.0.1:3000',origin='https://pathwise-local-check.example.org'
const checks=[]
function check(ok,label){assert.ok(ok,label);checks.push(label)}
async function api(path,token='',body){const response=await fetch(root+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});return {response,data:await response.json()}}
const page=await fetch(root);check(page.ok&&(await page.text()).includes('Pathwise'),'Built frontend served')
check(page.headers.get('content-security-policy')?.includes("script-src 'self'"),'Production CSP retained')
const health=await api('health');check(health.response.ok&&health.data.payments==='paused','Healthy persistent backend; payments paused')
for(const path of ['/.env','/.env.production','/apps/server/data/pathwise.sqlite','/.git/config'])check((await fetch(root+path)).status===404,'Private path denied: '+path)
check((await api('agent/status')).response.status===401,'Unauthenticated records denied')
const rejected=await fetch(root+'/api/session',{method:'POST',headers:{Origin:root,'Content-Type':'application/json'},body:'{}'});check(rejected.status===403,'Wrong browser origin rejected')
const token=(await api('session','',{})).data.token,other=(await api('session','',{})).data.token
const plan=await api('plans',token,{goal:'AWS Certified Cloud Practitioner',skills:[],formats:['course','lab','practice'],budget:'30',limit:'10',reserve:'10'});check(plan.response.status===201,'Goal saved in local container')
check((await api('plans/'+plan.data.id,other)).response.status===404,'Foreign-session plan denied')
const args={planId:plan.data.id,mode:'simulation',providers:['cloudtrail','sandbox','lantern']}
check((await api('agent/preview',token,args)).data.decisions.filter(d=>d.state==='selected').length===2,'Current roadmap selected two resources')
const grant=(await api('agent/approve',token,args)).data[0];check(Boolean(grant?.id),'Simulation rules approved')
await api('agent/start',token,{grantId:grant.id})
let state
for(let i=0;i<10;i++){state=(await api('agent/status',token)).data[0];if(state.orders.length===2&&state.orders.every(o=>o.status==='simulated'))break;await new Promise(r=>setTimeout(r,1000))}
check(state.orders.every(o=>o.status==='simulated'&&!o.authorizeHash&&!o.claimHash&&!o.sampleAccessCode),'Worker completed simulation without fake evidence')
check(state.remainingStroops==='60000000'&&state.reserveStroops==='100000000'&&state.spentStroops==='0','Exact capacity/reserve/settled-spending accounting')
await api('agent/start',token,{grantId:grant.id});check((await api('agent/status',token)).data[0].orders.length===2,'Repeated start did not duplicate orders')
// Session remains only in memory while an optional restart is performed by this process.
if(process.argv.includes('--restart')){const {spawnSync}=await import('node:child_process');const result=spawnSync('docker',['compose','-f','compose.yaml','-f','compose.local-check.yaml','restart','app'],{encoding:'utf8'});check(result.status===0,'Container restarted');let loaded;for(let i=0;i<20;i++){try{loaded=await api('plans/'+plan.data.id,token);if(loaded.response.ok)break}catch{}await new Promise(r=>setTimeout(r,500))}check(loaded?.data.id===plan.data.id,'Plan and session survived container restart');check((await api('agent/status',token)).data[0].orders.length===2,'Simulation orders survived container restart')}
writeFileSync('artifacts/container-local-check.json',JSON.stringify({checkedAt:new Date().toISOString(),scope:'Local container HTTP and explicit simulation only; not public or live payment evidence',checks,passed:true},null,2)+'\n')
console.log(JSON.stringify({passed:true,checks:checks.length,scope:'Local container and explicit simulation; no payments, no public tunnel',restart:process.argv.includes('--restart')}))
