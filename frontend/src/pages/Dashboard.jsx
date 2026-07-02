import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { companiesApi, logsApi } from '../api'
import { format } from 'date-fns'
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
    BuildingIcon, MailIcon, ClockIcon, CheckIcon, ZapIcon,
    AlertIcon, TrendUpIcon, UsersIcon, CompaniesIcon, ScraperIcon,
    CampaignIcon, LogsIcon, ActivityIcon
} from '../components/Icons'
import { SkeletonStatCard, SkeletonCard } from '../components/Skeleton'

const COLORS = {
    primary: '#6c63ff',
    success: '#00d49e',
    warning: '#f59e0b',
    danger: '#ff4d6d',
    info: '#38bdf8',
    pink: '#ff6b9d',
}

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: '#0f0f24',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '10px 14px',
                fontFamily: "'Inter', sans-serif",
                fontSize: '0.78rem',
            }}>
                {label && <div style={{ color: '#9090bb', marginBottom: 6 }}>{label}</div>}
                {payload.map((p, i) => (
                    <div key={i} style={{ color: p.color || '#f0f0ff', fontWeight: 600 }}>
                        {p.name}: {p.value}
                    </div>
                ))}
            </div>
        )
    }
    return null
}

const ChevronRight = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
        <polyline points="9 18 15 12 9 6" />
    </svg>
)

