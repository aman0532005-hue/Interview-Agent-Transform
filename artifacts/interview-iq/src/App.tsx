import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { interviewTurn, type InterviewEvaluation, type InterviewFeedback, type InterviewInput, type InterviewResponse } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ArrowRight, BarChart3, BrainCircuit, Check, CheckCircle2, ChevronRight,
  CircleHelp, Code2, FileText, History, LayoutDashboard, Lightbulb, LogOut, Menu, Paperclip, Play, Plus, RotateCcw,
  Send, Settings as SettingsIcon, ShieldCheck, Sparkles, Target, UserRound,
  X, Zap,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
type Candidate = { name: string; email: string; role: string; experience: string; bio: string; skills: string[]; resumeName?: string };
type InterviewConfig = { role: string; type: string; difficulty: string; duration: string; topics: string[] };
type InterviewSession = {
  id: string;
  date: string;
  config: InterviewConfig;
  score: number;
  status: string;
  strengths: string[];
  gaps: string[];
  feedback?: InterviewFeedback;
  scoreHistory?: InterviewFeedback['scoreHistory'];
  topicsCovered?: string[];
};
type ToastState = { title: string; message: string } | null;

const defaultCandidate: Candidate = { name: '', email: '', role: 'Senior Software Engineer', experience: '5–7 years', bio: '', skills: ['TypeScript', 'React', 'System design'] };
const demoCandidate: Candidate = { name: 'Maya Chen', email: 'maya.chen@example.com', role: 'Senior Software Engineer', experience: '5–7 years', bio: 'Product-minded engineer who likes turning ambiguous systems into clear, durable interfaces.', skills: ['TypeScript', 'React', 'System design'], resumeName: 'maya-chen-resume.pdf' };
const getStore = <T,>(key: string, fallback: T): T => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } };
const setStore = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));
const initials = (name: string) => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'IQ';

function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 3300); return () => window.clearTimeout(timer); }, [toast]);
  return { toast, showToast: (title: string, message: string) => setToast({ title, message }) };
}

function Brand({ light = false }: { light?: boolean }) {
  return <span className="brand" style={light ? { color: 'white' } : undefined}><span className="brand-mark"><Zap size={16} strokeWidth={3} /></span><span>InterviewIQ</span></span>;
}

function Toast({ toast }: { toast: ToastState }) {
  return toast ? <div className="toast" data-testid="status-toast"><strong>{toast.title}</strong>{toast.message}</div> : null;
}

function PublicNav() {
  return <header className="page-width public-nav">
    <Link href="/" data-testid="link-home"><Brand /></Link>
    <nav className="nav-links"><a href="#product" data-testid="link-product">Product</a><a href="#method" data-testid="link-method">Method</a><a href="#intelligence" data-testid="link-intelligence">Intelligence</a></nav>
    <div style={{ display: 'flex', gap: 9 }}><Link className="btn btn-ghost btn-sm" href="/login" data-testid="link-login">Log in</Link><Link className="btn btn-primary btn-sm" href="/signup" data-testid="link-signup">Start sharpening <ArrowRight size={14} /></Link></div>
  </header>;
}

function Landing() {
  return <div className="landing">
    <PublicNav />
    <main>
      <section className="hero page-width">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">The private workspace for sharper interviews</span>
            <h1 className="display">Practice like the <em>signal</em> matters.</h1>
            <p className="hero-copy">InterviewIQ turns technical interview practice into a focused loop: answer under pressure, see what held, then get the next question that will actually move you forward.</p>
            <div className="hero-actions"><Link className="btn btn-primary" href="/signup" data-testid="button-start-free">Start a practice session <ArrowRight size={16} /></Link><a className="btn btn-ghost" href="#product" data-testid="button-view-demo"><Play size={15} /> See how it works</a></div>
            <div className="proof-line"><span className="proof-dot" /><span>Built for engineers who want useful feedback, not applause.</span></div>
          </div>
          <div className="hero-console" aria-label="InterviewIQ product preview">
            <div className="console-top"><Brand light /><span className="mono">SESSION / 04</span></div>
            <div className="console-window"><span className="console-label">Adaptive prompt · system design</span><div className="console-question">Design a rate limiter for a multi-region API.</div><div className="console-answer">“I’d start by clarifying the traffic shape, then choose a token bucket at the edge…”</div><div className="console-footer"><span>Signal detected: clarifying scope</span><span className="signal-bars"><i /><i /><i /></span></div></div>
          </div>
        </div>
      </section>
      <section id="product" className="section page-width">
        <div className="section-heading"><span className="eyebrow">A better practice loop</span><h2 className="display">Less theater.<br />More useful reps.</h2><p>InterviewIQ keeps the surface calm so the work can be demanding. Each session is structured around the habits that make good answers easier to repeat.</p></div>
        <div className="feature-grid">
          <article className="surface feature-card"><span className="feature-index mono">01 / adaptive</span><div className="feature-icon"><BrainCircuit size={20} /></div><h3>The interview moves with you.</h3><p>Questions respond to your choices, not a fixed script. Get a follow-up where your reasoning needs more range.</p></article>
          <article className="surface feature-card"><span className="feature-index mono">02 / signal</span><div className="feature-icon"><BarChart3 size={20} /></div><h3>See the shape of your skill.</h3><p>Separate fluency from luck with a breakdown across the dimensions hiring panels actually notice.</p></article>
          <article className="surface feature-card"><span className="feature-index mono">03 / momentum</span><div className="feature-icon"><Target size={20} /></div><h3>Know your next rep.</h3><p>Leave every session with one focused recommendation, not a report you never open again.</p></article>
        </div>
      </section>
      <section id="method" className="section adaptive"><div className="page-width adaptive-grid"><div><span className="eyebrow" style={{ color: 'hsl(41 93% 62%)' }}>The adaptive method</span><h2 className="display">A little friction, precisely placed.</h2><p>Real interviews do not reward memorized paths. InterviewIQ uses your answer as context, then chooses the next useful edge to test.</p></div><div className="steps"><div className="step"><span className="step-num">01</span><div><h3>Set the conditions</h3><p>Choose your target role, format, topics, and how much pressure you want today.</p></div></div><div className="step"><span className="step-num">02</span><div><h3>Think out loud</h3><p>Answer in your own words. The workspace stays quiet while your reasoning takes shape.</p></div></div><div className="step"><span className="step-num">03</span><div><h3>Get a sharper read</h3><p>See patterns across clarity, depth, tradeoffs, and communication—then pick your next move.</p></div></div></div></div></section>
      <section id="intelligence" className="section intelligence"><div className="page-width intelligence-layout"><div className="intel-card"><div className="intel-head"><span className="eyebrow">Candidate intelligence</span><span className="intel-score">7.8</span></div><div className="bar-row"><div className="bar-label"><span>Problem framing</span><span className="mono">82</span></div><div className="bar-track"><div className="bar-fill" style={{ width: '82%' }} /></div></div><div className="bar-row"><div className="bar-label"><span>Technical depth</span><span className="mono">74</span></div><div className="bar-track"><div className="bar-fill" style={{ width: '74%' }} /></div></div><div className="bar-row"><div className="bar-label"><span>Communication</span><span className="mono">68</span></div><div className="bar-track"><div className="bar-fill" style={{ width: '68%' }} /></div></div></div><div><span className="eyebrow">Candidate intelligence</span><h2 className="display" style={{ fontSize: 'clamp(38px, 4.5vw, 62px)', lineHeight: '.96', margin: '14px 0 20px' }}>Your edge is in the pattern.</h2><p style={{ color: 'hsl(40 28% 36%)', lineHeight: 1.7, maxWidth: 470 }}>A single score is a snapshot. A practice history shows whether you lead with clarity, where you rush, and which kinds of problems make you do your best thinking.</p></div></div></section>
      <section className="cta-band page-width"><span className="eyebrow">Your next session is waiting</span><h2 className="display">Get a little better at the part that matters.</h2><Link className="btn btn-primary" href="/signup" data-testid="button-cta-signup">Create your workspace <ArrowRight size={16} /></Link></section>
    </main>
    <footer className="footer"><div className="page-width" style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}><span>© 2025 InterviewIQ</span><span>Private by design. Honest by default.</span></div></footer>
  </div>;
}

