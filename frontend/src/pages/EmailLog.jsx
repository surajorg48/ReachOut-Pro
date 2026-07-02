import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { logsApi } from '../api'
import { format } from 'date-fns'
import { SkeletonTable, SkeletonStatCard } from '../components/Skeleton'
import { DownloadIcon, RefreshIcon, TrashIcon, AlertIcon, CheckIcon, ZapIcon, ClockIcon, LogsIcon } from '../components/Icons'

const RetryIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
    </svg>
)

export default function EmailLog() {
    const [logs, setLogs] = useState([])
    const [total, setTotal] = useState(0)
    const [stats, setStats] = useState({})
    const [statusFilter, setStatusFilter] = useState('')
    const [loading, setLoading] = useState(true)

    const load = () => {
        setLoading(true)
        Promise.all([
            logsApi.getAll({ status: statusFilter, limit: 200 }),
            logsApi.getStats(),
        ]).then(([logsRes, statsRes]) => {
            setLogs(logsRes.data.logs)
            setTotal(logsRes.data.total)
            setStats(statsRes.data)
        }).catch(e => toast.error(e.message)).finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [statusFilter])

    const handleRetry = async (id) => {
        try {
            await logsApi.retry(id)
            toast.success('Email queued for retry!')
            load()
        } catch (e) { toast.error(e.message) }
    }

    const handleDelete = async (id) => {
        await logsApi.delete(id).catch(e => toast.error(e.message))
        load()
    }

    const statusBadge = (s) => (
        <span className={`badge badge-${s}`} style={{ gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block', flexShrink: 0 }} />
            {s === 'sent' ? 'Sent' : s === 'failed' ? 'Failed' : 'Pending'}
        </span>
    )

    const statCards = [
        { label: 'Total Sent', value: stats.sent || 0, icon: CheckIcon, color: 'green' },
        { label: 'Failed', value: stats.failed || 0, icon: AlertIcon, color: 'red' },
        { label: 'Pending', value: stats.pending || 0, icon: ClockIcon, color: 'amber' },
        { label: 'Sent Today', value: stats.today || 0, icon: ZapIcon, color: 'blue' },
    ]

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                    <LogsIcon size={24} /> Email Log
                </h1>
                <p style={{ marginTop: 4 }}>Full history of all email send attempts</p>
            </div>

            {/* Stats */}
            <div className="grid-4" style={{ marginBottom: 24 }}>
                {loading
                    ? Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
                    : statCards.map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className={`stat-card ${color}`}>
                            <div className={`stat-icon-wrap ${color}`}><Icon size={20} /></div>
                            <div className="stat-value">{value.toLocaleString()}</div>
                            <div className="stat-label">{label}</div>
                        </div>
                    ))
                }
            </div>

            <div className="toolbar">
                <select className="select" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">All Status</option>
                    <option value="sent">Sent</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                </select>
                <div className="toolbar-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => logsApi.exportExcel()} style={{ gap: 7 }}>
                        <DownloadIcon size={14} /> Export Excel
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={load} style={{ gap: 7 }}>
                        <RefreshIcon size={14} /> Refresh
                    </button>
                </div>
            </div>

            {loading ? <SkeletonTable rows={8} cols={7} /> : logs.length === 0 ? (
                <div className="empty-state">
                    <LogsIcon size={40} style={{ opacity: 0.25 }} />
                    <h3>No emails yet</h3>
                    <p>Email history will appear here once you start sending campaigns.</p>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Company</th>
                                <th>Email</th>
                                <th>Subject</th>
                                <th>Status</th>
                                <th>Sent At</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, i) => (
                                <tr key={log.id}>
                                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                    <td className="bold">{log.company_name || '—'}</td>
                                    <td className="mono" style={{ color: 'var(--accent-info)', fontSize: '0.79rem' }}>{log.recipient_email}</td>
                                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.subject}</td>
                                    <td>{statusBadge(log.status)}</td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                        {log.sent_at ? format(new Date(log.sent_at), 'MMM d, HH:mm') : '—'}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {log.status === 'failed' && (
                                                <button className="btn btn-warning btn-sm" onClick={() => handleRetry(log.id)} style={{ gap: 6 }}>
                                                    <RetryIcon /> Retry
                                                </button>
                                            )}
                                            {log.error_msg && (
                                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => toast.error(log.error_msg)} data-tooltip="View error">
                                                    <AlertIcon size={14} />
                                                </button>
                                            )}
                                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(log.id)} data-tooltip="Delete">
                                                <TrashIcon size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
