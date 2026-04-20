import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { companiesApi, logsApi } from '../api'
import { format } from 'date-fns'

export default function Dashboard() {
    const [stats, setStats] = useState({ total: 0, pending: 0, contacted: 0, sentToday: 0, totalSent: 0, totalFailed: 0, totalEmails: 0 })
    const [recentLogs, setRecentLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        Promise.all([
            companiesApi.getStats(),
            logsApi.getAll({ limit: 8 }),
        ]).then(([statsRes, logsRes]) => {
            setStats(statsRes.data)
            setRecentLogs(logsRes.data.logs)
        }).catch(() => { }).finally(() => setLoading(false))
    }, [])

    const cards = [
        { label: 'Total Companies', value: stats.total, icon: '🏢', color: 'blue' },
        { label: 'With Emails', value: stats.totalEmails, icon: '📧', color: 'sky' },
        { label: 'Pending Contact', value: stats.pending, icon: '⏳', color: 'amber' },
        { label: 'Contacted', value: stats.contacted, icon: '✅', color: 'green' },
        { label: 'Sent Today', value: stats.sentToday, icon: '🚀', color: 'pink' },
        { label: 'Total Failed', value: stats.totalFailed, icon: '❌', color: 'red' },
    ]

    const statusBadge = (s) => {
        const map = { sent: '🟢', failed: '🔴', pending: '🟡' }
        return map[s] || '⚪'
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>Dashboard</h1>
                <p>Welcome back! Here's an overview of your outreach campaigns.</p>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner"></div></div>
            ) : (
                <>
                    <div className="grid-6" style={{ marginBottom: 28 }}>
                        {cards.map(c => (
                            <div key={c.label} className={`stat-card ${c.color}`}>
                                <span className="stat-icon">{c.icon}</span>
                                <div className="stat-value">{c.value.toLocaleString()}</div>
                                <div className="stat-label">{c.label}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid-2" style={{ gap: 20 }}>
                        {/* Quick Actions */}
                        <div className="card">
                            <div className="card-header"><div className="card-title">⚡ Quick Actions</div></div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <button className="btn btn-primary btn-lg" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/companies')}>
                                    🏢 Manage Companies
                                </button>
                                <button className="btn btn-ghost btn-lg" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/scraper')}>
                                    🔍 Scrape New Companies
                                </button>
                                <button className="btn btn-success btn-lg" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/campaigns/new')}>
                                    ✨ Create Campaign
                                </button>
                                <button className="btn btn-ghost btn-lg" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/logs')}>
                                    📋 View Email Logs
                                </button>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title">🕐 Recent Activity</div>
                                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/logs')}>View all →</button>
                            </div>
                            {recentLogs.length === 0 ? (
                                <div className="empty-state" style={{ padding: '30px 20px' }}>
                                    <span className="empty-icon">📭</span>
                                    <p>No emails sent yet</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {recentLogs.map(log => (
                                        <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                                            <span style={{ fontSize: '0.9rem' }}>{statusBadge(log.status)}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {log.company_name || log.recipient_email}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{log.recipient_email}</div>
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {log.sent_at ? format(new Date(log.sent_at), 'MMM d, HH:mm') : '—'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