function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const [, setLocation] = useLocation();
  const { showToast, toast } = useToast();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); setError(''); if (!email.includes('@') || password.length < 6 || (mode === 'signup' && name.trim().length < 2)) { setError(mode === 'login' ? 'Enter a valid email and a password of 6+ characters.' : 'Add your name, a valid email, and a password of 6+ characters.'); return; } const candidate = mode === 'login' ? { ...getStore<Candidate>('candidateProfile', demoCandidate), email } : { ...defaultCandidate, name: name.trim(), email }; setStore('currentUser', { email }); setStore('candidateProfile', candidate); showToast(mode === 'login' ? 'Welcome back.' : 'Workspace created.', 'Taking you to your setup.'); window.setTimeout(() => setLocation(mode === 'login' ? '/dashboard' : '/onboarding'), 350); };
  return <div className="auth-wrap"><section className="auth-panel"><Link href="/" data-testid="link-auth-home"><Brand light /></Link><div className="auth-quote"><span className="eyebrow" style={{ color: 'hsl(41 93% 62%)' }}>Interview practice, with a point of view</span><h1 className="display">Make your thinking easier to trust.</h1><p>One focused workspace for the reps between “I should practice” and “I am ready for this room.”</p></div><span className="mono" style={{ color: 'hsl(218 25% 56%)', fontSize: 10 }}>PRIVATE WORKSPACE / {mode === 'login' ? 'RETURNING CANDIDATE' : 'NEW CANDIDATE'}</span></section><section className="auth-form-side"><div className="auth-form"><span className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Start with a clear baseline'}</span><h2 className="display">{mode === 'login' ? 'Log in to InterviewIQ' : 'Create your workspace'}</h2><p>{mode === 'login' ? 'Your practice history is waiting.' : 'No performance claims. Just a better place to practice.'}</p><form className="form-stack" onSubmit={submit}>{mode === 'signup' && <div className="field"><label htmlFor="name">Full name</label><input id="name" data-testid="input-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maya Chen" /></div>}<div className="field"><label htmlFor="email">Email</label><input id="email" type="email" data-testid="input-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div><div className="field"><label htmlFor="password">Password</label><input id="password" type="password" data-testid="input-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6+ characters" /></div>{error && <small data-testid="status-auth-error">{error}</small>}<button className="btn btn-primary" type="submit" data-testid="button-auth-submit">{mode === 'login' ? 'Log in' : 'Create workspace'} <ArrowRight size={15} /></button></form><div className="form-foot"><span>{mode === 'login' ? 'New to InterviewIQ?' : 'Already have a workspace?'}</span><Link className="form-link" href={mode === 'login' ? '/signup' : '/login'} data-testid="link-auth-switch">{mode === 'login' ? 'Create an account' : 'Log in'}</Link></div><Toast toast={toast} /></div></section></div>;
}

