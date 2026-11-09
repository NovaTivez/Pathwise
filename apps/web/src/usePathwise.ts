import { useCallback, useEffect, useState, useRef } from 'react'
import { noirExtensionSigner } from '@noirx402/agent-sdk'
import { Networks } from '@stellar/stellar-sdk'
import type { Catalog, Grant, Plan, Roadmap, Setup } from './ui'
import { xlm, decisionFromStored } from './ui'
import { careerChoices, exactStroops, roadmapGuidance } from './career-guidance'
import { careerPurchasingSupported } from './learning'
import { stepFromHash, routeForStep, nextSetupStep } from './navigation'
import { defaultDraft, validatedDraft } from './onboarding'
function restoredDraft(){try{return validatedDraft(JSON.parse(sessionStorage.getItem('pathwise.draft')||'null'))}catch{return defaultDraft}}
const providerDefaults=['cloudtrail','sandbox','lantern']
const previewOnly=(p:Plan|null)=>Boolean(p?.id.startsWith('preview:'))
function savedGuidance():Plan[]{try{return JSON.parse(sessionStorage.getItem('pathwise.guidance')||'[]')}catch{return []}}
function remember(plan:Plan){sessionStorage.setItem('pathwise.lastPlan',plan.id);sessionStorage.setItem('pathwise.guidance',JSON.stringify([plan,...savedGuidance().filter(p=>p.id!==plan.id)].slice(0,20)))}
function storedMode(){try{sessionStorage.setItem('pathwise.mode','testnet')}catch{/* The in-memory mode stays Testnet. */}return 'testnet'}
const checkoutChannel='pathwise.checkout-return'
function checkoutArrival(){try{const value=new URLSearchParams(window.location.search).get('checkout');return value==='returned'||value==='cancelled'?value:''}catch{return ''}}
function checkoutNotice(kind:string){return kind==='cancelled'?'Checkout closed before payment. You are on the service fee step. Purchasing stays off.':'You are on the service fee step. Close the Velo tab if it is still open. A return here does not activate purchasing until the fee is verified.'}
export function usePathwise(){
  const sessionRef=useRef(''),arrival=useRef(checkoutArrival())
  const [step,setStep]=useState(()=>arrival.current?7:typeof window==='undefined'?-1:stepFromHash(window.location.hash)),[token,setToken]=useState(''),[plans,setPlans]=useState<Plan[]>([]),[saved,setSaved]=useState<Plan|null>(null)
  const [catalog,setCatalog]=useState<Catalog|null>(null),[setup,setSetup]=useState<Setup|null>(null),[grants,setGrants]=useState<Grant[]>([]),[mode,setMode]=useState('testnet')
  const [providers,setProviders]=useState(providerDefaults),[draft,setDraft]=useState(restoredDraft)
  const [preview,setPreview]=useState<{planId:string;mode:string;value:Roadmap}|null>(null)
  const [busy,setBusy]=useState(true),[booting,setBooting]=useState(true),[building,setBuilding]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(false),[connectionError,setConnectionError]=useState('')
  useEffect(()=>{try{sessionStorage.setItem('pathwise.draft',JSON.stringify(draft))}catch{/* Draft remains in memory. */}},[draft])
  const careers=catalog?.careers?.length?catalog.careers:careerChoices
  const api=useCallback(async(path:string,body?:unknown,session=sessionRef.current)=>{
    let response:Response
    try{response=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session},body:body===undefined?undefined:JSON.stringify(body)})}catch{throw Error('The backend could not be reached. Retry status before repeating an uncertain payment.')}
    const data=await response.json().catch(()=>{throw Error('Unexpected backend response. Check backend health, then retry status.')})
    if(!response.ok)throw Error(typeof data.error==='string'&&data.error.includes('separate fresh Testnet owner')?'This wallet already has a saved authorization. Reconcile the existing experiment before continuing; do not create another wallet to bypass limits.':data.error||'This request could not be completed.')
    return data
  },[])
  const populate=(p:Plan)=>setDraft({career:p.career||'cloud',timelineWeeks:p.timelineWeeks||12,goal:p.goal,skills:p.skills,formats:p.formats,budget:xlm(p.budgetStroops),limit:xlm(p.limitStroops),reserve:xlm(p.reserveStroops)})
  useEffect(()=>{const lifetime=new AbortController();async function init(){storedMode();try{
    const prior=sessionStorage.getItem('pathwise.session')||'',session=await api('session',{},prior)
    const list:Plan[]=await api('plans',undefined,session.token),extras=savedGuidance();const [initialCatalog,initialGrants,initialSetup]=await Promise.all([api('agent/catalog',undefined,session.token),api('agent/status',undefined,session.token),api('setup',undefined,session.token)])
    const merged=[...list.map(p=>{const extra=extras.find(e=>e.id===p.id);return {...p,career:p.career||extra?.career,timelineWeeks:p.timelineWeeks||extra?.timelineWeeks}}),...extras.filter(e=>e.id.startsWith('preview:'))]
    if(lifetime.signal.aborted)return
    sessionStorage.setItem('pathwise.session',session.token)
    sessionRef.current=session.token;setToken(session.token);setPlans(merged);setCatalog(initialCatalog);setGrants(initialGrants);setSetup(initialSetup)
    // Landing remains the entry point. Saved plans are available from Roadmap.
    const requested=typeof window!=='undefined'&&[3,6,7,8].includes(stepFromHash(window.location.hash))?(initialGrants as Grant[]).find(g=>g.mode==='testnet')?.planId||initialSetup.checkout?.planId:sessionStorage.getItem('pathwise.lastPlan');const last=merged.find(p=>p.id===requested)||merged[0];if(last){setSaved(last);if(stepFromHash(window.location.hash)!==0)populate(last);if(!previewOnly(last)){try{const value=await api('agent/preview',{planId:last.id,providers:initialGrants.find((g:Grant)=>g.planId===last.id&&g.mode==='testnet')?.providers.map((p:{id:string})=>p.id)||providerDefaults,mode:'testnet'},session.token);if(!lifetime.signal.aborted)setPreview({planId:last.id,mode:'testnet',value})}catch{if(!lifetime.signal.aborted)setConnectionError('Recommendations could not be refreshed. Saved payment records remain available.')}}}
  }catch(e){if(!lifetime.signal.aborted){setError(true);setNotice(e instanceof Error?e.message:'Could not load your session.')}}finally{if(!lifetime.signal.aborted){setBusy(false);setBooting(false)}}}void init();return()=>{lifetime.abort()}},[api])
  const refresh=useCallback(async()=>{const[c,g,s]=await Promise.all([api('agent/catalog'),api('agent/status'),api('setup')]);setCatalog(c);setGrants(g);setSetup(s);setConnectionError('')},[api])
  useEffect(()=>{function land(kind:string,fromOtherTab=false){arrival.current=kind;setMode('testnet');try{sessionStorage.setItem('pathwise.mode','testnet')}catch{/* The fee step still opens for this view. */}window.history.replaceState(null,'',window.location.pathname+window.location.search+routeForStep(7));setStep(7);setNotice(fromOtherTab?(kind==='cancelled'?'Checkout closed before payment. You are still on the service fee step.':'You are back on the service fee step. Purchasing stays off until the fee is verified.'):checkoutNotice(kind));setError(false)}
    const kind=arrival.current
    if(kind){try{localStorage.setItem(checkoutChannel,JSON.stringify({kind,at:Date.now()}))}catch{/* The original tab may already be on this step. */}const popup=Boolean(window.opener&&!window.opener.closed);land(kind);if(popup){setNotice('Close this tab. Your service fee step is still open in the original Pathwise tab.');window.close()}const params=new URLSearchParams(window.location.search);params.delete('checkout');const query=params.toString();window.history.replaceState(null,'',window.location.pathname+(query?`?${query}`:'')+window.location.hash)}
    function onStorage(event:StorageEvent){if(event.key!==checkoutChannel||!event.newValue)return;try{land(JSON.parse(event.newValue).kind==='cancelled'?'cancelled':'returned',true)}catch{land('returned',true)}void refresh()}
    window.addEventListener('storage',onStorage);return()=>window.removeEventListener('storage',onStorage)},[refresh])
  useEffect(()=>{if(!token)return;const lifetime=new AbortController();async function poll(){try{const[c,g,s]=await Promise.all([api('agent/catalog'),api('agent/status'),api('setup')]);if(!lifetime.signal.aborted){setCatalog(c);setGrants(g);setSetup(s);setConnectionError('');}}catch{if(!lifetime.signal.aborted)setConnectionError('Status is unavailable. Saved commitments remain on the server. Check status before retrying payment.')}}void poll();const timer=setInterval(()=>void poll(),2500);return()=>{lifetime.abort();clearInterval(timer)}},[token,api])
  useEffect(()=>{function back(){setStep(stepFromHash(window.location.hash));setNotice('');setError(false)}window.addEventListener('popstate',back);window.addEventListener('hashchange',back);return()=>{window.removeEventListener('popstate',back);window.removeEventListener('hashchange',back)}},[])
  const grant=grants.find(g=>g.mode===mode&&g.planId===saved?.id),activePlan=saved
  const approvedIds=grant?grant.providers.map(p=>p.id):providers
  const previewRoadmap=preview&&preview.planId===saved?.id&&preview.mode===mode?preview.value:null
  const serverRoadmap=previewRoadmap||grant?.roadmapFromGrant||null
  const roadmap=activePlan?roadmapGuidance(activePlan,serverRoadmap):null
  const resource=(id:string)=>catalog?.resources.find(r=>r.id===id)
  const providerName=(id:string)=>catalog?.providers.find(p=>p.id===id)?.name||id
  const decisions=grant?.started&&grant.decisions?.length?grant.decisions.map(decisionFromStored):grant?.started?grant.orders.map(o=>({resourceId:o.resourceId,providerId:o.providerId,priceStroops:o.amountStroops,state:'selected',reason:o.selectionReason})):serverRoadmap?.decisions||[]
  const selected=decisions.filter(d=>d.state==='selected'),skipped=decisions.filter(d=>d.state==='skipped'||d.state==='blocked')
  const ownerReady=Boolean(grant&&setup?.wallet?.owner===grant.owner&&setup?.experiment?.planId===activePlan?.id&&setup?.experiment?.owner===grant.owner)&&['registerDevice','registerAgent','fundEscrow'].every(kind=>setup?.experiment?.ownerOperations.some(op=>op.kind===kind&&op.state==='confirmed'))
  const serviceReady=Boolean(setup?.checkout?.active&&setup.checkout.planId===activePlan?.id)
  const metrics={total:grant?.totalBudgetStroops||activePlan?.budgetStroops||'0',reserve:grant?.reserveStroops||activePlan?.reserveStroops||'0',pending:grant?.pendingStroops||'0',spent:grant?.spentStroops||'0',remaining:grant?.remainingStroops||(activePlan?(BigInt(activePlan.budgetStroops)-BigInt(activePlan.reserveStroops)).toString():'0')}
  function go(next:number){if(window.location.hash!==routeForStep(next))window.history.pushState(null,'',routeForStep(next));window.dispatchEvent(new Event('pathwise:navigate'));setStep(next);setNotice('');setError(false);window.scrollTo({top:0,behavior:'instant'})}
  async function act(work:()=>Promise<unknown>,success=''){if(busy)return;setBusy(true);setError(false);setNotice('');try{await work();if(success)setNotice(success)}catch(e){setError(true);setNotice(e instanceof Error?e.message:'Check status before retrying.')}finally{try{if(token)await refresh()}catch{setConnectionError('Could not refresh status. Check known transaction states before retrying.')}setBusy(false)}}
  async function save(){setBuilding(true);try{
    const budget=exactStroops(draft.budget),limit=exactStroops(draft.limit),reserve=exactStroops(draft.reserve)
    if(budget<=0n||limit<=0n||limit>budget||reserve>budget)throw Error('Use a positive budget and purchase limit. Your reserve and limit cannot exceed the total budget.')
    const supported=careerPurchasingSupported({id:draft.career,goal:draft.goal},catalog)
    const plan:Plan=supported?{...await api('plans',draft),career:draft.career,timelineWeeks:draft.timelineWeeks}:{id:'preview:'+crypto.randomUUID(),...draft,budgetStroops:budget.toString(),limitStroops:limit.toString(),reserveStroops:reserve.toString(),createdAt:new Date().toISOString()}
    remember(plan);setSaved(plan);setPlans([plan,...plans.filter(p=>p.id!==plan.id)])
    if(supported){const value=await api('agent/preview',{planId:plan.id,providers,mode});setPreview({planId:plan.id,mode,value})}else setPreview(null)
    go(2)
  }finally{setBuilding(false)}}
  async function buildRoadmap(stayOnReview=false){if(!activePlan)throw Error('Save your career preferences first.');if(previewOnly(activePlan))return;setBuilding(true);try{const value=await api('agent/preview',{planId:activePlan.id,providers:approvedIds,mode});setPreview({planId:activePlan.id,mode,value});if(!stayOnReview)go(2)}finally{setBuilding(false)}}
  async function connect(){const signer=await noirExtensionSigner(),challenge=await api('wallet/challenge',{owner:signer.publicKey});const signed=await signer.signTransaction(challenge.xdr,{networkPassphrase:Networks.TESTNET});await api('wallet/verify',{id:challenge.id,signedXdr:typeof signed==='string'?signed:signed.signedTxXdr})}
  async function signOwner(kind:string){const signer=await noirExtensionSigner();if(signer.publicKey!==grant?.owner)throw Error('Switch Noir to this authorization’s owner wallet before signing.');const prepared=await api('noir/owner/prepare',{kind}),signed=await signer.signTransaction(prepared.xdr,{networkPassphrase:Networks.TESTNET});await api('noir/owner/submit',{id:prepared.id,signedXdr:typeof signed==='string'?signed:signed.signedTxXdr})}
  const pendingGrant=grants.find(g=>g.mode==='testnet'&&!g.started)
  const unfinishedSetup=Boolean(pendingGrant||(setup?.checkout&&!grants.some(g=>g.mode==='testnet'&&g.planId===setup.checkout!.planId&&g.started))||(activePlan&&!previewOnly(activePlan)&&!grant?.started&&selected.length))
  function resumeSetup(){const id=pendingGrant?.planId||setup?.checkout?.planId||activePlan?.id;const target=plans.find(p=>p.id===id)||activePlan;if(target&&target.id!==activePlan?.id){setSaved(target);populate(target);remember(target);setPreview(null)}return nextSetupStep(target,grants.find(g=>g.mode==='testnet'&&g.planId===target?.id),setup)}
  async function approve(){if(previewOnly(activePlan))throw Error('This career is a planning preview until the backend supports it. No payment can be started.');await api('agent/approve',{planId:activePlan?.id,providers:approvedIds,mode:'testnet'});go(8)}
  function selectMode(next:string){if(next!=='testnet')return;setMode('testnet');try{sessionStorage.setItem('pathwise.mode','testnet')}catch{/* The in-memory mode stays Testnet. */}setPreview(null);setNotice('');setError(false);const match=grants.find(g=>g.mode==='testnet'),plan=match?plans.find(p=>p.id===match.planId):null;if(plan){setSaved(plan);populate(plan);remember(plan)}}
  function toggleProvider(id:string){setProviders(providers.includes(id)?providers.filter(v=>v!==id):[...providers,id]);setPreview(null)}
  function viewPlan(id:string){const plan=plans.find(p=>p.id===id)||savedGuidance().find(p=>p.id===id);if(plan){setSaved(plan);populate(plan);remember(plan);setPreview(null)}go(2)}
  return {unfinishedSetup,plans,alternatives:skipped,compared:Boolean(serverRoadmap||grant?.started||previewOnly(activePlan)),step,token,busy,booting,building,grants,careers,previewOnly:previewOnly(activePlan),notice,error,connectionError,draft,setDraft,catalog,setup,grant,activePlan,approvedIds,roadmap,selected,skipped,gaps:roadmap?.gaps||[],ownerReady,serviceReady,metrics,mode,selectMode,resource,providerName,go,act,api,refresh,save,buildRoadmap,connect,signOwner,approve,resumeSetup,toggleProvider,viewPlan}
}
export type Pathwise=ReturnType<typeof usePathwise>
