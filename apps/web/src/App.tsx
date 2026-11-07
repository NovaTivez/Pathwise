import { useEffect, useRef, useState } from 'react'
import { usePathwise } from './usePathwise'
import { HomeView } from './HomeView'
import { GoalView } from './GoalView'
import { AuthorizationView } from './AuthorizationView'
import { RoadmapView } from './RoadmapView'
import { DashboardView } from './DashboardView'
import { ExploreView } from './ExploreView'
import { ActivityView } from './ActivityView'
import './App.css'
import './journey.css'
import './atmosphere.css'
export default function App(){
  const p=usePathwise(),heading=useRef<HTMLHeadingElement>(null),[menuOpen,setMenuOpen]=useState(false)
  function navigate(step:number){setMenuOpen(false);p.go(step)}
  useEffect(()=>{if(p.step!==-1)heading.current?.focus()},[p.step])
  const activity=p.grants.some(g=>g.orders.length>0)||Boolean(p.setup?.checkout?.transactionHash)
  const title=p.step===0?'Let’s find your direction.':p.step===1?'A little clarity before you start.':p.step===2?`${p.roadmap?.career||'Your next chapter'}, step by step.`:p.step===4?'Find your next learning resource.':p.step===5?'Every step, accounted for.':'Your next move, with confidence.'
  if(p.booting)return <main className="brand-loading" role="status"><span className="loading-mark">p</span><strong>pathwise</strong><span className="loading-line"/><p>Finding your starting point…</p></main>
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to main content</a><header className="site-header"><a className="brand" href="#home" onClick={e=>{e.preventDefault();navigate(-1)}} aria-label="Pathwise home"><span className="brand-mark" aria-hidden="true">p</span>pathwise<span className="brand-flower" aria-hidden="true">✳</span></a><button className="menu-toggle secondary" aria-expanded={menuOpen} aria-controls="learner-navigation" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?'Close':'Menu'}</button><nav id="learner-navigation" className={`top-nav ${menuOpen?'is-open':''}`} aria-label="Main navigation">{[[-1,'Home'],[0,'Careers'],[2,'Roadmap'],...(activity?[[5,'Activity']]:[])].map(([step,label])=><button key={label} aria-current={p.step===step?'page':undefined} className={p.step===step?'active':''} onClick={()=>navigate(Number(step))}>{label}</button>)}</nav><button className="header-action secondary" onClick={()=>navigate(p.activePlan?1:0)}>{p.setup?.wallet?'Wallet connected':'Your spending rules'} <span aria-hidden="true">↗</span></button></header>
    <main id="main-content" tabIndex={-1}>{p.step!==-1&&<div className="page-intro journey-intro"><span className="eyebrow">{p.step===0?'A PATH THAT FITS YOU':p.step===2?'YOUR PERSONAL ROADMAP':p.step===5?'YOUR ACTIVITY':'YOU STAY IN CONTROL'}</span><h1 ref={heading} tabIndex={-1}>{title}</h1></div>}
      {p.connectionError&&<div className="notice error" role="alert"><p>{p.connectionError}</p><button className="text-button" disabled={p.busy} onClick={()=>void p.act(p.refresh,'Status refreshed.')}>Retry status</button></div>}
      {p.notice&&<div className={`notice ${p.error?'error':''}`} role={p.error?'alert':'status'}>{p.notice}{!p.token&&p.error&&<button onClick={()=>window.location.reload()}>Reconnect</button>}</div>}
      {p.building?<section className="roadmap-loading" role="status" aria-live="polite"><span className="loading-mark">p</span><h2>Building your roadmap</h2><p>Finding your skill gaps. Comparing resources. Protecting your exam reserve.</p><span className="loading-line"/></section>:<>{p.step===-1&&<HomeView p={p}/>} {p.step===0&&<GoalView p={p}/>} {p.step===1&&<AuthorizationView p={p}/>} {p.step===2&&<RoadmapView p={p}/>} {p.step===3&&<DashboardView p={p}/>} {p.step===4&&<ExploreView p={p}/>} {p.step===5&&<ActivityView p={p}/>}</>}
      <footer><a className="footer-brand" href="#home" onClick={e=>{e.preventDefault();navigate(-1)}}>pathwise<span aria-hidden="true"> ✳</span></a><span>Good direction. Thoughtful spending.<br/>Demo providers & prices · Stellar Testnet only · No real course or exam orders.</span></footer>
    </main></div>
}
