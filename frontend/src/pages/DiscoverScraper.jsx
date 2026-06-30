import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { scraperApi, companiesApi } from '../api'

const KEYWORD_SUGGESTIONS = [
    'IT companies','Software companies','Tech startups','Web development companies',
    'AI companies','SaaS companies','Digital marketing agencies','Cloud companies',
    'Mobile app development','Cybersecurity companies','Data analytics companies',
    'ERP companies','Fintech companies','Consulting firms','BPO companies',
]

export default function DiscoverScraper({ onScrapeUrls }) {
    // Location state
    const [locations, setLocations] = useState([])
    const [country, setCountry] = useState('')
    const [state, setState] = useState('')
    const [city, setCity] = useState('')
    const [states, setStates] = useState([])
    const [cities, setCities] = useState([])

    // Keywords state
    const [keywords, setKeywords] = useState([])
    const [kwInput, setKwInput] = useState('')
    const [maxResults, setMaxResults] = useState(30)

    // Discovery state
    const [discoverId, setDiscoverId] = useState(null)
    const [status, setStatus] = useState(null)
    const [results, setResults] = useState([])
    const [progressMsg, setProgressMsg] = useState('')
    const [searching, setSearching] = useState(false)
    const [selected, setSelected] = useState(new Set())

    // Load locations on mount
    useEffect(() => {
        scraperApi.getLocations().then(r => setLocations(r.data)).catch(() => {})
    }, [])

    // Update states when country changes
    useEffect(() => {
        setState(''); setCity(''); setCities([])
        const c = locations.find(l => l.name === country)
        setStates(c?.states || [])
    }, [country, locations])

    // Update cities when state changes
    useEffect(() => {
        setCity('')
        const s = states.find(st => st.name === state)
        setCities(s?.cities || [])
    }, [state, states])

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
                setSearching(false)
                setStatus(data.status || 'complete')
                if (data.results?.length) {
                    setResults(data.results)
                    setSelected(new Set(data.results.map((_, i) => i)))
                }
                setProgressMsg('')
                toast.success(`🎯 Found ${data.count} companies!`)
            } else if (data.type === 'discover_stopped') {
                setSearching(false); setStatus('stopped'); setProgressMsg('')
                toast('Discovery stopped')
            } else if (data.type === 'discover_error') {
                setSearching(false); setStatus('error'); setProgressMsg('')
                toast.error(`Discovery error: ${data.error}`)
            }
        }
        return () => es.close()
    }, [])

    // Keyword management
    const addKeyword = (kw) => {
        const clean = kw.trim()
        if (clean && !keywords.includes(clean)) setKeywords(prev => [...prev, clean])
        setKwInput('')
    }
    const removeKeyword = (i) => setKeywords(prev => prev.filter((_, idx) => idx !== i))
    const handleKwKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword(kwInput) }
        if (e.key === 'Backspace' && !kwInput && keywords.length) removeKeyword(keywords.length - 1)
    }

    // Discovery
    const handleDiscover = async () => {
        if (!keywords.length) return toast.error('Add at least one keyword')
        if (!country) return toast.error('Select a country')
        setSearching(true); setResults([]); setStatus('searching'); setSelected(new Set())
        try {
            const res = await scraperApi.discover(keywords, { country, state, city }, maxResults)
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
        if (!urls.length) return toast.error('No websites in selection to scrape')
        if (onScrapeUrls) onScrapeUrls(urls)
    }
    const handleSaveToDb = async () => {
        const list = results.filter((_, i) => selected.has(i)).map(r => ({
            name: r.name, website: r.website || '', industry: r.category || 'IT', city: city || state || ''
        }))
        if (!list.length) return toast.error('Select at least one company')
        try {
            const res = await companiesApi.bulkAdd(list)
            toast.success(`💾 ${res.data.added} companies saved to database!`)
        } catch (e) { toast.error(e.message) }
    }

    const withWebsite = results.filter(r => r.website)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Search Config Card */}
            <div className="card">
                <div className="card-header">
                    <div className="card-title">🌐 Discover Companies from Google Maps</div>
                </div>

                {/* Location Dropdowns */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div className="form-group">
                        <label className="form-label">🌍 Country *</label>
                        <select className="select" value={country} onChange={e => setCountry(e.target.value)} disabled={searching}>
                            <option value="">Select country</option>
                            {locations.map(l => <option key={l.code} value={l.name}>{l.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">📍 State / Region</label>
                        <select className="select" value={state} onChange={e => setState(e.target.value)} disabled={!states.length || searching}>
                            <option value="">All states</option>
                            {states.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">🏙️ City</label>
                        <select className="select" value={city} onChange={e => setCity(e.target.value)} disabled={!cities.length || searching}>
                            <option value="">All cities</option>
                            {cities.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {/* Keywords Input */}
                <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">🏷️ Industry Keywords *</label>
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 12px',
                        background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        minHeight: 44, alignItems: 'center',
                    }}>
                        {keywords.map((kw, i) => (
                            <span key={i} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '4px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                                background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)',
                                border: '1px solid rgba(99,102,241,0.3)',
                            }}>
                                {kw}
                                <span onClick={() => removeKeyword(i)} style={{ cursor: 'pointer', marginLeft: 2, opacity: 0.7 }}>✕</span>
                            </span>
                        ))}
                        <input
                            value={kwInput} onChange={e => setKwInput(e.target.value)}
                            onKeyDown={handleKwKeyDown}
                            placeholder={keywords.length ? 'Add more...' : 'Type keyword and press Enter (e.g. IT companies)'}
                            disabled={searching}
                            style={{
                                flex: 1, minWidth: 180, background: 'none', border: 'none', outline: 'none',
                                color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit',
                            }}
                        />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        Press Enter or comma to add. Each keyword runs a separate Maps search.
                    </div>
                </div>

                {/* Keyword Suggestions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                    {KEYWORD_SUGGESTIONS.filter(s => !keywords.includes(s)).slice(0, 12).map(s => (
                        <button key={s} className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                            onClick={() => addKeyword(s)} disabled={searching}>
                            + {s}
                        </button>
                    ))}
                </div>

                {/* Max Results */}
                <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Max Results: <strong style={{ color: 'var(--accent-primary)' }}>{maxResults}</strong></label>
                    <input type="range" min="10" max="100" step="10" value={maxResults}
                        onChange={e => setMaxResults(parseInt(e.target.value))}
                        disabled={searching}
                        style={{ width: '100%', accentColor: 'var(--accent-primary)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <span>10 (fast)</span><span>100 (thorough)</span>
                    </div>
                </div>

                {/* Progress */}
                {searching && (
                    <div className="alert alert-info" style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                            <span>{progressMsg || 'Searching Google Maps...'}</span>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-lg" style={{ flex: 1 }}
                        onClick={handleDiscover} disabled={searching || !keywords.length || !country}>
                        {searching ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Discovering...</> : '🔍 Discover Companies'}
                    </button>
                    {searching && <button className="btn btn-danger" onClick={handleStop}>🛑 Stop</button>}
                </div>
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">
                            🏢 {results.length} Companies Found
                            {withWebsite.length < results.length && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({withWebsite.length} with websites)</span>}
                            {status === 'complete' && <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--accent-success)', fontWeight: 400 }}>✅</span>}
                            {searching && <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--accent-info)', fontWeight: 400 }} className="animate-pulse">⏳ Live...</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn btn-ghost btn-sm" onClick={toggleAll}>
                                {selected.size === results.length ? '☐ Deselect' : '☑ Select All'}
                            </button>
                            <button className="btn btn-success btn-sm" onClick={handleSaveToDb} disabled={!selected.size}>
                                💾 Save to DB ({selected.size})
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={handleScrape} disabled={!selected.size || searching}>
                                🚀 Scrape Emails ({results.filter((r, i) => selected.has(i) && r.website).length})
                            </button>
                        </div>
                    </div>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: 36 }}>☑</th>
                                    <th>Company</th>
                                    <th>Website</th>
                                    <th>Phone</th>
                                    <th>Address</th>
                                    <th>Source</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((r, i) => (
                                    <tr key={i} onClick={() => toggle(i)} style={{ cursor: 'pointer', animation: 'fadeIn 0.3s ease' }}>
                                        <td>
                                            <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)}
                                                onClick={e => e.stopPropagation()} style={{ accentColor: 'var(--accent-primary)' }} />
                                        </td>
                                        <td>
                                            <div className="bold">{r.name}</div>
                                            {r.category && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.category}</div>}
                                            {r.rating && <div style={{ fontSize: '0.68rem', color: 'var(--accent-warning)' }}>⭐ {r.rating}</div>}
                                        </td>
                                        <td className="mono" style={{ fontSize: '0.76rem' }}>
                                            {r.website ? (
                                                <a href={r.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                                                    style={{ color: 'var(--accent-info)' }}>
                                                    {r.domain || r.website.replace(/https?:\/\//, '')}
                                                </a>
                                            ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>No website</span>}
                                        </td>
                                        <td className="mono" style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                                            {r.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                        </td>
                                        <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: 200 }}>
                                            {r.address || '—'}
                                        </td>
                                        <td>
                                            <span className={`badge ${r.source?.includes('Maps') ? 'badge-sent' : 'badge-contacted'}`}
                                                style={{ fontSize: '0.65rem' }}>
                                                {r.source || 'Web'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="alert alert-info" style={{ marginTop: 12 }}>
                        💡 <strong>Save to DB</strong> adds companies to your outreach list. <strong>Scrape Emails</strong> visits their websites to find HR contacts.
                    </div>
                </div>
            )}
        </div>
    )
}
