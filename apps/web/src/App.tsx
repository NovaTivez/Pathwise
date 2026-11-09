import { useEffect, useRef, useState } from 'react'
import { usePathwise, type Pathwise } from './usePathwise'
import { HomeView } from './HomeView'
import { GoalView } from './GoalView'
import { AuthorizationView, EscrowPage, FeePage, WalletPage } from './AuthorizationView'
import { RoadmapView } from './RoadmapView'
import { DashboardView } from './DashboardView'
import { ExploreView } from './ExploreView'
import { ActivityView } from './ActivityView'
import { Icon } from './Icon'
import './App.css'
import './stitch.css'

export default function App() {
  const p = usePathwise()
  return <PathwiseShell p={p}/>
}
export function PathwiseShell({ p }: { p: Pathwise }) {
  const heading = useRef<HTMLHeadingElement>(null), [menuOpen, setMenuOpen] = useState(false)
  function navigate(step: number) { setMenuOpen(false); p.go(step) }
  useEffect(() => { if (p.step !== -1) heading.current?.focus() }, [p.step])
  const home = p.step === -1
  const activeGoal = p.step === 0 ? p.draft.goal : p.activePlan?.goal
  const title = p.step === 0 ? 'Set up your learning plan' : p.step === 1 ? 'Review your spending plan' : p.step === 2 ? p.activePlan?.goal || 'My roadmap' : p.step === 4 ? 'Resource catalog' : p.step === 6 ? 'Connect your Noir wallet' : p.step === 7 ? 'Your Velo service payment' : p.step === 8 ? 'Authorize learning purchases' : 'Purchases'
  const navigation = [[-1, 'Home', 'home'], [0, 'Setup plan', 'plan'], [2, 'My roadmap', 'roadmap'], [4, 'Resources', 'book'], [5, 'Purchases', 'wallet']] as const
  if (p.booting) return <main className="brand-loading" role="status"><span className="loading-mark"><Icon name="cap" /></span><strong>Pathwise</strong><span className="loading-line" /><p>Loading Pathwise…</p></main>
  return <div className={`app-shell stitch-app ${home ? 'is-home' : 'is-workspace'}`}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="site-header">
      <a className="brand" href="#home" onClick={e => { e.preventDefault(); navigate(-1) }} aria-label="Pathwise home"><Icon name="cap" />Pathwise</a>
      {!home && <span className="workspace-track"><Icon name="cap" />{activeGoal || 'Your next chapter starts here'}</span>}
      <button className="menu-toggle secondary" aria-expanded={menuOpen} aria-controls="learner-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close menu' : 'Menu'}</button>
      <nav id="learner-navigation" className={`top-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
        {!home && <div className="sidebar-track"><span className="eyebrow">YOUR STUDY GOAL</span><strong>{activeGoal || 'Choose your path'}</strong></div>}
        {navigation.map(([step, label, icon]) => { const active = p.step === step || (step === 5 && [1,3,6,7,8].includes(p.step)); return <button key={step} aria-current={active ? 'page' : undefined} className={active ? 'active' : ''} onClick={() => navigate(step)}><Icon name={icon} />{label}</button> })}
        {!home && <div className="sidebar-note"><Icon name="shield" /><strong>Your pace. Your boundaries.</strong><p>Curated guidance, protected exam reserve, and spending you approve.</p><span className="testnet-label">Stellar Testnet · No real funds</span></div>}
      </nav>
      <div className="header-status"><span className="testnet-label"><i />Stellar Testnet</span>{p.unfinishedSetup ? <button className="secondary setup-resume" disabled={p.busy} onClick={() => navigate(p.resumeSetup())}>Continue setup <Icon name="arrow" /></button> : !home && <span className="session-label">{p.setup?.wallet ? 'Wallet verified' : 'Learner session'}</span>}</div>
    </header>
    <main id="main-content" tabIndex={-1}>
      {!home && <div className="page-intro journey-intro"><span className="eyebrow">{p.step === 0 ? 'YOUR LEARNING BLUEPRINT' : p.step === 2 ? 'CURATED STUDY ROADMAP' : p.step === 4 ? 'EXPLORE YOUR MATERIALS' : 'YOUR PURCHASES & WALLET'}</span><h1 ref={heading} tabIndex={-1}>{title}</h1>{p.step === 2 && <p>Build your skills, one intentional step at a time. {p.activePlan?.timelineWeeks || 12}-week suggested study plan.</p>}</div>}
      {p.connectionError && <div className="notice error" role="alert"><p>{p.connectionError}</p><button className="text-button" disabled={p.busy} onClick={() => void p.act(p.refresh, 'Status refreshed.')}>Retry status</button></div>}
      {p.notice && <div className={`notice ${p.error ? 'error' : ''}`} role={p.error ? 'alert' : 'status'}>{p.notice}{!p.token && p.error && <button onClick={() => window.location.reload()}>Reconnect</button>}</div>}
      {p.building ? <section className="roadmap-loading" role="status" aria-live="polite"><span className="loading-mark"><Icon name="cap" /></span><h2>Building your roadmap</h2><p>Comparing resources with your skills and budget.</p><span className="loading-line" /></section> : <>
        {p.step === -1 && <HomeView p={p} />}{p.step === 0 && <GoalView p={p} />}{p.step === 1 && <AuthorizationView p={p} />}{p.step === 6 && <WalletPage p={p} />}{p.step === 7 && <FeePage p={p} />}{p.step === 8 && <EscrowPage p={p} />}{p.step === 2 && <RoadmapView p={p} />}{p.step === 3 && <DashboardView p={p} />}{p.step === 4 && <ExploreView p={p} />}{p.step === 5 && <ActivityView p={p} />}
      </>}
      <footer><a className="footer-brand" href="#home" onClick={e => { e.preventDefault(); navigate(-1) }}><Icon name="cap" />Pathwise</a><span>Plan with purpose. Learn with direction.</span></footer>
    </main>
  </div>
}
