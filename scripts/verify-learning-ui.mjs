import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Local rendering fixtures only: no credentials, database, wallet or network calls.
const server = await createServer({ root: 'apps/web', server: { middlewareMode: true, watch: null }, appType: 'custom' })
let checks = 0
function check(work) { work(); checks++ }
try {
  const { purchasingBudget, filterResources, available, resourceStage } = await server.ssrLoadModule('/src/learning.ts')
  const { ResourceCard, BudgetSummary } = await server.ssrLoadModule('/src/LearningComponents.tsx')
  const { GoalView } = await server.ssrLoadModule('/src/GoalView.tsx')
  const { default: App } = await server.ssrLoadModule('/src/App.tsx')
  const { ExploreView } = await server.ssrLoadModule('/src/ExploreView.tsx')
  const { RoadmapView } = await server.ssrLoadModule('/src/RoadmapView.tsx')
  const { DashboardView } = await server.ssrLoadModule('/src/DashboardView.tsx')
  const { AuthorizationView } = await server.ssrLoadModule('/src/AuthorizationView.tsx')
  const { ServiceSummary } = await server.ssrLoadModule('/src/components.tsx')
  const noop = () => {}
  const course = { id: 'course', providerId: 'a', title: 'Test course', skills: ['Cloud concepts'], format: 'course', priceStroops: '80000000' }
  const lab = { id: 'lab', providerId: 'b', title: 'Test lab', skills: ['Security'], format: 'lab', priceStroops: '60000000' }
  const catalog = { providers: [{id:'a',name:'Demo A',merchant:null},{id:'b',name:'Demo B',merchant:null}], resources:[course,lab], skillMap:{skills:['Cloud concepts','Security']} }
  const plan = { id:'plan', goal:'AWS Certified Cloud Practitioner', skills:[], formats:['course','lab'], budgetStroops:'300000000',reserveStroops:'100000000',limitStroops:'100000000' }
  const base = { draft:{goal:plan.goal,skills:[],formats:['course','lab'],budget:'30',reserve:'10',limit:'10'}, setDraft:noop,go:noop,act:noop,api:noop,save:noop,buildRoadmap:noop,approve:noop,selectMode:noop,toggleProvider:noop,connect:noop,refresh:noop,signOwner:noop,token:'test-only',busy:false,mode:'simulation',activePlan:plan,grant:null,catalog,approvedIds:['a','b'],metrics:{total:'300000000',reserve:'100000000',pending:'0',spent:'0',remaining:'200000000'},selected:[],skipped:[],gaps:['Security'],roadmap:null,providerName:id=>id==='a'?'Demo A':'Demo B',resource:id=>catalog.resources.find(r=>r.id===id),setup:{wallet:null,noir:{ready:false,blockers:['Payments disabled.']},velo:{ready:false,blockers:['Payments disabled.'],amount:'1'},checkout:null,experiment:null} }
  const order = {id:'test-order',resourceId:'course',providerId:'a',amountStroops:'80000000',status:'simulated',selectionReason:'Test selection.',reason:'Simulation only.',authorization:'not_started',claim:'not_started',fulfillment:'locked',sampleAccessCode:null,authorizeHash:null,claimHash:null}
  const render = (View,p=base) => renderToStaticMarkup(createElement(View,{p}))
  check(()=>assert.equal(purchasingBudget('0.3000001','0.1'),'0.2000001 test XLM'))
  check(()=>assert.equal(purchasingBudget('10','10'),'0 test XLM'))
  check(()=>assert.equal(purchasingBudget('10','11'),'Reserve exceeds budget'))
  check(()=>assert.equal(purchasingBudget('1e3','0'),'Enter valid amounts'))
  check(()=>assert.deepEqual(filterResources(catalog,'Security','lab','b'),[lab]))
  check(()=>assert.equal(filterResources(catalog,'Security','course','b').length,0))
  check(()=>assert.equal(available({...order,fulfillment:'fulfilled',sampleAccessCode:'TEST-ONLY'}),false))
  check(()=>assert.equal(available({...order,authorization:'authorized',claim:'claimed',fulfillment:'fulfilled',sampleAccessCode:'TEST-ONLY'}),true))
  check(()=>assert.equal(resourceStage(order),'Simulated · no access'))
  check(()=>assert.equal(resourceStage({...order,status:'claimed',claim:'claimed',authorization:'authorized'}),'Purchased · access pending'))
  check(()=>assert.match(render(GoalView),/STEP 1 OF 4/))
  check(()=>assert.match(render(GoalView),/Certification goal/))
  check(()=>assert.match(render(GoalView,{...base,busy:true}),/disabled/))
  check(()=>assert.match(render(ExploreView),/filter-skill/))
  check(()=>assert.match(render(ExploreView),/Browsing never authorizes a purchase/))
  check(()=>assert.doesNotMatch(renderToStaticMarkup(createElement(ResourceCard,{resource:course,provider:'Demo A'})),/Suggested for you/))
  check(()=>assert.match(renderToStaticMarkup(createElement(ResourceCard,{resource:course,provider:'Demo A',reason:'Covers a gap.'})),/Suggested for you/))
  check(()=>assert.match(render(BudgetSummary),/Available for learning resources/))
  check(()=>assert.match(render(RoadmapView,{...base,activePlan:null}),/A goal comes first/))
  check(()=>assert.match(render(RoadmapView,{...base,roadmap:{},selected:[]}),/No suitable purchase/))
  const grant={id:'grant',mode:'simulation',planId:'plan',started:true,expiresAt:'2099-01-01T00:00:00Z',providers:[],perPurchaseLimitStroops:'100000000',simulatedStroops:'80000000',orders:[order]}
  check(()=>assert.match(render(DashboardView,{...base,grant}),/Simulated · no access/))
  check(()=>assert.doesNotMatch(render(DashboardView,{...base,grant}),/stellar\.expert|<code>/))
  check(()=>assert.match(render(AuthorizationView,{...base,mode:'testnet'}),/Not connected/))
  check(()=>assert.doesNotMatch(render(AuthorizationView),/Connect &amp; verify Noir wallet/))
  const mismatch={...base,setup:{...base.setup,checkout:{planId:'other',active:true,status:'paid',amount:'1'}}}
  check(()=>assert.match(render(ServiceSummary,mismatch),/Checkout belongs to another goal/))
  check(()=>assert.doesNotMatch(render(ServiceSummary,mismatch),/Verified service payment/))
  check(()=>assert.match(render(DashboardView,{...base,grant:{...grant,started:false,expiresAt:'2000-01-01T00:00:00Z'}}),/authorization has expired/))
  check(()=>assert.match(renderToStaticMarkup(createElement(App)),/Your next milestone starts here/))
  check(()=>assert.match(render(GoalView),/Build my learning path/))
  check(()=>assert.match(renderToStaticMarkup(createElement(ResourceCard,{resource:course,provider:'Demo A'})),/Preview this resource/))
  check(()=>assert.match(renderToStaticMarkup(createElement(ResourceCard,{resource:course,provider:'Demo A'})),/aria-hidden="true"/))
  check(()=>assert.match(renderToStaticMarkup(createElement(ResourceCard,{resource:course,provider:'Demo A',order:{...order,status:'blocked'},onView:noop})),/Purchase blocked/))
  check(()=>assert.match(renderToStaticMarkup(createElement(ResourceCard,{resource:course,provider:'Demo A',order,onView:noop})),/View in My resources/))
  check(()=>assert.doesNotMatch(renderToStaticMarkup(createElement(ResourceCard,{resource:course,provider:'Demo A',onView:noop})),/View in My resources/))
  check(()=>assert.match(renderToStaticMarkup(createElement(ResourceCard,{resource:{...course,priceStroops:'90000000'},provider:'Demo A',order})),/>8 /))
  console.log(`Passed ${checks} learner UI checks. Rendering fixtures only; not browser or payment evidence.`)
} finally { await server.close() }
