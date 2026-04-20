import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { campaignsApi } from '../api'
import { format } from 'date-fns'

export default function Campaigns() {
    const [campaigns, setCampaigns] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    const load = () => {
        setLoading(true)
        campaignsApi.getAll().then(r => setCampaigns(r.data)).catch(e => toast.error(e.message)).finally(() => setLoading(false))
    }
    useEffect(() => { load() }, [])

    const handleDelete = async (id) => {
        if (!confirm('Delete this campaign?')) return
        await campaignsApi.delete(id).catch(e => toast.error(e.message))
        load()
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>📤 Campaigns</h1>
                <p>Create and manage email campaigns. Each campaign uses a template and sends with your resume attached.</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
                <button className="btn btn-primary" onClick={() => navigate('/campaigns/new')}>✨ New Campaign</button>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner"></div></div>
            ) : campaigns.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-icon">📭</span>
                    <h3>No campaigns yet</h3>
                    <p>Create your first campaign to start sending job applications.</p>
                    <button className="btn btn-primary" onClick={() => navigate('/campaigns/new')}>✨ Create Campaign</button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {campaigns.map(c => (
                        <div key={c.id} className="card" style={{ cursor: 'default' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                        <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>{c.name}</h3>
                                        <span className={`badge badge-${c.status}`}>{c.status}</span>
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                                        📧 Subject: <span style={{ color: 'var(--text-secondary)' }}>{c.subject}</span>
                                        &nbsp;•&nbsp;💼 Position: <span style={{ color: 'var(--text-secondary)' }}>{c.position}</span>
                                        &nbsp;•&nbsp;🗓️ {format(new Date(c.created_at), 'MMM d, yyyy')}
                                    </div>

                                    {/* Stats */}
                                    <div style={{ display: 'flex', gap: 16 }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-success)' }}>{c.stats?.sent || 0}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sent</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-warning)' }}>{c.stats?.pending || 0}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pending</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-danger)' }}>{c.stats?.failed || 0}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Failed</div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 }}>
                                    <button className="btn btn-primary btn-sm" onClick={() => navigate(`/campaigns/${c.id}/edit`)}>✏️ Edit / Send</button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>🗑️ Delete</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
