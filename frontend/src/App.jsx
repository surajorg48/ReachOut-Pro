import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { settingsApi } from './api'
import Dashboard from './pages/Dashboard'
import Companies from './pages/Companies'
import Scraper from './pages/Scraper'
import Campaigns from './pages/Campaigns'
import CampaignCompose from './pages/CampaignCompose'
import EmailLog from './pages/EmailLog'
import Settings from './pages/Settings'

function Sidebar({ gmailConnected }) {
    const location = useLocation()
    const nav = (to) => `nav-item${location.pathname === to || location.pathname.startsWith(to + '/') ? ' active' : ''}`

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <h1>✉️ ReachOut Pro</h1>
                <p>HR Email Automation</p>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-section-title">Overview</div>
                <NavLink to="/" className={({ isActive }) => `nav-item${isActive && location.pathname === '/' ? ' active' : ''}`}>
                    <span className="nav-icon">📊</span> Dashboard
                </NavLink>

                <div className="nav-section-title">Outreach</div>
                <NavLink to="/companies" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                    <span className="nav-icon">🏢</span> Companies
                </NavLink>
                <NavLink to="/scraper" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                    <span className="nav-icon">🔍</span> Scraper
                </NavLink>
                <NavLink to="/campaigns" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                    <span className="nav-icon">📤</span> Campaigns
                </NavLink>

                <div className="nav-section-title">Tracking</div>
                <NavLink to="/logs" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                    <span className="nav-icon">📋</span> Email Log
                </NavLink>

                <div className="nav-section-title">Config</div>
                <NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                    <span className="nav-icon">⚙️</span> Settings
                </NavLink>
            </nav>

            <div className="sidebar-footer">
                <div className="gmail-status">
                    <span className={`status-dot ${gmailConnected ? 'connected' : 'disconnected'}`}></span>
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
        // Refresh every 30s
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
                    style: { background: '#1a1a3e', color: '#f0f0ff', border: '1px solid rgba(108,99,255,0.3)', borderRadius: '10px' },
                    success: { iconTheme: { primary: '#00d49e', secondary: '#fff' } },
                    error: { iconTheme: { primary: '#ff4d6d', secondary: '#fff' } },
                }}
            />
            <div className="app-layout">
                <Sidebar gmailConnected={gmailConnected} />
                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/companies" element={<Companies />} />
                        <Route path="/scraper" element={<Scraper />} />
                        <Route path="/campaigns" element={<Campaigns />} />
                        <Route path="/campaigns/new" element={<CampaignCompose />} />
                        <Route path="/campaigns/:id/edit" element={<CampaignCompose />} />
                        <Route path="/logs" element={<EmailLog />} />
                        <Route path="/settings" element={<Settings onGmailChange={setGmailConnected} />} />
                        <Route path="*" element={
                            <div className="page-container">
                                <div className="empty-state">
                                    <span className="empty-icon">🔦</span>
                                    <h3>Page not found</h3>
                                    <p>The page you're looking for doesn't exist.</p>
                                </div>
                            </div>
                        } />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    )
}
