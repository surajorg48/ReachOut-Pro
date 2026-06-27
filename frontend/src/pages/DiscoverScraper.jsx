import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { scraperApi } from '../api'

const EXAMPLE_QUERIES = [
    'IT companies in Pune',
    'Software companies in Bangalore',
    'Tech startups in Mumbai',
    'IT companies in Hyderabad',
    'Web development companies in Delhi',
    'AI companies in India',
    'SaaS companies in Chennai',
    'Digital marketing agencies in Pune',
]

export default function DiscoverScraper({ onScrapeUrls }) {
    const [query, setQuery] = useState('')
    const [maxPages, setMaxPages] = useState(3)
    const [discoverId, setDiscoverId] = useState(null)
    const [status, setStatus] = useState(null) // searching, complete, stopped, error
    const [results, setResults] = useState([])
    const [progressMsg, setProgressMsg] = useState('')
    const [searching, setSearching] = useState(false)
    const [selected, setSelected] = useState(new Set())
    const eventSourceRef = useRef(null)

    // SSE listener for discover events
    useEffect(() => {
        const es = new EventSource('/api/scraper/stream')
        eventSourceRef.current = es

        es.onmessage = (e) => {
            const data = JSON.parse(e.data)

            if (data.type === 'discover_progress') {
                setProgressMsg(data.message || '')
                if (data.step === 'found' && data.latest) {
                    setResults(prev => {
                        if (prev.some(r => r.website === data.latest.website)) return prev
                        return [...prev, data.latest]
                    })
                }
            } else if (data.type === 'discover_done') {
                setSearching(false)
                setStatus(data.status || 'complete')
                setResults(data.results || [])
                setProgressMsg('')
                const s = new Set((data.results || []).map((_, i) => i))
                setSelected(s)
                toast.success(`🎯 Found ${data.count} company websites!`)
            } else if (data.type === 'discover_stopped') {
                setSearching(false)
                setStatus('stopped')
                setProgressMsg('')
                toast('Discovery stopped')
            } else if (data.type === 'discover_error') {
                setSearching(false)
                setStatus('error')
                setProgressMsg('')
                toast.error(`Discovery error: ${data.error}`)
            }
        }

        return () => es.close()
    }, [])

    const handleDiscover = async () => {
        if (!query.trim()) return toast.error('Enter a search query')
        setSearching(true)
        setResults([])
        setStatus('searching')
        setSelected(new Set())
        try {
            const res = await scraperApi.discover(query, maxPages)
            setDiscoverId(res.data.discoverId)
        } catch (e) {
            toast.error(e.message)
            setSearching(false)
            setStatus('error')
        }
    }

    const handleStop = async () => {
        if (!discoverId) return
        await scraperApi.stopDiscover(discoverId).catch(() => {})
    }

    const toggleSelect = (i) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(i) ? next.delete(i) : next.add(i)
            return next
        })
    }

    const toggleAll = () => {
        if (selected.size === results.length) setSelected(new Set())
        else setSelected(new Set(results.map((_, i) => i)))
    }

    const handleScrapeSelected = () => {
        const urls = results.filter((_, i) => selected.has(i)).map(r => r.website)
        if (!urls.length) return toast.error('Select at least one company')
        if (onScrapeUrls) onScrapeUrls(urls)
    }

    const handleScrapeAll = () => {
        const urls = results.map(r => r.website)
        if (!urls.length) return toast.error('No companies found')
        if (onScrapeUrls) onScrapeUrls(urls)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Search Input */}
            <div className="card">
                <div className="card-header">
                    <div className="card-title">🌐 Search & Discover Companies</div>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Search Query</label>
                    <input
                        className="input"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="e.g. IT companies in Pune, Software startups in Bangalore..."
                        onKeyDown={e => e.key === 'Enter' && !searching && handleDiscover()}
                        disabled={searching}
                        style={{ fontSize: '1rem' }}
                    />
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Google Pages to Scan: <strong style={{ color: 'var(--accent-primary)' }}>{maxPages}</strong> (~{maxPages * 10} results)</label>
                    <input type="range" min="1" max="10" value={maxPages}
                        onChange={e => setMaxPages(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent-primary)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <span>1 page (~10)</span><span>10 pages (~100)</span>
                    </div>
                </div>

                {/* Quick queries */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {EXAMPLE_QUERIES.map(q => (
                        <button key={q} className="btn btn-ghost btn-sm" style={{ fontSize: '0.72rem' }}
                            onClick={() => setQuery(q)} disabled={searching}>
                            {q}
                        </button>
                    ))}
                </div>

                {/* Progress */}
                {searching && (
                    <div className="alert alert-info" style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                            <span>{progressMsg || 'Searching Google...'}</span>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-lg" style={{ flex: 1 }}
                        onClick={handleDiscover} disabled={searching || !query.trim()}>
                        {searching ? <>
                            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Discovering...
                        </> : '🔍 Discover Companies'}
                    </button>
                    {searching && (
                        <button className="btn btn-danger" onClick={handleStop}>🛑 Stop</button>
                    )}
                </div>
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">
                            🏢 Discovered {results.length} Companies
                            {status === 'complete' && <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--accent-success)', fontWeight: 400 }}>✅ Complete</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-ghost btn-sm" onClick={toggleAll}>
                                {selected.size === results.length ? '☐ Deselect All' : '☑ Select All'}
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={handleScrapeSelected}
                                disabled={selected.size === 0 || searching}>
                                🚀 Scrape Selected ({selected.size})
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={handleScrapeAll} disabled={searching}>
                                🚀 Scrape All
                            </button>
                        </div>
                    </div>

                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>☑</th>
                                    <th>Company</th>
                                    <th>Website</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((r, i) => (
                                    <tr key={i} onClick={() => toggleSelect(i)} style={{ cursor: 'pointer', animation: 'fadeIn 0.3s ease' }}>
                                        <td>
                                            <input type="checkbox" checked={selected.has(i)}
                                                onChange={() => toggleSelect(i)}
                                                style={{ accentColor: 'var(--accent-primary)' }} />
                                        </td>
                                        <td className="bold">{r.name}</td>
                                        <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--accent-info)' }}>
                                            <a href={r.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                                                style={{ color: 'var(--accent-info)' }}>
                                                {r.website?.replace('https://', '').replace('http://', '')}
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="alert alert-info" style={{ marginTop: 12 }}>
                        💡 Select the companies you want, then click "Scrape Selected" to find HR emails & phone numbers from their websites.
                    </div>
                </div>
            )}
        </div>
    )
}
