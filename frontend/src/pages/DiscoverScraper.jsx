import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { scraperApi, companiesApi } from '../api'
import { SearchIcon, MapPinIcon, GlobeIcon, TagIcon, CityIcon, TrashIcon, CheckIcon, DownloadIcon, SendIcon, SaveIcon, XIcon, ListIcon, RefreshIcon } from '../components/Icons'

const HistoryIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
)

const EmptyBoxIcon = ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path>
    </svg>
)

const BuildingIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path>
    </svg>
)

const StopIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    </svg>
)

const LivePulseIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
)

const KW_SUGGESTIONS = [
    'IT companies','Software companies','Tech startups','Web development companies',
    'AI companies','SaaS companies','Digital marketing agencies','Cloud companies',
    'Mobile app development','Cybersecurity companies','Data analytics companies',
    'ERP companies','Fintech companies','Consulting firms','BPO companies',
]

export default function DiscoverScraper({ onScrapeUrls }) {
    const [discoverTab, setDiscoverTab] = useState('search') // 'search' | 'history'
    const [history, setHistory] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    // Location - free text + optional dropdowns
    const [locationText, setLocationText] = useState('')
    const [country, setCountry] = useState('')
    const [stateName, setStateName] = useState('')
    const [cityName, setCityName] = useState('')
    const [countries, setCountries] = useState([])
    const [statesList, setStatesList] = useState([])
    const [citiesList, setCitiesList] = useState([])
    const [loadingStates, setLoadingStates] = useState(false)
    const [loadingCities, setLoadingCities] = useState(false)
    const [showDropdowns, setShowDropdowns] = useState(false)

    // Keywords
    const [keywords, setKeywords] = useState([])
    const [kwInput, setKwInput] = useState('')
    const [maxResults, setMaxResults] = useState(30)

    // Discovery
    const [discoverId, setDiscoverId] = useState(null)
    const [status, setStatus] = useState(null)
    const [results, setResults] = useState([])
    const [progressMsg, setProgressMsg] = useState('')
    const [searching, setSearching] = useState(false)
    const [selected, setSelected] = useState(new Set())

    // Load countries on mount + history
    const loadHistory = () => {
        setLoadingHistory(true)
        scraperApi.getDiscoverHistory().then(r => setHistory(r.data || [])).catch(() => {}).finally(() => setLoadingHistory(false))
    }
    useEffect(() => {
        scraperApi.getCountries().then(r => setCountries(r.data || [])).catch(() => {})
        loadHistory()
    }, [])

    // Load states when country changes
    useEffect(() => {
        setStateName(''); setCityName(''); setStatesList([]); setCitiesList([])
        if (!country) return
        setLoadingStates(true)
        scraperApi.getStates(country).then(r => setStatesList(r.data || [])).catch(() => {}).finally(() => setLoadingStates(false))
    }, [country])

    // Load cities when state changes
    useEffect(() => {
        setCityName(''); setCitiesList([])
        if (!country || !stateName) return
        setLoadingCities(true)
        scraperApi.getCities(country, stateName).then(r => setCitiesList(r.data || [])).catch(() => {}).finally(() => setLoadingCities(false))
    }, [country, stateName])

    // Sync dropdowns → location text
    useEffect(() => {
        const parts = [cityName, stateName, country].filter(Boolean)
        if (parts.length) setLocationText(parts.join(', '))
    }, [cityName, stateName, country])

    // SSE listener
    useEffect(() => {
        const es = new EventSource('/api/scraper/stream')
        es.onmessage = (e) => {
            const data = JSON.parse(e.data)
            if (data.type === 'discover_progress') {
                setProgressMsg(data.message || '')
                if (data.step === 'found' && data.latest) {
                    setResults(prev => {
                        const key = data.latest.domain || data.latest.name
                        if (prev.some(r => (r.domain || r.name) === key)) return prev
                        const next = [...prev, data.latest]
                        setSelected(new Set(next.map((_, i) => i)))
                        return next
                    })
                }
            } else if (data.type === 'discover_done') {
                setSearching(false); setStatus(data.status || 'complete')
                if (data.results?.length) { setResults(data.results); setSelected(new Set(data.results.map((_, i) => i))) }
                setProgressMsg(''); toast.success(`🎯 Found ${data.count} companies!`)
            } else if (data.type === 'discover_stopped') {
                setSearching(false); setStatus('stopped'); setProgressMsg(''); toast('Discovery stopped')
            } else if (data.type === 'discover_error') {
                setSearching(false); setStatus('error'); setProgressMsg(''); toast.error(`Error: ${data.error}`)
            }
        }
        return () => es.close()
    }, [])

    // Keyword chip handlers
    const addKw = (kw) => { const c = kw.trim(); if (c && !keywords.includes(c)) setKeywords(p => [...p, c]); setKwInput('') }
    const removeKw = (i) => setKeywords(p => p.filter((_, idx) => idx !== i))
    const handleKwKey = (e) => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKw(kwInput) }
        if (e.key === 'Backspace' && !kwInput && keywords.length) removeKw(keywords.length - 1)
    }

    // Discovery handler
    const handleDiscover = async () => {
        if (!keywords.length) return toast.error('Add at least one keyword')
        setSearching(true); setResults([]); setStatus('searching'); setSelected(new Set())
        try {
            const res = await scraperApi.discover(keywords, locationText || '', maxResults)
            setDiscoverId(res.data.discoverId)
        } catch (e) { toast.error(e.message); setSearching(false); setStatus('error') }
    }
    const handleStop = () => { if (discoverId) scraperApi.stopDiscover(discoverId).catch(() => {}) }

    // Selection
    const toggle = (i) => setSelected(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n })
    const toggleAll = () => selected.size === results.length ? setSelected(new Set()) : setSelected(new Set(results.map((_, i) => i)))

    // Actions
    const handleScrape = () => {
        const urls = results.filter((_, i) => selected.has(i)).map(r => r.website).filter(Boolean)
        if (!urls.length) return toast.error('No websites in selection')
        if (onScrapeUrls) onScrapeUrls(urls)
    }
    const handleSaveToDb = async () => {
        const list = results.filter((_, i) => selected.has(i)).map(r => ({
            name: r.name, website: r.website || '', industry: r.category || 'IT', city: cityName || stateName || ''
        }))
        if (!list.length) return toast.error('Select at least one company')
        try { const res = await companiesApi.bulkAdd(list); toast.success(`💾 ${res.data.added} companies saved!`) } catch (e) { toast.error(e.message) }
    }

    const handleLoadHistory = (entry) => {
        setResults(entry.results || [])
        setSelected(new Set((entry.results || []).map((_, i) => i)))
        setStatus('complete')
        setDiscoverTab('search')
        toast.success(`Loaded ${entry.result_count} results from history`)
    }

    const handleDeleteHistory = async (id) => {
        try { await scraperApi.deleteDiscoverHistory(id); loadHistory(); toast.success('Deleted') } catch (e) { toast.error(e.message) }
    }

    const handleClearHistory = async () => {
        if (!confirm('Clear all discovery history?')) return
        try { await scraperApi.clearDiscoverHistory(); loadHistory(); toast.success('History cleared') } catch (e) { toast.error(e.message) }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Sub-tabs */}
            <div className="tabs">
                <div className={`tab ${discoverTab === 'search' ? 'active' : ''}`} onClick={() => setDiscoverTab('search')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <SearchIcon size={14} /> Search
                </div>
                <div className={`tab ${discoverTab === 'history' ? 'active' : ''}`} onClick={() => { setDiscoverTab('history'); loadHistory() }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HistoryIcon size={14} /> History ({history.length})
                </div>
            </div>

            {discoverTab === 'history' ? (
                /* ── History Tab ── */
                <div className="card">
                    <div className="card-header">
                        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><HistoryIcon size={16} /> Discovery History</div>
                        {history.length > 0 && <button className="btn btn-danger btn-sm" onClick={handleClearHistory} style={{ gap: 6 }}><TrashIcon size={13} /> Clear All</button>}
                    </div>
                    {loadingHistory ? <div className="empty-state"><div className="spinner"></div></div> : history.length === 0 ? (
                        <div className="empty-state" style={{ padding: 40 }}>
                            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><EmptyBoxIcon /></div>
                            <div>No discovery history yet. Run a search first!</div>
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table>
                                <thead><tr>
                                    <th>Query</th><th>Results</th><th>Date</th><th style={{ width: 140 }}>Actions</th>
                                </tr></thead>
                                <tbody>
                                    {history.map(h => (
                                        <tr key={h.id}>
                                            <td className="bold" style={{ maxWidth: 300 }}>{h.query}</td>
                                            <td><span className="badge badge-sent">{h.result_count} companies</span></td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                {new Date(h.created_at).toLocaleString()}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-primary btn-sm" onClick={() => handleLoadHistory(h)} style={{ gap: 6 }}><DownloadIcon size={13} /> Load</button>
                                                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteHistory(h.id)}><TrashIcon size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
            /* ── Search Tab ── */
            <>
            <div className="card">
                <div className="card-header">
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><GlobeIcon size={16} /> Discover Companies from Google Maps</div>
                </div>

                {/* Keywords */}
                <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><TagIcon size={13} /> Industry Keywords *</label>
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 12px',
                        background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        minHeight: 44, alignItems: 'center',
                    }}>
                        {keywords.map((kw, i) => (
                            <span key={i} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                                borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                                background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)',
                                border: '1px solid rgba(99,102,241,0.3)',
                            }}>
                                {kw}
                                <span onClick={() => removeKw(i)} style={{ cursor: 'pointer', opacity: 0.7 }}>✕</span>
                            </span>
                        ))}
                        <input value={kwInput} onChange={e => setKwInput(e.target.value)} onKeyDown={handleKwKey}
                            placeholder={keywords.length ? 'Add more...' : 'Type keyword and press Enter (e.g. IT companies)'}
                            disabled={searching}
                            style={{ flex: 1, minWidth: 180, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit' }} />
                    </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                    {KW_SUGGESTIONS.filter(s => !keywords.includes(s)).slice(0, 12).map(s => (
                        <button key={s} className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                            onClick={() => addKw(s)} disabled={searching}>+ {s}</button>
                    ))}
                </div>

                {/* Location Text Input */}
                <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPinIcon size={13} /> Location <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(type directly or use dropdowns below)</span></label>
                    <input className="input" value={locationText} onChange={e => setLocationText(e.target.value)}
                        placeholder="e.g. Pune, Maharashtra, India  —  or just type Pune"
                        disabled={searching} style={{ fontSize: '0.95rem' }} />
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Leave empty to search globally. Type any location or use the dropdowns to fill this field.
                    </div>
                </div>

                {/* Toggle Dropdowns */}
                <button className="btn btn-ghost btn-sm" style={{ marginBottom: 10, fontSize: '0.75rem' }}
                    onClick={() => setShowDropdowns(p => !p)} disabled={searching}>
                    {showDropdowns ? '▲ Hide location picker' : '▼ Pick from Country / State / City dropdowns'}
                </button>

                {/* Dropdowns */}
                {showDropdowns && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14, padding: 14, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><GlobeIcon size={13} /> Country</label>
                            <select className="select" value={country} onChange={e => setCountry(e.target.value)} disabled={searching}>
                                <option value="">Select country</option>
                                {countries.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <MapPinIcon size={13} /> State {loadingStates && <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5, marginLeft: 4 }} />}
                            </label>
                            <select className="select" value={stateName} onChange={e => setStateName(e.target.value)} disabled={!statesList.length || searching}>
                                <option value="">All states</option>
                                {statesList.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CityIcon size={13} /> City {loadingCities && <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5, marginLeft: 4 }} />}
                            </label>
                            <select className="select" value={cityName} onChange={e => setCityName(e.target.value)} disabled={!citiesList.length || searching}>
                                <option value="">All cities</option>
                                {citiesList.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {/* Max Results */}
                <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Max Results: <strong style={{ color: 'var(--accent-primary)' }}>{maxResults}</strong></label>
                    <input type="range" min="10" max="100" step="10" value={maxResults}
                        onChange={e => setMaxResults(parseInt(e.target.value))} disabled={searching}
                        style={{ width: '100%', accentColor: 'var(--accent-primary)' }} />
                </div>

                {/* Progress */}
                {searching && (
                    <div className="alert alert-info" style={{ marginBottom: 12 }}>
                        <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                        <span>{progressMsg || 'Searching...'}</span>
                    </div>
                )}

                {/* Search Button */}
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-lg" style={{ flex: 1, gap: 8 }}
                        onClick={handleDiscover} disabled={searching || !keywords.length}>
                        {searching ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Discovering...</> : <><SearchIcon size={16} /> Discover Companies{locationText ? ` in ${locationText}` : ''}</>}
                    </button>
                    {searching && <button className="btn btn-danger" onClick={handleStop} style={{ gap: 6 }}><StopIcon /> Stop</button>}
                </div>
            </div>

            {/* Results Table */}
            {results.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <BuildingIcon size={16} /> {results.length} Companies
                            {status === 'complete' && <CheckIcon size={14} style={{ color: 'var(--accent-success)', marginLeft: 8 }} />}
                            {searching && <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, fontSize: '0.75rem', color: 'var(--accent-info)', fontWeight: 400 }}><LivePulseIcon /> Live...</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn btn-ghost btn-sm" onClick={toggleAll}>
                                {selected.size === results.length ? '☐ Deselect' : `☑ Select All`}
                            </button>
                            <button className="btn btn-success btn-sm" onClick={handleSaveToDb} disabled={!selected.size} style={{ gap: 6 }}>
                                <SaveIcon size={13} /> Save to DB ({selected.size})
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={handleScrape} disabled={!selected.size || searching} style={{ gap: 6 }}>
                                <SendIcon size={13} /> Scrape Emails ({results.filter((r, i) => selected.has(i) && r.website).length})
                            </button>
                        </div>
                    </div>
                    <div className="table-wrapper">
                        <table>
                            <thead><tr>
                                <th style={{ width: 36 }}>☑</th><th>Company</th><th>Website</th><th>Phone</th><th>Address</th><th>Source</th>
                            </tr></thead>
                            <tbody>
                                {results.map((r, i) => (
                                    <tr key={i} onClick={() => toggle(i)} style={{ cursor: 'pointer', animation: 'fadeIn 0.3s ease' }}>
                                        <td><input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} onClick={e => e.stopPropagation()} style={{ accentColor: 'var(--accent-primary)' }} /></td>
                                        <td>
                                            <div className="bold">{r.name}</div>
                                            {r.category && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.category}</div>}
                                            {r.rating && <div style={{ fontSize: '0.68rem', color: 'var(--accent-warning)' }}>⭐ {r.rating}</div>}
                                        </td>
                                        <td className="mono" style={{ fontSize: '0.76rem' }}>
                                            {r.website ? <a href={r.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--accent-info)' }}>{r.domain || r.website.replace(/https?:\/\//, '')}</a>
                                                : <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>}
                                        </td>
                                        <td className="mono" style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{r.phone || '—'}</td>
                                        <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: 200 }}>{r.address || '—'}</td>
                                        <td><span className={`badge ${r.source?.includes('Maps') ? 'badge-sent' : 'badge-contacted'}`} style={{ fontSize: '0.65rem' }}>{r.source || 'Web'}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="alert alert-info" style={{ marginTop: 12 }}>
                        💡 <strong>Save to DB</strong> adds to your outreach list. <strong>Scrape Emails</strong> visits websites to find HR contacts.
                    </div>
                </div>
            )}
            </>
            )}
        </div>
    )
}