function MobileNav({ open, close }: { open: boolean; close: () => void }) {
  const [, setLocation] = useLocation();
  if (!open) return null;
  const go = (path: string) => { close(); setLocation(path); };
  return <div style={{ position: 'fixed', inset: '0 0 0 0', zIndex: 10, background: 'hsl(222 38% 15% / .98)', padding: '24px', color: 'white' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><Brand light /><button className="side-action" onClick={close} data-testid="button-close-menu"><X /></button></div><nav className="side-nav" style={{ marginTop: 35 }}>{[['/dashboard', 'Overview', LayoutDashboard], ['/interview/setup', 'New interview', Plus], ['/history', 'History', History], ['/profile', 'Profile', UserRound], ['/settings', 'Settings', SettingsIcon]].map(([path, label, Icon]) => <button className="side-action" key={path as string} onClick={() => go(path as string)} data-testid={`mobile-nav-${label}`}><Icon size={17} />{label as string}</button>)}</nav></div>;
}

function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const [location, setLocation] = useLocation(); const [mobileOpen, setMobileOpen] = useState(false);
  const candidate = getStore<Candidate>('candidateProfile', demoCandidate); const user = getStore<{ email: string } | null>('currentUser', null);
  const nav = [['/dashboard', 'Overview', LayoutDashboard], ['/interview/setup', 'New interview', Plus], ['/history', 'History', History], ['/profile', 'Profile', UserRound], ['/settings', 'Settings', SettingsIcon]] as const;
  const logout = () => { localStorage.removeItem('currentUser'); setLocation('/'); };
  return <div className="app-layout"><aside className="sidebar"><Link href="/dashboard" data-testid="link-sidebar-brand"><Brand light /></Link><span className="side-label">Workspace</span><nav className="side-nav">{nav.map(([path, label, Icon]) => <Link className={location === path ? 'active' : ''} href={path} key={path} data-testid={`link-nav-${label}`}><Icon size={17} />{label}</Link>)}</nav><div className="sidebar-bottom"><button className="side-action" onClick={logout} data-testid="button-logout"><LogOut size={17} />Log out</button><div className="profile-mini"><span className="avatar">{initials(candidate.name)}</span><span><strong data-testid="text-sidebar-name">{candidate.name || 'Your profile'}</strong><span>{user?.email || 'Complete your profile'}</span></span></div></div></aside><main className="main-content"><header className="topbar"><button className="side-action mobile-only" style={{ color: 'hsl(var(--foreground))' }} onClick={() => setMobileOpen(true)} data-testid="button-open-menu"><Menu size={19} /></button><h1>{title}</h1><div className="top-actions"><Link className="btn btn-primary btn-sm" href="/interview/setup" data-testid="button-top-new-interview"><Plus size={14} /> New interview</Link><span className="avatar">{initials(candidate.name)}</span></div></header>{children}</main><MobileNav open={mobileOpen} close={() => setMobileOpen(false)} /></div>;
}

function Dashboard() {
  const candidate = getStore<Candidate>('candidateProfile', demoCandidate); const history = getStore<InterviewSession[]>('interviewHistory', []);
  const avg = history.length ? Math.round(history.reduce((sum, item) => sum + item.score, 0) / history.length) : 0; const readiness = history.length ? Math.min(94, 54 + Math.round(avg * .35)) : 0;
  return <AppShell title="Overview"><div className="content"><div className="page-intro"><div><span className="eyebrow">Tuesday, your workspace</span><h2 className="display">Keep the edge, {candidate.name.split(' ')[0] || 'candidate'}.</h2><p>A focused read on where your interview practice stands.</p></div><Link className="btn btn-primary" href="/interview/setup" data-testid="button-dashboard-start"><Play size={15} /> Start an interview</Link></div>{!history.length && <div className="surface" style={{ marginBottom: 16 }}><div className="empty"><Sparkles size={27} /><h3>Your first useful signal starts here.</h3><p>Complete one adaptive interview to turn this quiet dashboard into a practice map. Your scores stay local to this demo workspace.</p><Link className="btn btn-primary btn-sm" href="/interview/setup" data-testid="link-empty-start">Choose your interview <ArrowRight size={14} /></Link></div></div>}<div className="dashboard-grid"><section className="readiness-card"><span className="eyebrow" style={{ color: 'hsl(41 93% 62%)' }}>Readiness snapshot</span><h3>{history.length ? 'You are building momentum.' : 'Start with a baseline.'}</h3><p>{history.length ? `Based on ${history.length} local session${history.length > 1 ? 's' : ''}, your practice is beginning to show a pattern.` : 'InterviewIQ needs a real rep before it pretends to know you. Take one when you have 20 quiet minutes.'}</p><div className="readiness-score" data-testid="text-readiness-score">{readiness}<span>/ 100</span></div><span className="mono" style={{ fontSize: 10, color: 'hsl(218 32% 70%)' }}>{history.length ? 'LOCAL PRACTICE SIGNAL' : 'NOT ENOUGH DATA YET'}</span></section><section className="surface card-pad"><div className="card-title"><h3>Skill intelligence</h3><Link className="link" href="/profile" data-testid="link-dashboard-profile">Edit profile <ChevronRight size={13} style={{ verticalAlign: 'middle' }} /></Link></div><div className="skill-list">{[['Problem framing', history.length ? Math.min(92, 61 + avg) : 0], ['Technical depth', history.length ? Math.min(88, 52 + avg) : 0], ['Communication', history.length ? Math.min(90, 56 + avg) : 0]].map(([label, value]) => <div className="skill-line" key={label as string}><div><div className="bar-label"><span>{label as string}</span></div><div className="bar-track"><div className="bar-fill" style={{ width: `${value}%` }} /></div></div><b>{value ? value : '—'}</b></div>)}</div></section></div><div className="dash-lower"><section className="surface card-pad recommend"><span className="eyebrow">Recommended next</span><h3 className="display">{history.length ? 'Pressure-test your tradeoffs.' : 'Run your first system design rep.'}</h3><p>{history.length ? 'Your last answer moved quickly to implementation. Try a system design session and spend one extra minute framing constraints.' : 'A 20-minute adaptive session will give your dashboard something honest to work with.'}</p><Link className="btn btn-primary btn-sm" href="/interview/setup" data-testid="link-recommended-interview">Set up session <ArrowRight size={14} /></Link></section><section className="surface card-pad insight"><div className="card-title"><h3><Lightbulb size={16} style={{ verticalAlign: 'middle', marginRight: 7 }} />AI insight</h3><span className="mono muted" style={{ fontSize: 10 }}>DEMO MODE</span></div><div className="insight-quote"><p>{history.length ? '“Your most useful move is making assumptions visible before you choose a solution.”' : '“The first session is not a verdict. It is a baseline you can finally work against.”'}</p></div><span className="muted" style={{ fontSize: 11 }}>Generated from local session data. No hidden reasoning is shown.</span></section></div><section className="surface card-pad" style={{ marginTop: 16 }}><div className="card-title"><h3>Recent interviews</h3><Link className="link" href="/history" data-testid="link-dashboard-history">View history <ChevronRight size={13} style={{ verticalAlign: 'middle' }} /></Link></div>{history.length ? <div className="history-list">{history.slice(0, 3).map((item) => <Link href={`/interview/result?id=${item.id}`} className="history-row" key={item.id} data-testid={`row-recent-${item.id}`}><div><h4>{item.config.role} · {item.config.type}</h4><p>{new Date(item.date).toLocaleDateString()} · {item.config.duration} minutes</p></div><span className="score-pill">{item.score}/100 <ChevronRight size={13} style={{ verticalAlign: 'middle' }} /></span></Link>)}</div> : <div className="empty" style={{ padding: '25px 10px' }}><History size={22} /><p>No interviews yet. Your completed sessions will appear here.</p></div>}</section></div></AppShell>;
}

function Onboarding() {
  const [, setLocation] = useLocation(); const { showToast, toast } = useToast(); const [step, setStep] = useState(1); const [profile, setProfile] = useState<Candidate>(() => getStore('candidateProfile', defaultCandidate)); const [fileNote, setFileNote] = useState('');
  const update = (key: keyof Candidate, value: string) => setProfile((prev) => ({ ...prev, [key]: value }));
  const save = () => { setStore('candidateProfile', profile); showToast('Profile saved.', 'Your workspace is ready.'); window.setTimeout(() => setLocation('/dashboard'), 250); };
  return <div className="auth-wrap" style={{ gridTemplateColumns: '1fr' }}><div style={{ maxWidth: 760, width: 'calc(100% - 40px)', margin: '0 auto', padding: '42px 0 70px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Link href="/" data-testid="link-onboarding-home"><Brand /></Link><span className="mono muted" style={{ fontSize: 10 }}>SETUP / {step} OF 3</span></div><div style={{ display: 'flex', gap: 7, margin: '55px 0 30px' }}>{[1, 2, 3].map((number) => <div key={number} style={{ height: 4, flex: 1, background: number <= step ? 'hsl(var(--primary))' : 'hsl(var(--border))', borderRadius: 4 }} />)}</div>{step === 1 && <section><span className="eyebrow">01 / candidate profile</span><h1 className="display" style={{ fontSize: 46, lineHeight: 1, margin: '12px 0' }}>Give the interviewer<br />a useful starting point.</h1><p className="muted" style={{ lineHeight: 1.7, maxWidth: 520 }}>This context helps InterviewIQ pick relevant prompts. You can change it anytime.</p><div className="surface shadow-soft" style={{ padding: 25, marginTop: 30 }}><div className="form-two"><div className="field"><label htmlFor="onboard-name">Full name</label><input id="onboard-name" data-testid="input-onboarding-name" value={profile.name} onChange={(e) => update('name', e.target.value)} placeholder="Maya Chen" /></div><div className="field"><label htmlFor="onboard-role">Target role</label><input id="onboard-role" data-testid="input-onboarding-role" value={profile.role} onChange={(e) => update('role', e.target.value)} placeholder="Senior Software Engineer" /></div><div className="field"><label htmlFor="onboard-experience">Experience</label><select id="onboard-experience" data-testid="select-onboarding-experience" value={profile.experience} onChange={(e) => update('experience', e.target.value)}><option>0–2 years</option><option>3–4 years</option><option>5–7 years</option><option>8+ years</option></select></div><div className="field"><label htmlFor="onboard-email">Email</label><input id="onboard-email" data-testid="input-onboarding-email" value={profile.email} onChange={(e) => update('email', e.target.value)} placeholder="you@example.com" /></div></div><div className="field" style={{ marginTop: 15 }}><label htmlFor="onboard-bio">A little about your work</label><textarea id="onboard-bio" data-testid="input-onboarding-bio" value={profile.bio} onChange={(e) => update('bio', e.target.value)} placeholder="What kinds of systems do you like building?" /></div></div><button className="btn btn-primary" style={{ marginTop: 22 }} onClick={() => setStep(2)} data-testid="button-onboarding-next">Continue <ArrowRight size={15} /></button></section>}{step === 2 && <section><span className="eyebrow">02 / resume context</span><h1 className="display" style={{ fontSize: 46, lineHeight: 1, margin: '12px 0' }}>Add the context<br />you want to practice from.</h1><p className="muted" style={{ lineHeight: 1.7, maxWidth: 520 }}>Resume parsing is not connected in this demo. We will be clear about what we can and cannot detect.</p><div className="surface shadow-soft" style={{ padding: 30, marginTop: 30, textAlign: 'center', borderStyle: 'dashed' }}><Paperclip size={25} color="hsl(var(--primary))" /><h3 className="display" style={{ fontSize: 22, margin: '14px 0 7px' }}>Upload your resume</h3><p className="muted" style={{ fontSize: 13 }}>PDF or DOCX · up to 5 MB</p><input type="file" accept=".pdf,.doc,.docx" style={{ maxWidth: '100%', marginTop: 15 }} data-testid="input-resume" onChange={(e) => setFileNote(e.target.files?.[0]?.name || '')} />{fileNote && <p style={{ color: 'hsl(var(--primary))', fontSize: 12, marginTop: 13 }}>{fileNote} selected</p>}</div><div className="surface" style={{ padding: 20, marginTop: 14, background: 'hsl(var(--muted) / .45)' }}><div className="card-title" style={{ marginBottom: 12 }}><h3 style={{ fontSize: 14 }}>Detected context</h3><span className="mono muted" style={{ fontSize: 10 }}>PARSING UNAVAILABLE</span></div><div className="tag-list"><span>Role: {profile.role || 'Not detected'}</span><span>Years: {profile.experience || 'Not detected'}</span><span>Companies: Not detected</span><span>Projects: Not detected</span></div></div><div style={{ display: 'flex', gap: 10, marginTop: 22 }}><button className="btn btn-ghost" onClick={() => setStep(1)} data-testid="button-onboarding-back">Back</button><button className="btn btn-primary" onClick={() => { if (fileNote) setProfile((prev) => ({ ...prev, resumeName: fileNote })); setStep(3); }} data-testid="button-onboarding-analyze">Continue <ArrowRight size={15} /></button></div></section>}{step === 3 && <section><span className="eyebrow">03 / ready to practice</span><h1 className="display" style={{ fontSize: 46, lineHeight: 1, margin: '12px 0' }}>Your private workspace<br />is ready when you are.</h1><div className="surface shadow-soft" style={{ padding: 25, marginTop: 30 }}><div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 20, borderBottom: '1px solid hsl(var(--border))' }}><span className="avatar" style={{ width: 50, height: 50 }}>{initials(profile.name)}</span><div><h3 style={{ margin: 0, fontSize: 18 }}>{profile.name || 'Your name'}</h3><p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>{profile.role || 'Target role not set'} · {profile.experience}</p></div></div><div className="tag-list" style={{ marginTop: 20 }}>{profile.skills.map((skill) => <span key={skill}><Check size={12} style={{ verticalAlign: 'middle', marginRight: 5, color: 'hsl(var(--primary))' }} />{skill}</span>)}</div><div style={{ background: 'hsl(var(--secondary) / .25)', padding: 15, borderRadius: 9, marginTop: 20, fontSize: 12, lineHeight: 1.6 }}>Resume analysis: <strong>Not detected</strong>. You can still start a full interview and add context later.</div></div><div style={{ display: 'flex', gap: 10, marginTop: 22 }}><button className="btn btn-ghost" onClick={() => setStep(2)} data-testid="button-onboarding-back-final">Back</button><button className="btn btn-primary" onClick={save} data-testid="button-finish-onboarding">Enter workspace <ArrowRight size={15} /></button></div></section>}<Toast toast={toast} /></div></div>;
}

function InterviewSetup() {
  const [, setLocation] = useLocation(); const { showToast, toast } = useToast(); const [config, setConfig] = useState<InterviewConfig>({ role: 'Senior Software Engineer', type: 'System design', difficulty: 'Adaptive', duration: '20', topics: ['Architecture'] });
  const update = (key: keyof InterviewConfig, value: string) => setConfig((prev) => ({ ...prev, [key]: value }));
  const topics = ['Architecture', 'APIs', 'Data modeling', 'Tradeoffs', 'Debugging', 'Communication'];
  const start = () => { if (!config.topics.length) { showToast('Choose a topic.', 'One topic gives the session somewhere to go.'); return; } const sessionId = `session-${Date.now()}`; setStore('activeInterview', { id: sessionId, config, startedAt: new Date().toISOString() }); setLocation('/interview'); };
  return <AppShell title="New interview"><div className="content"><div className="page-intro"><div><span className="eyebrow">Session design</span><h2 className="display">Set the conditions.</h2><p>Choose the kind of pressure you want to practice today.</p></div></div><div className="setup-grid"><section className="surface setup-form"><h3>Interview setup</h3><div className="form-stack" style={{ marginTop: 0 }}><div className="field"><label htmlFor="target-role">Target role</label><input id="target-role" data-testid="input-target-role" value={config.role} onChange={(e) => update('role', e.target.value)} /></div><div className="field"><label>Interview type</label><div className="choice-grid">{[['System design', 'Architecture, scale, tradeoffs'], ['Coding', 'Problem solving, clarity, correctness'], ['Behavioral', 'Decisions, collaboration, ownership'], ['Mixed loop', 'A little of the whole room']].map(([label, hint]) => <button type="button" className={`choice ${config.type === label ? 'selected' : ''}`} onClick={() => update('type', label)} key={label} data-testid={`choice-type-${label}`}><strong>{label}</strong><span>{hint}</span></button>)}</div></div><div className="field"><label>Difficulty</label><div className="choice-grid">{[['Adaptive', 'Moves with your signal'], ['Warm-up', 'Build confidence first'], ['Stretch', 'More follow-ups, less room']].map(([label, hint]) => <button type="button" className={`choice ${config.difficulty === label ? 'selected' : ''}`} onClick={() => update('difficulty', label)} key={label} data-testid={`choice-difficulty-${label}`}><strong>{label}</strong><span>{hint}</span></button>)}</div></div><div className="field"><label>Duration</label><div className="choice-grid">{['15', '20', '30', '45'].map((duration) => <button type="button" className={`choice ${config.duration === duration ? 'selected' : ''}`} onClick={() => update('duration', duration)} key={duration} data-testid={`choice-duration-${duration}`}><strong>{duration} minutes</strong><span>{duration === '20' ? 'Recommended' : 'Focused rep'}</span></button>)}</div></div><div className="field"><label>Topics to include</label><div className="topic-grid">{topics.map((topic) => <button type="button" className={`topic ${config.topics.includes(topic) ? 'selected' : ''}`} onClick={() => setConfig((prev) => ({ ...prev, topics: prev.topics.includes(topic) ? prev.topics.filter((item) => item !== topic) : [...prev.topics, topic] }))} key={topic} data-testid={`toggle-topic-${topic}`}>{config.topics.includes(topic) && <Check size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />}{topic}</button>)}</div></div><button className="btn btn-primary" onClick={start} data-testid="button-start-interview">Start adaptive interview <ArrowRight size={15} /></button></div></section><aside className="setup-note"><span className="eyebrow" style={{ color: 'hsl(41 93% 62%)' }}>What to expect</span><h3 className="display">A quiet room for loud thinking.</h3><p>There are no trick timers here. The interviewer will ask one question at a time, follow the useful threads, and leave you with a readable report.</p><div className="check-list"><div><ShieldCheck size={16} /> Your answers stay in this workspace.</div><div><BrainCircuit size={16} /> Follow-ups adapt to your answer.</div><div><BarChart3 size={16} /> Every result shows the next rep.</div></div></aside></div><Toast toast={toast} /></div></AppShell>;
}

async function postInterview(payload: InterviewInput): Promise<InterviewResponse> {
  return interviewTurn(payload);
}

type InterviewMessage = {
  role: 'ai' | 'user';
  text: string;
  evaluation?: InterviewEvaluation;
  reason?: string;
};

type ActiveInterviewSnapshot = {
  id: string;
  config: InterviewConfig;
  startedAt: string;
  messages?: InterviewMessage[];
  evaluation?: InterviewEvaluation;
  feedback?: InterviewFeedback;
  progress?: number;
  questionsAnswered?: number;
  totalQuestions?: number;
  questionNumber?: number;
  topic?: string;
  difficulty?: string;
  done?: boolean;
};

function EvaluationCard({ evaluation, reason }: { evaluation: InterviewEvaluation; reason?: string }) {
  return <section className="evaluation-card" data-testid="card-answer-evaluation">
    <div className="evaluation-head">
      <div><span className="eyebrow" style={{ color: 'hsl(41 93% 62%)' }}>Answer signal</span><h3>{evaluation.topic} · evaluated</h3></div>
      <div className="evaluation-score"><strong>{Math.round(evaluation.score)}</strong><span>/ 10</span></div>
    </div>
    <div className="evaluation-grid">
      <div><span>Technical</span><b>{Math.round(evaluation.technicalCorrectness)}/10</b></div>
      <div><span>Depth</span><b>{Math.round(evaluation.depth)}/10</b></div>
      <div><span>Clarity</span><b>{Math.round(evaluation.clarity)}/10</b></div>
      <div><span>Applied</span><b>{Math.round(evaluation.practicalUnderstanding)}/10</b></div>
    </div>
    <div className="evaluation-columns">
      <div><span className="evaluation-label">What held</span><ul>{evaluation.strengths.slice(0, 2).map((item) => <li key={item}>{item}</li>)}</ul></div>
      <div><span className="evaluation-label">One improvement</span><ul>{evaluation.weaknesses.slice(0, 1).map((item) => <li key={item}>{item}</li>)}</ul></div>
    </div>
    {evaluation.misconceptions?.length > 0 && <p className="evaluation-note"><strong>Technical note:</strong> {evaluation.misconceptions[0]}</p>}
    <p className="evaluation-reason"><Lightbulb size={14} />{reason || evaluation.reason}</p>
  </section>;
}

function Interview() {
  const [, setLocation] = useLocation();
  const active = getStore<ActiveInterviewSnapshot | null>('activeInterview', null);
  const candidate = getStore<Candidate>('candidateProfile', demoCandidate);
  const { toast } = useToast();
  const [messages, setMessages] = useState<InterviewMessage[]>(active?.messages || []);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(messages.length === 0);
  const [error, setError] = useState('');
  const [evaluation, setEvaluation] = useState<InterviewEvaluation | undefined>(active?.evaluation);
  const [feedback, setFeedback] = useState<InterviewFeedback | undefined>(active?.feedback);
  const [progress, setProgress] = useState(active?.progress ?? 0);
  const [questionsAnswered, setQuestionsAnswered] = useState(active?.questionsAnswered ?? 0);
  const [totalQuestions, setTotalQuestions] = useState(active?.totalQuestions ?? 8);
  const [questionNumber, setQuestionNumber] = useState(active?.questionNumber ?? 1);
  const [topic, setTopic] = useState(active?.topic || 'RAG');
  const [difficulty, setDifficulty] = useState(active?.difficulty || 'Foundational');
  const [done, setDone] = useState(active?.done ?? false);
  const [reason, setReason] = useState('');
  const config = active?.config || { role: candidate.role, type: 'System design', difficulty: 'Adaptive', duration: '20', topics: ['Architecture'] };
  const sessionId = active?.id || `session-${Date.now()}`;

  const persist = (patch: Partial<ActiveInterviewSnapshot>) => {
    const current = getStore<ActiveInterviewSnapshot | null>('activeInterview', active);
    if (current) setStore('activeInterview', { ...current, ...patch });
  };

  useEffect(() => {
    if (messages.length > 0 || !active) return;
    let mounted = true;
    const boot = async () => {
      try {
        const data = await postInterview({
          sessionId,
          candidate: { ...candidate, interviewConfig: config },
        });
        if (!mounted) return;
        setMessages([{ role: 'ai', text: data.reply }]);
        setProgress(data.progress ?? 0);
        setQuestionsAnswered(data.questionsAnswered ?? 0);
        setTotalQuestions(data.totalQuestions ?? 8);
        setQuestionNumber(data.questionNumber ?? 1);
        setTopic(data.topic ?? 'RAG');
        setDifficulty(data.difficulty ?? 'Foundational');
        persist({ messages: [{ role: 'ai', text: data.reply }], progress: data.progress, questionsAnswered: data.questionsAnswered, totalQuestions: data.totalQuestions, questionNumber: data.questionNumber, topic: data.topic, difficulty: data.difficulty });
      } catch {
        if (mounted) setError('The interview service is unavailable. Restart the session to try again.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void boot();
    return () => { mounted = false; };
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!answer.trim() || loading || done) return;
    const current = answer.trim();
    const nextMessages = [...messages, { role: 'user' as const, text: current }];
    setAnswer('');
    setMessages(nextMessages);
    setLoading(true);
    setError('');
    setEvaluation(undefined);
    try {
      const data = await postInterview({ sessionId, message: current });
      const nextEvaluation = data.evaluation;
      const responseMessage: InterviewMessage = { role: 'ai', text: data.reply, reason: data.nextQuestionReason };
      const completedMessages = [...nextMessages, responseMessage];
      setMessages(completedMessages);
      setEvaluation(nextEvaluation);
      setFeedback(data.feedback);
      setProgress(data.progress ?? progress);
      setQuestionsAnswered(data.questionsAnswered ?? questionsAnswered + 1);
      setTotalQuestions(data.totalQuestions ?? totalQuestions);
      setQuestionNumber(data.questionNumber ?? questionNumber + 1);
      setTopic(data.topic ?? topic);
      setDifficulty(data.difficulty ?? difficulty);
      setReason(data.nextQuestionReason || '');
      setDone(data.done);
      persist({ messages: completedMessages, evaluation: nextEvaluation, feedback: data.feedback, progress: data.progress, questionsAnswered: data.questionsAnswered, totalQuestions: data.totalQuestions, questionNumber: data.questionNumber, topic: data.topic, difficulty: data.difficulty, done: data.done });
    } catch {
      setError('We could not evaluate that answer. Your draft is still in this session—please try submitting again.');
      setMessages(messages);
      setAnswer(current);
    } finally {
      setLoading(false);
    }
  };

  const finish = () => {
    if (!done || !feedback) return;
    const session: InterviewSession = {
      id: sessionId,
      date: new Date().toISOString(),
      config,
      score: feedback.overallScore,
      status: 'completed',
      strengths: feedback.strengths,
      gaps: feedback.gaps,
      feedback,
      scoreHistory: feedback.scoreHistory,
      topicsCovered: Object.keys(feedback.topicPerformance),
    };
    const history = getStore<InterviewSession[]>('interviewHistory', []);
    setStore('interviewHistory', [session, ...history.filter((item) => item.id !== session.id)]);
    setStore('activeInterview', null);
    setLocation(`/interview/result?id=${session.id}`);
  };

  return <div className="interview-wrap"><header className="interview-top"><Link href="/dashboard" data-testid="link-interview-brand"><Brand light /></Link><div className="interview-status"><span className="live-dot" /><span>ADAPTIVE · {config.duration} MINUTES</span><span className="mono">QUESTION / {questionNumber.toString().padStart(2, '0')}</span></div><button className="btn btn-ghost btn-sm" style={{ color: 'white', borderColor: 'hsl(222 30% 34%)' }} onClick={finish} disabled={!done} data-testid="button-finish-interview">{done ? 'View report' : `Complete ${totalQuestions} questions`}</button></header><div className="interview-grid"><aside className="candidate-context"><span className="eyebrow" style={{ color: 'hsl(41 93% 62%)' }}>Candidate context</span><h3>{candidate.name || 'Your session'}</h3><p>{candidate.role} · {candidate.experience}</p><div className="context-block"><h4>Current topic</h4><div className="context-tags"><span className="context-tag">{topic}</span><span className="context-tag">{difficulty}</span></div></div><div className="context-block"><h4>Interview intelligence</h4><p style={{ marginTop: 11 }}>Each response is scored for correctness, depth, clarity, and applied understanding before the next prompt is chosen.</p></div>{evaluation && <div className="context-block"><h4>Running score</h4><p className="running-score">{questionsAnswered ? Math.round((evaluation.score / 10) * 100) : 0}<small>/ 100 latest</small></p></div>}</aside><main className="interview-main"><div className="progress-line"><span>Interview in progress</span><span>{questionsAnswered} / {totalQuestions} answered · {progress}%</span></div><div className="progress-track"><div style={{ width: `${progress}%` }} /></div><div className="conversation">{messages.map((message, index) => <div className={`bubble ${message.role}`} key={`${message.role}-${index}`} data-testid={`bubble-${message.role}-${index}`}><span className="bubble-label">{message.role === 'ai' ? 'Interviewer' : 'You'}</span>{message.text}{message.evaluation && <EvaluationCard evaluation={message.evaluation} reason={message.reason} />}</div>)}{evaluation && !done && <EvaluationCard evaluation={evaluation} reason={reason} />}{loading && <div className="bubble ai"><span className="bubble-label">{questionsAnswered ? 'Evaluating response…' : 'Interviewer'}</span><span className="typing"><i /><i /><i /></span></div>}</div>{error && <div className="error-note" data-testid="status-interview-error"><span>{error}</span><button className="btn btn-sm btn-danger" onClick={() => setError('')} data-testid="button-dismiss-error">Dismiss</button></div>}{!done ? <div className="answer-box"><textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Talk through your thinking. The interviewer is listening for how you get there." data-testid="input-interview-answer" /><div className="answer-actions"><span><CircleHelp size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Be specific about assumptions and tradeoffs.</span><button className="btn btn-primary btn-sm" onClick={submit} disabled={!answer.trim() || loading} data-testid="button-submit-answer">{loading && questionsAnswered ? 'Evaluating…' : 'Submit answer'} <Send size={13} /></button></div></div> : <div className="completion-panel"><CheckCircle2 size={20} /><div><strong>Interview complete.</strong><span>All {totalQuestions} answer signals are ready for your report.</span></div><button className="btn btn-primary btn-sm" onClick={finish} data-testid="button-view-report">View report <ArrowRight size={13} /></button></div>}<span className="mono" style={{ display: 'block', textAlign: 'center', marginTop: 14, color: 'hsl(218 25% 52%)', fontSize: 10 }}>No hidden reasoning is displayed. Only concise evaluation signals are shown.</span></main></div><Toast toast={toast} /></div>;
}

function LegacyResult() {
  const [, setLocation] = useLocation(); const query = new URLSearchParams(window.location.search); const history = getStore<InterviewSession[]>('interviewHistory', []); const session = history.find((item) => item.id === query.get('id')) || history[0];
  if (!session) return <AppShell title="Interview result"><div className="content"><div className="surface empty"><BarChart3 size={28} /><h3>No result yet.</h3><p>Finish an interview to see a report built from your local practice data.</p><Link className="btn btn-primary" href="/interview/setup" data-testid="link-result-empty-setup">Start an interview <ArrowRight size={14} /></Link></div></div></AppShell>;
  const metrics = [['Problem framing', Math.min(92, session.score + 7)], ['Technical depth', Math.max(55, session.score - 3)], ['Communication', Math.min(90, session.score + 2)], ['Tradeoff fluency', Math.max(54, session.score - 8)]];
  return <AppShell title="Interview result"><div className="content"><div className="page-intro"><div><span className="eyebrow">Report / {new Date(session.date).toLocaleDateString()}</span><h2 className="display">A useful read, not a verdict.</h2><p>{session.config.role} · {session.config.type} · {session.config.duration} minutes</p></div><div className="result-actions"><Link className="btn btn-ghost btn-sm" href="/history" data-testid="button-result-history"><History size={14} /> History</Link><button className="btn btn-primary btn-sm" onClick={() => setLocation('/interview/setup')} data-testid="button-result-again"><RotateCcw size={14} /> Practice again</button></div></div><section className="result-hero"><div><span className="eyebrow" style={{ color: 'hsl(41 93% 62%)' }}>Adaptive observation</span><h2>Strong frame. Make the tradeoff visible sooner.</h2><p>You established a clear direction and kept the answer moving. The next improvement is to name your constraints before the solution gets detailed.</p></div><div className="result-score" data-testid="text-result-score"><div><strong>{session.score}</strong><span>/ 100</span></div></div></section><div className="result-columns"><section className="surface card-pad"><div className="card-title"><h3>Signal breakdown</h3><span className="mono muted" style={{ fontSize: 10 }}>LOCAL DATA</span></div><div className="breakdown">{metrics.map(([label, value]) => <div className="breakdown-row" key={label as string}><span>{label as string}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${value}%` }} /></div><b>{value}</b></div>)}</div></section><section className="surface card-pad summary-box"><div className="card-title"><h3><Sparkles size={16} style={{ verticalAlign: 'middle', marginRight: 7 }} />Session summary</h3></div><p>You communicated a credible approach and showed good instinct for sequencing. When the prompt got more specific, your answer would benefit from pausing to state the decision criteria in plain language.</p><div className="card-title" style={{ marginTop: 22, marginBottom: 10 }}><h3>Observed strengths</h3></div><div className="tag-list">{session.strengths.map((item) => <span key={item}><CheckCircle2 size={12} style={{ color: 'hsl(var(--primary))', verticalAlign: 'middle', marginRight: 5 }} />{item}</span>)}</div></section></div><div className="result-columns"><section className="surface card-pad"><div className="card-title"><h3>Keep doing</h3><span className="eyebrow">Strengths</span></div><div className="history-list">{session.strengths.map((strength) => <div className="history-row" key={strength}><div><h4>{strength}</h4><p>This showed up as a repeatable behavior in the session.</p></div><CheckCircle2 size={17} color="hsl(var(--primary))" /></div>)}</div></section><section className="surface card-pad"><div className="card-title"><h3>Next rep</h3><span className="eyebrow accent-text">Gaps</span></div><div className="history-list">{session.gaps.map((gap) => <div className="history-row" key={gap}><div><h4>{gap}</h4><p>Try making this explicit in your next answer.</p></div><Target size={17} color="hsl(var(--accent))" /></div>)}</div></section></div></div></AppShell>;
}

function Result() {
  const [, setLocation] = useLocation();
  const query = new URLSearchParams(window.location.search);
  const history = getStore<InterviewSession[]>('interviewHistory', []);
  const session = history.find((item) => item.id === query.get('id')) || history[0];
  if (!session) return <AppShell title="Interview result"><div className="content"><div className="surface empty"><BarChart3 size={28} /><h3>No result yet.</h3><p>Finish an interview to see a report built from your local practice data.</p><Link className="btn btn-primary" href="/interview/setup" data-testid="link-result-empty-setup">Start an interview <ArrowRight size={14} /></Link></div></div></AppShell>;
  const feedback = session.feedback;
  const metrics = feedback
    ? [['Technical knowledge', feedback.technicalScore], ['Communication', feedback.communicationScore], ['Problem solving', feedback.problemSolvingScore], ['Overall signal', feedback.overallScore]]
    : [['Technical knowledge', session.score], ['Communication', session.score], ['Problem solving', session.score], ['Overall signal', session.score]];
  const topicPerformance = feedback?.topicPerformance || {};
  const scoreHistory = feedback?.scoreHistory || session.scoreHistory || [];
  const misconceptions = feedback?.misconceptions || [];
  const nextSteps = feedback?.next || session.gaps;
  return <AppShell title="Interview result"><div className="content"><div className="page-intro"><div><span className="eyebrow">Report / {new Date(session.date).toLocaleDateString()}</span><h2 className="display">A useful read, not a verdict.</h2><p>{session.config.role} · {session.config.type} · {session.config.duration} minutes · {feedback?.difficultyReached || 'Adaptive'}</p></div><div className="result-actions"><Link className="btn btn-ghost btn-sm" href="/history" data-testid="button-result-history"><History size={14} /> History</Link><button className="btn btn-primary btn-sm" onClick={() => setLocation('/interview/setup')} data-testid="button-result-again"><RotateCcw size={14} /> Practice again</button></div></div><section className="result-hero"><div><span className="eyebrow" style={{ color: 'hsl(41 93% 62%)' }}>Hiring-style assessment</span><h2>{feedback?.hiringAssessment || 'Complete an adaptive session to generate a structured assessment.'}</h2><p>{feedback?.summary || 'This session predates answer-level evaluation. Run a new interview to unlock the full report.'}</p></div><div className="result-score" data-testid="text-result-score"><div><strong>{feedback?.overallScore ?? session.score}</strong><span>/ 100</span></div></div></section><div className="result-columns"><section className="surface card-pad"><div className="card-title"><h3>Signal breakdown</h3><span className="mono muted" style={{ fontSize: 10 }}>ANSWER-LEVEL DATA</span></div><div className="breakdown">{metrics.map(([label, value]) => <div className="breakdown-row" key={label as string}><span>{label as string}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${value}%` }} /></div><b>{value}</b></div>)}</div></section><section className="surface card-pad summary-box"><div className="card-title"><h3><Sparkles size={16} style={{ verticalAlign: 'middle', marginRight: 7 }} />Observed strengths</h3><span className="mono muted" style={{ fontSize: 10 }}>{feedback?.difficultyReached || 'LOCAL DATA'}</span></div><p>{feedback?.summary || 'No generated summary is available for this session yet.'}</p><div className="tag-list">{session.strengths.map((item) => <span key={item}><CheckCircle2 size={12} style={{ color: 'hsl(var(--primary))', verticalAlign: 'middle', marginRight: 5 }} />{item}</span>)}</div></section></div><div className="result-columns"><section className="surface card-pad"><div className="card-title"><h3>Topic performance</h3><span className="eyebrow">Curriculum coverage</span></div>{Object.keys(topicPerformance).length ? <div className="breakdown">{Object.entries(topicPerformance).map(([label, value]) => <div className="breakdown-row" key={label}><span>{label}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${value}%` }} /></div><b>{value}</b></div>)}</div> : <p className="muted" style={{ fontSize: 13 }}>Run an adaptive session to see performance across the technical curriculum.</p>}</section><section className="surface card-pad"><div className="card-title"><h3>Personalized recommendations</h3><span className="eyebrow accent-text">Next rep</span></div><div className="history-list">{nextSteps.map((item) => <div className="history-row" key={item}><div><h4>{item}</h4><p>Use a concrete production example in your next timed answer.</p></div><Target size={17} color="hsl(var(--accent))" /></div>)}</div></section></div><div className="result-columns"><section className="surface card-pad"><div className="card-title"><h3>Knowledge gaps & misconceptions</h3><span className="mono muted" style={{ fontSize: 10 }}>CONCISE SIGNALS</span></div>{misconceptions.length ? <div className="history-list">{misconceptions.map((item) => <div className="history-row" key={item}><div><h4>{item}</h4><p>Revisit this before increasing interview difficulty.</p></div></div>)}</div> : <div className="empty" style={{ padding: '25px 10px' }}><CheckCircle2 size={22} /><p>No flagged misconceptions in this session.</p></div>}</section><section className="surface card-pad"><div className="card-title"><h3>Question-by-question</h3><span className="mono muted" style={{ fontSize: 10 }}>{scoreHistory.length} SCORES</span></div>{scoreHistory.length ? <div className="history-list">{scoreHistory.map((item, index) => <div className="history-row" key={`${String(item.question)}-${index}`}><div><h4>Question {String(item.question)} · {String(item.topic)}</h4><p>{String(item.difficulty)} difficulty</p></div><span className="score-pill">{String(item.score)}/100</span></div>)}</div> : <p className="muted" style={{ fontSize: 13 }}>Answer-level score history appears after completing the adaptive interview.</p>}</section></div></div></AppShell>;
}

function Profile() {
  const { showToast, toast } = useToast(); const [profile, setProfile] = useState<Candidate>(() => getStore('candidateProfile', demoCandidate)); const update = (key: keyof Candidate, value: string) => setProfile((prev) => ({ ...prev, [key]: value })); const save = () => { setStore('candidateProfile', profile); showToast('Profile updated.', 'Your candidate context is saved locally.'); };
  return <AppShell title="Profile"><div className="content"><div className="page-intro"><div><span className="eyebrow">Candidate context</span><h2 className="display">Make the practice relevant.</h2><p>This is the context InterviewIQ uses to shape your sessions.</p></div><button className="btn btn-primary" onClick={save} data-testid="button-save-profile">Save changes <Check size={15} /></button></div><div className="profile-grid"><aside className="surface completeness"><span className="eyebrow" style={{ color: 'hsl(41 93% 62%)' }}>Profile completeness</span><h3>Enough context to start.</h3><p style={{ color: 'hsl(218 32% 75%)', fontSize: 12, lineHeight: 1.6 }}>Add a little more detail when you are ready. You do not need a perfect resume to practice well.</p><div className="completion-ring"><strong>72%</strong></div><span className="mono" style={{ color: 'hsl(218 32% 69%)', fontSize: 10 }}>RESUME PARSING: NOT DETECTED</span></aside><section className="surface profile-form"><h3>About you</h3><div className="form-two"><div className="field"><label htmlFor="profile-name">Full name</label><input id="profile-name" data-testid="input-profile-name" value={profile.name} onChange={(e) => update('name', e.target.value)} /></div><div className="field"><label htmlFor="profile-email">Email</label><input id="profile-email" data-testid="input-profile-email" value={profile.email} onChange={(e) => update('email', e.target.value)} /></div><div className="field"><label htmlFor="profile-role">Target role</label><input id="profile-role" data-testid="input-profile-role" value={profile.role} onChange={(e) => update('role', e.target.value)} /></div><div className="field"><label htmlFor="profile-experience">Experience</label><select id="profile-experience" data-testid="select-profile-experience" value={profile.experience} onChange={(e) => update('experience', e.target.value)}><option>0–2 years</option><option>3–4 years</option><option>5–7 years</option><option>8+ years</option></select></div></div><div className="field" style={{ marginTop: 15 }}><label htmlFor="profile-bio">Bio</label><textarea id="profile-bio" data-testid="input-profile-bio" value={profile.bio} onChange={(e) => update('bio', e.target.value)} rows={4} /></div><div className="field" style={{ marginTop: 15 }}><label>Skills</label><div className="tag-list">{profile.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></div><div className="surface" style={{ marginTop: 20, padding: 15, background: 'hsl(var(--muted) / .4)' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, fontWeight: 800 }}><FileText size={14} style={{ verticalAlign: 'middle', marginRight: 7 }} />Resume</span><span className="mono muted" style={{ fontSize: 10 }}>{profile.resumeName || 'NOT DETECTED'}</span></div></div></section></div><Toast toast={toast} /></div></AppShell>;
}

function HistoryPage() {
  const history = getStore<InterviewSession[]>('interviewHistory', []);
  return <AppShell title="History"><div className="content"><div className="page-intro"><div><span className="eyebrow">Practice archive</span><h2 className="display">Your reps, in context.</h2><p>Every result is a breadcrumb toward the kind of answer you want to repeat.</p></div><Link className="btn btn-primary" href="/interview/setup" data-testid="button-history-new"><Plus size={15} /> New interview</Link></div><section className="surface card-pad">{history.length ? <div className="history-list">{history.map((item) => <Link href={`/interview/result?id=${item.id}`} className="history-row" key={item.id} data-testid={`row-history-${item.id}`}><div style={{ display: 'flex', gap: 13, alignItems: 'center' }}><span className="feature-icon" style={{ width: 35, height: 35 }}><Code2 size={16} /></span><div><h4>{item.config.role}</h4><p>{item.config.type} · {item.config.topics.join(', ')} · {new Date(item.date).toLocaleDateString()}</p></div></div><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><span className="score-pill">{item.score}/100</span><ChevronRight size={15} color="hsl(var(--muted-foreground))" /></div></Link>)}</div> : <div className="empty"><History size={28} /><h3>Your archive is quiet.</h3><p>Complete an interview and the report will live here, alongside the context that makes it useful.</p><Link className="btn btn-primary" href="/interview/setup" data-testid="link-history-empty-start">Take your first interview <ArrowRight size={14} /></Link></div>}</section></div></AppShell>;
}

function SettingsPage() {
  const { showToast, toast } = useToast(); const [settings, setSettings] = useState(() => getStore('interviewSettings', { feedback: true, reminders: false, compact: false })); const toggle = (key: string) => { const next = { ...settings, [key]: !settings[key as keyof typeof settings] }; setSettings(next); setStore('interviewSettings', next); showToast('Preference saved.', 'This setting is local to the demo workspace.'); };
  return <AppShell title="Settings"><div className="content"><div className="page-intro"><div><span className="eyebrow">Workspace preferences</span><h2 className="display">Keep it yours.</h2><p>Small choices for a calmer, more useful practice room.</p></div></div><section className="surface card-pad" style={{ maxWidth: 760 }}><div className="settings-list"><div className="setting-row"><div><h4>Show post-session feedback</h4><p>Open the report immediately when an interview ends.</p></div><button className={`switch ${settings.feedback ? 'on' : ''}`} onClick={() => toggle('feedback')} aria-label="Toggle post-session feedback" data-testid="switch-feedback" /></div><div className="setting-row"><div><h4>Practice reminders</h4><p>Reminder notifications are not connected in this demo.</p></div><button className={`switch ${settings.reminders ? 'on' : ''}`} onClick={() => toggle('reminders')} aria-label="Toggle practice reminders" data-testid="switch-reminders" /></div><div className="setting-row"><div><h4>Compact interview transcript</h4><p>Use tighter spacing in the conversation workspace.</p></div><button className={`switch ${settings.compact ? 'on' : ''}`} onClick={() => toggle('compact')} aria-label="Toggle compact transcript" data-testid="switch-compact" /></div></div></section><section className="surface card-pad" style={{ maxWidth: 760, marginTop: 16, background: 'hsl(var(--muted) / .4)' }}><div className="card-title"><h3>Demo workspace data</h3><span className="mono muted" style={{ fontSize: 10 }}>LOCAL STORAGE</span></div><p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>Your candidate profile, sessions, preferences, and demo account are stored in this browser only. Nothing here represents a production account or a claim about your readiness.</p><button className="btn btn-danger btn-sm" onClick={() => { localStorage.removeItem('interviewHistory'); showToast('History cleared.', 'Your practice archive is empty now.'); }} data-testid="button-clear-history"><X size={14} /> Clear interview history</button></section><Toast toast={toast} /></div></AppShell>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation(); const user = getStore('currentUser', null);
  useEffect(() => { if (!user) setLocation('/login'); }, [user, location, setLocation]);
  return user ? <>{children}</> : null;
}

function Router() {
  return <ErrorBoundary resetKey={window.location.pathname}><Switch><Route path="/" component={Landing} /><Route path="/login"><AuthPage mode="login" /></Route><Route path="/signup"><AuthPage mode="signup" /></Route><Route path="/onboarding"><Onboarding /></Route><Route path="/dashboard"><ProtectedRoute><Dashboard /></ProtectedRoute></Route><Route path="/interview/setup"><ProtectedRoute><InterviewSetup /></ProtectedRoute></Route><Route path="/interview"><ProtectedRoute><Interview /></ProtectedRoute></Route><Route path="/interview/result"><ProtectedRoute><Result /></ProtectedRoute></Route><Route path="/profile"><ProtectedRoute><Profile /></ProtectedRoute></Route><Route path="/history"><ProtectedRoute><HistoryPage /></ProtectedRoute></Route><Route path="/settings"><ProtectedRoute><SettingsPage /></ProtectedRoute></Route><Route><Landing /></Route></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;