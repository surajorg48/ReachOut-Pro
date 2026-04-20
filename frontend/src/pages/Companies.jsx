import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { companiesApi, campaignsApi } from '../api'

export default function Companies() {
    const [companies, setCompanies] = useState([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [selected, setSelected] = useState(new Set())
    const [showAddModal, setShowAddModal] = useState(false)
    const [addForm, setAddForm] = useState({ name: '', website: '', email: '', hr_name: '', city: '', industry: 'IT' })
    const [sending, setSending] = useState(false)
    const [campaigns, setCampaigns] = useState([])
    const [showSendModal, setShowSendModal] = useState(false)
    const [selectedCampaign, setSelectedCampaign] = useState('')
    const [sendMode, setSendMode] = useState('selected') // 'selected' | 'all'
    const [importProgress, setImportProgress] = useState(null)
    const fileRef = useRef()
    const navigate = useNavigate()

    const load = () => {
        setLoading(true)
        companiesApi.getAll({ search, status: statusFilter, limit: 200 })
            .then(r => { setCompanies(r.data.companies); setTotal(r.data.total) })
            .catch(e => toast.error(e.message))
            .finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [search, statusFilter])
    useEffect(() => { campaignsApi.getAll().then(r => setCampaigns(r.data)).catch(() => { }) }, [])

    const toggleSelect = (id) => {
        const s = new Set(selected)
        s.has(id) ? s.delete(id) : s.add(id)
        setSelected(s)
    }

    const toggleAll = () => {
        setSelected(selected.size === companies.length ? new Set() : new Set(companies.map(c => c.id)))
    }

    const handleDelete = async (id) => {
        if (!confirm('Delete this company?')) return
        await companiesApi.delete(id).catch(e => toast.error(e.message))
        load()
    }

    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selected.size} companies?`)) return
        await companiesApi.bulkDelete([...selected]).catch(e => toast.error(e.message))
        setSelected(new Set())
        load()
    }

    const handleAdd = async () => {
        if (!addForm.name) return toast.error('Company name is required')
        await companiesApi.create(addForm)
        toast.success('Company added!')
        setShowAddModal(false)
        setAddForm({ name: '', website: '', email: '', hr_name: '', city: '', industry: 'IT' })
        load()
    }

    const handleImportExcel = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setImportProgress('Importing...')
        try {
            const res = await companiesApi.importExcel(file)
            toast.success(`✅ ${res.data.added} companies imported!`)
            load()
        } catch (err) {
            toast.error(err.message)
        } finally {
            setImportProgress(null)
            e.target.value = ''
        }
    }

    const openSendDialog = (mode) => {
        if (mode === 'selected' && selected.size === 0) return toast.error('Select at least one company')
        if (campaigns.length === 0) return toast.error('Create a campaign first!')
        setSendMode(mode)
        setSelectedCampaign(campaigns[0]?.id || '')
        setShowSendModal(true)
    }

    const handleSend = async () => {
        if (!selectedCampaign) return toast.error('Select a campaign')
        setSending(true)
        setShowSendModal(false)
        try {
            if (sendMode === 'selected') {
                const res = await campaignsApi.sendSelected(selectedCampaign, [...selected])
                toast.success(`📤 Queued ${res.data.count} emails! Sending in background...`)
            } else {
                const res = await campaignsApi.sendAll(selectedCampaign)
                toast.success(`📤 Queued ${res.data.count} emails to all pending companies!`)
            }
            setSelected(new Set())
        } catch (e) { toast.error(e.message) }
        finally { setSending(false) }
    }

    const statusOptions = [
        { value: '', label: 'All Status' },
        { value: 'pending', label: '⏳ Pending' },
        { value: 'contacted', label: '✅ Contacted' },
        { value: 'not_interested', label: '🚫 Not Interested' },
    ]

    const statusBadge = (s) => <span className={`badge badge-${s}`}>{s}</span>

    const scoreBar = (score) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="progress-bar-container" style={{ width: 50, height: 4 }}>
                <div className="progress-bar-fill" style={{ width: `${score || 0}%` }} />
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{score || 0}</span>
        </div>
    )

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>🏢 Companies</h1>
                <p>{total} companies found • {[...selected].length > 0 ? `${selected.size} selected` : 'Select companies to send emails'}</p>
            </div>

            <div className="toolbar">
                <div className="toolbar-search">
                    <span className="search-icon">🔍</span>
                    <input className="input" placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="select" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                <div className="toolbar-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => companiesApi.downloadTemplate()} data-tooltip="Download blank Excel template">
                        📥 Template
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()} disabled={!!importProgress}>
                        📂 {importProgress || 'Import Excel'}
                    </button>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportExcel} />
                    <button className="btn btn-ghost btn-sm" onClick={() => companiesApi.exportExcel()}>
                        📤 Export
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(true)}>
                        ➕ Add
                    </button>
                </div>
            </div>

            {/* Selection Action Bar */}
            {selected.size > 0 && (
                <div className="selection-bar">
                    <span>✓ {selected.size} selected</span>
                    <button className="btn btn-success btn-sm" onClick={() => openSendDialog('selected')} disabled={sending}>
                        {sending ? '⏳' : '📤'} Send to Selected
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => companiesApi.bulkStatus([...selected], 'not_interested').then(() => { toast.success('Marked as Not Interested'); load() })}>
                        🚫 Not Interested
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>🗑️ Delete</button>
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setSelected(new Set())}>✕ Clear</button>
                </div>
            )}

            {/* Send All button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 8 }}>
                <button className="btn btn-primary" onClick={() => openSendDialog('all')} disabled={sending}>
                    🚀 Send to All Pending
                </button>
            </div>

            <div className="table-wrapper">
                {loading ? (
                    <div className="empty-state"><div className="spinner"></div></div>
                ) : companies.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">🏢</span>
                        <h3>No companies yet</h3>
                        <p>Import an Excel file, add manually, or run the scraper to discover companies.</p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th><input type="checkbox" checked={selected.size === companies.length && companies.length > 0} onChange={toggleAll} /></th>
                                <th>Company</th>
                                <th>HR Email</th>
                                <th>Email Score</th>
                                <th>City</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {companies.map(c => (
                                <tr key={c.id} className={selected.has(c.id) ? 'selected' : ''}>
                                    <td><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                                    <td className="bold">
                                        <div>{c.name}</div>
                                        {c.website && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.website.replace('https://', '').replace('www.', '')}</div>}
                                    </td>
                                    <td>
                                        {c.best_email ? (
                                            <div>
                                                <div className="mono" style={{ color: 'var(--accent-info)', fontSize: '0.8rem' }}>{c.best_email}</div>
                                                {c.hr_name && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.hr_name}</div>}
                                            </div>
                                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                    </td>
                                    <td>{c.email_score ? scoreBar(c.email_score) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{c.city || '—'}</td>
                                    <td>{statusBadge(c.status || 'pending')}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => {
                                                const id = c.id
                                                openSendDialog('selected')
                                                setSelected(new Set([id]))
                                            }} data-tooltip="Send email">📤</button>
                                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(c.id)} data-tooltip="Delete">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Add Company Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">➕ Add Company</div>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowAddModal(false)}>✕</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div className="form-group"><label className="form-label">Company Name *</label>
                                <input className="input" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} placeholder="TCS, Infosys, Wipro..." /></div>
                            <div className="form-group"><label className="form-label">Website</label>
                                <input className="input" value={addForm.website} onChange={e => setAddForm({ ...addForm, website: e.target.value })} placeholder="https://company.com" /></div>
                            <div className="grid-2">
                                <div className="form-group"><label className="form-label">HR Email</label>
                                    <input className="input" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} placeholder="hr@company.com" /></div>
                                <div className="form-group"><label className="form-label">HR Name</label>
                                    <input className="input" value={addForm.hr_name} onChange={e => setAddForm({ ...addForm, hr_name: e.target.value })} placeholder="Priya Sharma" /></div>
                            </div>
                            <div className="grid-2">
                                <div className="form-group"><label className="form-label">City</label>
                                    <input className="input" value={addForm.city} onChange={e => setAddForm({ ...addForm, city: e.target.value })} placeholder="Pune" /></div>
                                <div className="form-group"><label className="form-label">Industry</label>
                                    <input className="input" value={addForm.industry} onChange={e => setAddForm({ ...addForm, industry: e.target.value })} /></div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleAdd}>✅ Add Company</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Send Campaign Modal */}
            {showSendModal && (
                <div className="modal-overlay" onClick={() => setShowSendModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">📤 Send Emails</div>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowSendModal(false)}>✕</button>
                        </div>
                        <div className="alert alert-info">
                            📋 Sending to: <strong>{sendMode === 'selected' ? `${selected.size} selected companies` : 'ALL pending companies'}</strong>
                        </div>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label">Select Campaign *</label>
                            <select className="select" value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}>
                                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="alert alert-warning">
                            ⚠️ Emails will be sent with a delay between each one to avoid spam filters.
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowSendModal(false)}>Cancel</button>
                            <button className="btn btn-success" onClick={handleSend}>🚀 Start Sending</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