export default function Dashboard() {
    const [stats, setStats] = useState({ total: 0, pending: 0, contacted: 0, sentToday: 0, totalSent: 0, totalFailed: 0, totalEmails: 0 })
    const [recentLogs, setRecentLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        Promise.all([
            companiesApi.getStats(),
            logsApi.getAll({ limit: 10 }),
        ]).then(([statsRes, logsRes]) => {
            setStats(statsRes.data)
            setRecentLogs(logsRes.data.logs || [])
        }).catch(() => { }).finally(() => setLoading(false))
    }, [])

    // Pie chart data for company status
    const pieData = [
        { name: 'Contacted', value: stats.contacted, color: COLORS.success },
        { name: 'Pending', value: stats.pending, color: COLORS.warning },
        { name: 'Not Interested', value: Math.max(0, stats.total - stats.contacted - stats.pending), color: COLORS.danger },
    ].filter(d => d.value > 0)

    // Build mini bar chart from recent logs (group by status)
    const emailBreakdown = [
        { name: 'Total Sent', value: stats.totalSent, fill: COLORS.success },
        { name: 'Failed', value: stats.totalFailed, fill: COLORS.danger },
        { name: 'Pending', value: stats.pending, fill: COLORS.warning },
        { name: 'Today', value: stats.sentToday, fill: COLORS.primary },
    ]

    const statCards = [
        { label: 'Total Companies', value: stats.total, icon: CompaniesIcon, color: 'blue', change: '' },
        { label: 'Emails Found', value: stats.totalEmails, icon: MailIcon, color: 'sky', change: '' },
        { label: 'Pending Contact', value: stats.pending, icon: ClockIcon, color: 'amber', change: '' },
        { label: 'Contacted', value: stats.contacted, icon: CheckIcon, color: 'green', change: '' },
        { label: 'Sent Today', value: stats.sentToday, icon: ZapIcon, color: 'pink', change: '' },
        { label: 'Total Failed', value: stats.totalFailed, icon: AlertIcon, color: 'red', change: '' },
    ]

    const quickActions = [
        { label: 'Manage Companies', sub: 'View and organize your company list', icon: CompaniesIcon, color: COLORS.primary, path: '/companies' },
        { label: 'Scrape Emails', sub: 'Discover HR emails from websites', icon: ScraperIcon, color: COLORS.info, path: '/scraper' },
        { label: 'New Campaign', sub: 'Create and launch an email campaign', icon: CampaignIcon, color: COLORS.success, path: '/campaigns/new' },
        { label: 'Email Logs', sub: 'Track all sent emails', icon: LogsIcon, color: COLORS.warning, path: '/logs' },
    ]

    // Success rate percentage
    const successRate = stats.totalSent > 0
        ? Math.round(((stats.totalSent - stats.totalFailed) / stats.totalSent) * 100)
        : 0

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Dashboard</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 4 }}>
                    Welcome back — here's your outreach overview
                </p>
            </div>

            {/* Stat Cards */}
            <div className="grid-6" style={{ marginBottom: 24 }}>
                {loading
                    ? Array.from({ length: 6 }).map((_, i) => <SkeletonStatCard key={i} />)
                    : statCards.map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className={`stat-card ${color}`}>
                            <div className={`stat-icon-wrap ${color}`}>
                                <Icon size={20} />
                            </div>
                            <div className="stat-value">{(value || 0).toLocaleString()}</div>
                            <div className="stat-label">{label}</div>
                        </div>
                    ))
                }
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>

                {/* Email Performance Bar Chart */}
                <div className="chart-container" style={{ gridColumn: 'span 2' }}>
                    <div className="chart-title">Email Performance</div>
                    <div className="chart-subtitle">Overview of all email activity</div>
                    {loading ? <SkeletonCard height={160} /> : (
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={emailBreakdown} barSize={36} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="name" tick={{ fill: '#5a5a8a', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#5a5a8a', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                    {emailBreakdown.map((entry, index) => (
                                        <Cell key={index} fill={entry.fill} fillOpacity={0.85} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Company Status Pie */}
                <div className="chart-container" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="chart-title">Company Status</div>
                    <div className="chart-subtitle">Contact progress breakdown</div>
                    {loading ? <SkeletonCard height={180} /> : stats.total === 0 ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            No data yet
                        </div>
                    ) : (
                        <div style={{ position: 'relative', flex: 1 }}>
                            <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={72}
                                        paddingAngle={3}
                                        dataKey="value"
                                        strokeWidth={0}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={index} fill={entry.color} fillOpacity={0.9} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Center label */}
                            <div className="donut-center">
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    {stats.total}
                                </div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>TOTAL</div>
                            </div>
                        </div>
                    )}
                    {/* Legend */}
                    {!loading && pieData.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                            {pieData.map(d => (
                                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                                    <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{d.name}</span>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{d.value}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Quick Actions */}
                <div className="chart-container">
                    <div className="chart-title" style={{ marginBottom: 16 }}>Quick Actions</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {quickActions.map(({ label, sub, icon: Icon, color, path }) => (
                            <button key={path} className="quick-action-btn" onClick={() => navigate(path)}>
                                <div className="qa-icon" style={{ background: `${color}20`, color }}>
                                    <Icon size={16} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>
                                </div>
                                <ChevronRight />
                            </button>
                        ))}
                    </div>

                    {/* Success Rate Banner */}
                    {!loading && stats.totalSent > 0 && (
                        <div style={{
                            marginTop: 16,
                            padding: '14px 16px',
                            background: 'rgba(0, 212, 158, 0.07)',
                            border: '1px solid rgba(0, 212, 158, 0.2)',
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                        }}>
                            <TrendUpIcon size={18} style={{ color: COLORS.success }} />
                            <div>
                                <div style={{ fontSize: '1rem', fontWeight: 800, color: COLORS.success }}>{successRate}%</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Email delivery success rate</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Recent Activity */}
                <div className="chart-container">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div className="chart-title">Recent Activity</div>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => navigate('/logs')}
                            style={{ fontSize: '0.75rem' }}
                        >
                            View all
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}><div className="skeleton" style={{ height: '0.8rem', width: '70%', borderRadius: 4 }} /></div>
                                    <div className="skeleton" style={{ height: '0.7rem', width: '50px', borderRadius: 4 }} />
                                </div>
                            ))}
                        </div>
                    ) : recentLogs.length === 0 ? (
                        <div className="empty-state" style={{ padding: '30px 0' }}>
                            <ActivityIcon size={32} style={{ opacity: 0.3 }} />
                            <p style={{ marginTop: 8 }}>No emails sent yet</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {recentLogs.map(log => (
                                <div key={log.id} className="activity-item">
                                    <div className={`activity-dot ${log.status}`} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: '0.82rem',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {log.company_name || log.recipient_email}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {log.recipient_email}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                                        <span className={`badge badge-${log.status}`} style={{ fontSize: '0.65rem' }}>
                                            {log.status}
                                        </span>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                            {log.sent_at ? format(new Date(log.sent_at), 'MMM d, HH:mm') : '—'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
