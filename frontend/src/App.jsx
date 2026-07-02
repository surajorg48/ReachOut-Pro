import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState, lazy, Suspense } from 'react'
import { settingsApi } from './api'
import {
    DashboardIcon, CompaniesIcon, ScraperIcon, CampaignIcon,
    ResumeIcon, LogsIcon, SettingsIcon, DiscoverIcon, MailIcon, XIcon, ZapIcon
} from './components/Icons'
import { SkeletonCard } from './components/Skeleton'

// Lazy-load pages for faster initial bundle
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Companies = lazy(() => import('./pages/Companies'))
const Scraper = lazy(() => import('./pages/Scraper'))
const Campaigns = lazy(() => import('./pages/Campaigns'))
const CampaignCompose = lazy(() => import('./pages/CampaignCompose'))
const EmailLog = lazy(() => import('./pages/EmailLog'))
const Settings = lazy(() => import('./pages/Settings'))
const ResumeAnalyzer = lazy(() => import('./pages/ResumeAnalyzer'))
const DiscoverScraper = lazy(() => import('./pages/DiscoverScraper'))

const ChevronRight = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
    </svg>
)

function PageFallback() {
    return (
        <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SkeletonCard height={48} style={{ maxWidth: 300 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 8 }}>
                <SkeletonCard height={100} />
                <SkeletonCard height={100} />
                <SkeletonCard height={100} />
            </div>
            <SkeletonCard height={300} />
        </div>
    )
}

function Sidebar({ gmailConnected }) {
    const location = useLocation()

    const navItems = [
        { section: 'Overview', items: [
            { to: '/', label: 'Dashboard', Icon: DashboardIcon, exact: true },
        ]},
        { section: 'Outreach', items: [
            { to: '/companies', label: 'Companies', Icon: CompaniesIcon },
            { to: '/scraper', label: 'Scraper', Icon: ScraperIcon },
            { to: '/discover', label: 'Discover', Icon: DiscoverIcon },
            { to: '/campaigns', label: 'Campaigns', Icon: CampaignIcon },
            { to: '/resume', label: 'Resume AI', Icon: ResumeIcon },
        ]},
        { section: 'Tracking', items: [
            { to: '/logs', label: 'Email Log', Icon: LogsIcon },
        ]},
        { section: 'Config', items: [
            { to: '/settings', label: 'Settings', Icon: SettingsIcon },
        ]},
    ]

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MailIcon size={18} />
                    ReachOut Pro
                </h1>
                <p>HR Email Automation</p>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(({ section, items }) => (
                    <div key={section}>
                        <div className="nav-section-title">{section}</div>
                        {items.map(({ to, label, Icon, exact }) => {
                            const isActive = exact
                                ? location.pathname === to
                                : location.pathname.startsWith(to)
                            return (
                                <NavLink
                                    key={to}
                                    to={to}
                                    className={`nav-item${isActive ? ' active' : ''}`}
                                >
                                    <span className="nav-icon"><Icon size={16} /></span>
                                    {label}
                                    {isActive && (
                                        <span style={{ marginLeft: 'auto', opacity: 0.5 }}>
                                            <ChevronRight />
                                        </span>
                                    )}
                                </NavLink>
                            )
                        })}
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="gmail-status">
                    <span className={`status-dot ${gmailConnected ? 'connected' : 'disconnected'}`} />
                    <span>{gmailConnected ? 'Gmail Connected' : 'Gmail Disconnected'}</span>
                </div>
            </div>
        </aside>
    )
}

export default function App() {
    const [gmailConnected, setGmailConnected] = useState(false)

    useEffect(() => {
        settingsApi.getGmailStatus().then(r => setGmailConnected(r.data.gmailConnected)).catch(() => { })
        const t = setInterval(() => {
            settingsApi.getGmailStatus().then(r => setGmailConnected(r.data.gmailConnected)).catch(() => { })
        }, 30000)
        return () => clearInterval(t)
    }, [])

    return (
        <BrowserRouter>
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: '#1a1a3e',
                        color: '#f0f0ff',
                        border: '1px solid rgba(108,99,255,0.3)',
                        borderRadius: '10px',
                        fontFamily: "'Inter', sans-serif",
                        fontSize: '0.875rem',
                    },
                    success: { iconTheme: { primary: '#00d49e', secondary: '#fff' } },
                    error: { iconTheme: { primary: '#ff4d6d', secondary: '#fff' } },
                }}
            />
            <div className="app-layout">
                <Sidebar gmailConnected={gmailConnected} />
                <main className="main-content">
                    <Suspense fallback={<PageFallback />}>
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/companies" element={<Companies />} />
                            <Route path="/scraper" element={<Scraper />} />
                            <Route path="/discover" element={<DiscoverScraper />} />
                            <Route path="/campaigns" element={<Campaigns />} />
                            <Route path="/campaigns/new" element={<CampaignCompose />} />
                            <Route path="/campaigns/:id/edit" element={<CampaignCompose />} />
                            <Route path="/logs" element={<EmailLog />} />
                            <Route path="/resume" element={<ResumeAnalyzer />} />
                            <Route path="/settings" element={<Settings onGmailChange={setGmailConnected} />} />
                            <Route path="*" element={
                                <div className="page-container">
                                    <div className="empty-state">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                                        </svg>
                                        <h3>Page not found</h3>
                                        <p>The page you're looking for doesn't exist.</p>
                                    </div>
                                </div>
                            } />
                        </Routes>
                    </Suspense>
                </main>
            </div>
        </BrowserRouter>
    )
}
