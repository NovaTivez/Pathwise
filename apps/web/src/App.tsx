import { useEffect, useRef, useState } from 'react'
import { usePathwise } from './usePathwise'
import { GoalView } from './GoalView'
import { AuthorizationView } from './AuthorizationView'
import { RoadmapView } from './RoadmapView'
import { DashboardView } from './DashboardView'
import { ExploreView } from './ExploreView'
import './App.css'
const sections = [{ label: 'My learning path', step: 2 }, { label: 'Explore resources', step: 4 }, { label: 'My resources', step: 3 }]
export default function App() {
  const p = usePathwise(), heading = useRef<HTMLHeadingElement>(null), accountMenu = useRef<HTMLDetailsElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  function navigate(step: number) { setMenuOpen(false); if (accountMenu.current) accountMenu.current.open = false; p.go(step) }
  useEffect(() => { heading.current?.focus() }, [p.step])
  const title = p.step === 0 ? 'Your next milestone starts here.' : p.step === 1 ? 'A little clarity before you start.' : p.step === 2 ? p.activePlan?.goal || 'Your learning path starts with a goal.' : p.step === 4 ? 'A little curiosity. The right resources.' : 'Your resources, all in one place.'
  const subtitle = p.step === 0 ? 'Let’s make a learning path around what you know, how you learn, and what you want to spend.' : p.step === 1 ? 'Choose your providers and spending boundaries. You stay in control.' : p.step === 2 ? 'Build on what you know. Find the materials that help with what comes next.' : p.step === 4 ? 'Explore the demo collection. Your agent still checks every selection against your learning goals and spending rules.' : 'Keep track of purchases and demo access. Buying a resource does not mean you have completed it.'
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="site-header"><a className="brand" href="#main-content" onClick={() => navigate(p.activePlan ? 2 : 0)} aria-label="Pathwise home"><span className="brand-mark" aria-hidden="true">p</span>pathwise</a>
      <button className="menu-toggle secondary" aria-expanded={menuOpen} aria-controls="learner-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close menu' : 'Menu'}</button>
      <nav id="learner-navigation" className={`top-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">{sections.map(({label,step}) => <button className={p.step === step || step === 2 && p.step < 2 ? 'active' : ''} aria-current={p.step === step || step === 2 && p.step < 2 ? 'page' : undefined} key={step} onClick={() => navigate(step)}>{label}</button>)}</nav>
      <div className="header-controls"><button className="wallet-control text-button" onClick={() => navigate(1)}>{p.setup?.wallet ? 'Wallet verified' : 'Wallet setup'}<span aria-hidden="true"> ↗</span></button><details ref={accountMenu} className="account-menu"><summary>My space</summary><div className="account-popover"><strong>Your browser session</strong><p>Your saved goal and resources belong to this session. Keep this tab to return to them.</p><button className="text-button" onClick={() => navigate(0)}>Learning preferences</button><button className="text-button" onClick={() => navigate(1)}>Spending & payment settings</button></div></details></div>
    </header>
    <main id="main-content" tabIndex={-1}><div className="page-topline"><span className="eyebrow">{p.step === 0 ? 'A PATH THAT FITS YOU' : p.step === 1 ? 'YOUR LEARNING, YOUR LIMITS' : p.step === 4 ? 'THE DEMO COLLECTION' : p.step === 3 ? 'MY RESOURCE LIBRARY' : 'MY LEARNING PATH'}</span><span className={`mode-label ${p.mode === 'testnet' ? 'testnet' : ''}`}>{p.mode === 'simulation' ? 'Simulation · no funds move' : 'Stellar Testnet · test currency only'}</span></div>
      <div className="page-intro"><h1 ref={heading} tabIndex={-1}>{title}</h1><p className="page-subtitle">{subtitle}</p></div>
      {p.connectionError && <div className="notice error" role="alert"><p>{p.connectionError}</p><button className="text-button" disabled={p.busy} onClick={() => void p.act(p.refresh, 'Status refreshed.')}>Retry status</button></div>}
      {p.notice && <div className={`notice ${p.error ? 'error' : ''}`} role={p.error ? 'alert' : 'status'}>{p.notice}{!p.token && p.error && <button className="text-button" onClick={() => window.location.reload()}>Reload session</button>}</div>}
      {p.step === 0 && <GoalView p={p} />}{p.step === 1 && <AuthorizationView p={p} />}{p.step === 2 && <RoadmapView p={p} />}{p.step === 3 && <DashboardView p={p} />}{p.step === 4 && <ExploreView p={p} />}
      <footer><a className="footer-brand" href="#main-content">pathwise</a><span>Fictional demo providers & prices · Stellar Testnet only<br />No commercial courses or exam vouchers are purchased.</span></footer>
    </main></div>
}
