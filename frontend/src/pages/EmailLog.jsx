import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { logsApi } from '../api'
import { format } from 'date-fns'

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

    const statusBadge = (s) => <span className={`badge badge-${s}`}>{
        s === 'sent' ? '🟢 Sent' : s === 'failed' ? '🔴 Failed' : '🟡 Pending'
    }</span>

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>📋 Email Log</h1>
                <p>Full history of all email send attempts</p>
            </div>

            {/* Stats */}
            <div className="grid-4" style={{ marginBottom: 24 }}>
                <div className="stat-card green">
                    <span className="stat-icon">🟢</span>
                    <div className="stat-value">{stats.sent || 0}</div>
                    <div className="stat-label">Total Sent</div>
                </div>
                <div className="stat-card red">
                    <span className="stat-icon">🔴</span>
                    <div className="stat-value">{stats.failed || 0}</div>
                    <div className="stat-label">Failed</div>
                </div>
                <div className="stat-card amber">
                    <span className="stat-icon">🟡</span>
                    <div className="stat-value">{stats.pending || 0}</div>
                    <div className="stat-label">Pending</div>
                </div>
                <div className="stat-card blue">
                    <span className="stat-icon">🚀</span>
                    <div className="stat-value">{stats.today || 0}</div>
                    <div className="stat-label">Sent Today</div>
                </div>
            </div>

            <div className="toolbar">
                <select className="select" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">All Status</option>
                    <option value="sent">🟢 Sent</option>
                    <option value="failed">🔴 Failed</option>
                    <option value="pending">🟡 Pending</option>
                </select>
                <div className="toolbar-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => logsApi.exportExcel()}>📥 Export Excel</button>
                    <button className="btn btn-ghost btn-sm" onClick={load}>🔄 Refresh</button>
                </div>
            </div>

            <div className="table-wrapper">
                {loading ? (
                    <div className="empty-state"><div className="spinner"></div></div>
                ) : logs.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">📭</span>
                        <h3>No emails yet</h3>
                        <p>Email history will appear here once you start sending campaigns.</p>
                    </div>
                ) : (
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
                                                <button className="btn btn-warning btn-sm" onClick={() => handleRetry(log.id)}>🔁 Retry</button>
                                            )}
                                            {log.error_msg && (
                                                <button className="btn btn-ghost btn-sm" onClick={() => toast.error(log.error_msg)} data-tooltip="View error">⚠️</button>
                                            )}
                                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(log.id)}>🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
