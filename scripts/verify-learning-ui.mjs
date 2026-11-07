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
  const { careerChoices, roadmapGuidance, exactStroops } = await server.ssrLoadModule('/src/career-guidance.ts')
  const { HomeView } = await server.ssrLoadModule('/src/HomeView.tsx')
  const { ActivityView } = await server.ssrLoadModule('/src/ActivityView.tsx')
  const { GoalView } = await server.ssrLoadModule('/src/GoalView.tsx')
  const { default: App } = await server.ssrLoadModule('/src/App.tsx')
  const { ExploreView } = await server.ssrLoadModule('/src/ExploreView.tsx')
  const { RoadmapView } = await server.ssrLoadModule('/src/RoadmapView.tsx')
  const { DashboardView } = await server.ssrLoadModule('/src/DashboardView.tsx')
  const { AuthorizationView, WalletPage, FeePage } = await server.ssrLoadModule('/src/AuthorizationView.tsx')
  const { ServiceSummary } = await server.ssrLoadModule('/src/components.tsx')
  const noop = () => {}
  const course = { id: 'course', providerId: 'a', title: 'Test course', skills: ['Cloud concepts'], format: 'course', priceStroops: '80000000' }
  const lab = { id: 'lab', providerId: 'b', title: 'Test lab', skills: ['Security'], format: 'lab', priceStroops: '60000000' }
  const catalog = { providers: [{id:'a',name:'Demo A',merchant:null},{id:'b',name:'Demo B',merchant:null}], resources:[course,lab], skillMap:{skills:['Cloud concepts','Security']} }
  const plan = { id:'plan', goal:'AWS Certified Cloud Practitioner', skills:[], formats:['course','lab'], budgetStroops:'300000000',reserveStroops:'100000000',limitStroops:'100000000' }
  const base = {careers:careerChoices,grants:[],compared:true,previewOnly:false, draft:{goal:plan.goal,skills:[],formats:['course','lab'],budget:'30',reserve:'10',limit:'10'}, setDraft:noop,go:noop,act:noop,api:noop,save:noop,buildRoadmap:noop,approve:noop,selectMode:noop,toggleProvider:noop,connect:noop,refresh:noop,signOwner:noop,token:'test-only',busy:false,mode:'simulation',activePlan:plan,grant:null,catalog,approvedIds:['a','b'],metrics:{total:'300000000',reserve:'100000000',pending:'0',spent:'0',remaining:'200000000'},selected:[],skipped:[],alternatives:[],gaps:['Security'],roadmap:null,providerName:id=>id==='a'?'Demo A':'Demo B',resource:id=>catalog.resources.find(r=>r.id===id),setup:{wallet:null,noir:{ready:false,blockers:['Payments disabled.']},velo:{ready:false,blockers:['Payments disabled.'],amount:'1'},checkout:null,experiment:null} }
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
  check(()=>assert.equal(resourceStage(order),'Recorded · no access'))
  check(()=>assert.equal(resourceStage({...order,status:'claimed',claim:'claimed',authorization:'authorized'}),'Purchased · access pending'))
  check(()=>assert.match(render(GoalView),/STEP 1 OF 4/))
  check(()=>assert.match(render(GoalView),/Cloud Engineer/))
  check(()=>assert.match(render(GoalView,{...base,busy:true}),/disabled/))
  check(()=>assert.match(render(ExploreView),/filter-skill/))
  check(()=>assert.match(render(ExploreView),/Browsing never authorizes a purchase/))
  check(()=>assert.doesNotMatch(renderToStaticMarkup(createElement(ResourceCard,{resource:course,provider:'Demo A'})),/Why it was selected/))
  check(()=>assert.match(renderToStaticMarkup(createElement(ResourceCard,{resource:course,provider:'Demo A',reason:'Covers a gap.'})),/Why it was selected/))
  check(()=>assert.match(render(BudgetSummary),/Available for learning resources/))
  check(()=>assert.match(render(RoadmapView,{...base,activePlan:null}),/Save a career and budget first/))
  check(()=>assert.match(render(RoadmapView,{...base,roadmap:{engine:'rule-based',outcome:'no_suitable_purchase',gaps:[],decisions:[],remainingStroops:'0'},selected:[],skipped:[],alternatives:[]}),/No suitable purchase/))
  const grant={id:'grant',mode:'simulation',planId:'plan',started:true,expiresAt:'2099-01-01T00:00:00Z',providers:[],perPurchaseLimitStroops:'100000000',simulatedStroops:'80000000',roadmapFromGrant:{engine:'rule-based',outcome:'purchases_planned',gaps:['Security'],decisions:[],remainingStroops:'0'},decisions:[],orders:[order]}
  check(()=>assert.match(render(DashboardView,{...base,grant}),/Recorded · no access/))
  check(()=>assert.doesNotMatch(render(DashboardView,{...base,grant}),/stellar\.expert|<code>/))
  check(()=>assert.match(render(AuthorizationView,{...base,mode:'testnet',selected:[{resourceId:'course',providerId:'a',priceStroops:'1',state:'selected',reason:'gap'}]}),/Continue to wallet/))
  check(()=>assert.doesNotMatch(render(AuthorizationView,{...base,mode:'testnet'}),/Not connected|Pay the 1 test XLM/))
  check(()=>assert.match(render(WalletPage,{...base,mode:'testnet',step:6}),/Not connected/))
  check(()=>assert.match(render(FeePage,{...base,mode:'testnet',step:7}),/Pay the 1 test XLM/))
  check(()=>assert.doesNotMatch(render(AuthorizationView),/Connect &amp; verify Noir wallet|Explore in simulation|simulation/i))
  const mismatch={...base,setup:{...base.setup,checkout:{planId:'other',active:true,status:'paid',amount:'1'}}}
  check(()=>assert.match(render(ServiceSummary,mismatch),/Checkout belongs to another goal/))
  check(()=>assert.doesNotMatch(render(ServiceSummary,mismatch),/Verified service payment/))
  check(()=>assert.match(render(DashboardView,{...base,grant:{...grant,started:false,expiresAt:'2000-01-01T00:00:00Z'}}),/authorization has expired/))
  check(()=>assert.match(renderToStaticMarkup(createElement(App)),/Loading Pathwise/))
  check(()=>assert.match(render(GoalView),/Continue/))
  check(()=>assert.match(renderToStaticMarkup(createElement(ResourceCard,{resource:course,provider:'Demo A'})),/Preview this resource/))
  check(()=>assert.match(renderToStaticMarkup(createElement(ResourceCard,{resource:course,provider:'Demo A'})),/aria-hidden="true"/))
  check(()=>assert.match(renderToStaticMarkup(createElement(ResourceCard,{resource:course,provider:'Demo A',order:{...order,status:'blocked'},onView:noop})),/Purchase blocked/))
  check(()=>assert.match(renderToStaticMarkup(createElement(ResourceCard,{resource:course,provider:'Demo A',order,onView:noop})),/View in My resources/))
  check(()=>assert.doesNotMatch(renderToStaticMarkup(createElement(ResourceCard,{resource:course,provider:'Demo A',onView:noop})),/View in My resources/))
  check(()=>assert.match(renderToStaticMarkup(createElement(ResourceCard,{resource:{...course,priceStroops:'90000000'},provider:'Demo A',order})),/>8 /))
  check(()=>assert.match(render(HomeView),/Build my roadmap/))
  check(()=>assert.match(render(HomeView),/Data Analyst/))
  check(()=>assert.doesNotMatch(render(ActivityView),/Confirmed authorization/))
  const cloud = roadmapGuidance({...plan,career:'cloud',timelineWeeks:12})
  const data = roadmapGuidance({...plan,career:'data',timelineWeeks:4})
  check(()=>assert.notDeepEqual(cloud.gaps,data.gaps))
  check(()=>assert.equal(data.steps[3].weekEnd,4))
  check(()=>assert.equal(roadmapGuidance({...plan,career:'data',skills:['SQL']}).gaps.includes('SQL'),false))
  check(()=>assert.equal(exactStroops('0.0000001'),1n))
  check(()=>assert.throws(()=>exactStroops('1e2')))
  check(()=>assert.throws(()=>exactStroops('1.00000001')))
  check(()=>assert.match(render(RoadmapView,{...base,previewOnly:true,roadmap:data}),/Planning preview/))
  check(()=>assert.doesNotMatch(render(RoadmapView,{...base,previewOnly:true,roadmap:data}),/Review &amp; authorize spending/))
  check(()=>assert.match(render(ActivityView,{...base,grants:[{...grant,mode:'testnet',orders:[{...order,authorization:'authorized',authorizeHash:'a'.repeat(64)}]}]}),/Confirmed authorization/))
  check(()=>assert.doesNotMatch(render(AuthorizationView,{...base,previewOnly:true,mode:'testnet'}),/Connect &amp; verify Noir wallet|Create service checkout/))
  check(()=>assert.match(render(ExploreView),/Microsoft Azure Fundamentals/))
  const { decisionFromStored } = await server.ssrLoadModule('/src/ui.ts')
  const stored = [{resourceId:'course',providerId:'a',priceStroops:'80000000',decision:'selected',reason:'Stored selection'}, {resourceId:'lab',providerId:'b',priceStroops:'60000000',decision:'blocked',reason:'Exceeds the per-purchase limit.'}]
  const restored = stored.map(decisionFromStored)
  check(()=>assert.deepEqual(restored.map(d=>d.state),['selected','blocked']))
  check(()=>assert.equal(decisionFromStored(restored[0]).state,'selected'))
  const restoredMarkup = render(RoadmapView,{...base,selected:restored.filter(d=>d.state==='selected'),skipped:restored.filter(d=>d.state!=='selected')})
  check(()=>assert.match(restoredMarkup,/Stored selection/))
  check(()=>assert.match(restoredMarkup,/>Blocked</))
  check(()=>assert.match(restoredMarkup,/Exceeds the per-purchase limit/))
  console.log(`Passed ${checks} learner UI checks. Rendering fixtures only; not browser or payment evidence.`)
} finally { await server.close() }
