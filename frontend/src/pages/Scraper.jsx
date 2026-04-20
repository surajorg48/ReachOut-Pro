import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { scraperApi } from '../api'

export default function Scraper() {
    const [urls, setUrls] = useState('')
    const [scraping, setScraping] = useState(false)
    const [results, setResults] = useState([])
    const [progress, setProgress] = useState(null)
    const [sessionId, setSessionId] = useState(null)
    const eventSourceRef = useRef(null)
    const fileRef = useRef()

    useEffect(() => {
        // Connect SSE
        const es = new EventSource('/api/scraper/stream')
        eventSourceRef.current = es
        es.onmessage = (e) => {
            const data = JSON.parse(e.data)
            if (data.type === 'progress') {
                setProgress({ index: data.index, total: data.total, url: data.url })
            } else if (data.type === 'result') {
                setResults(prev => [...prev, { url: data.url, companyName: data.companyName, emails: data.emails, status: data.status, error: data.error }])
            } else if (data.type === 'done') {
                setScraping(false)
                setProgress(null)
                toast.success(`✅ Scraping complete! Found emails for ${data.results?.filter(r => r.emails?.length > 0).length || 0} companies.`)
            } else if (data.type === 'error') {
                toast.error(`Scraper error: ${data.message}`)
                setScraping(false)
                setProgress(null)
            }
        }
        return () => es.close()
    }, [])

    const handleStart = async () => {
        const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean)
        if (!urlList.length) return toast.error('Enter at least one website URL')
        setScraping(true)
        setResults([])
        try {
            const res = await scraperApi.run(urlList)
            setSessionId(res.data.sessionId)
            toast.success(`🔍 Scraping ${urlList.length} sites...`)
        } catch (e) {
            toast.error(e.message)
            setScraping(false)
        }
    }

    const handleFileImport = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        try {
            const res = await scraperApi.importUrls(file)
            setUrls(res.data.urls.join('\n'))
            toast.success(`📂 ${res.data.count} URLs loaded from file`)
        } catch (e) { toast.error(e.message) }
        e.target.value = ''
    }

    const pct = progress ? Math.round((progress.index / progress.total) * 100) : 0

    const predefinedUrls = [
        'https://www.tcs.com', 'https://www.infosys.com', 'https://www.wipro.com',
        'https://www.hcltech.com', 'https://www.techmahindra.com', 'https://www.mphasis.com',
        'https://www.persistent.com', 'https://www.zensar.com', 'https://www.hexaware.com',
        'https://www.cyient.com', 'https://www.nihilentsolutions.com', 'https://www.mastech.com',
    ]

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>🔍 Web Scraper</h1>
                <p>Discover HR emails from IT company websites automatically</p>
            </div>

            <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
                {/* Input Panel */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Enter Company Websites</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()}>📂 Import Excel/CSV</button>
                            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileImport} />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 12 }}>
                        <label className="form-label">Website URLs (one per line)</label>
                        <textarea className="textarea" style={{ minHeight: 200, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}
                            value={urls} onChange={e => setUrls(e.target.value)}
                            placeholder="https://company1.com&#10;https://company2.com&#10;company3.com" />
                    </div>

                    <div className="alert alert-info" style={{ marginBottom: 12 }}>
                        💡 Tip: The scraper visits /contact, /careers, /about pages to find HR emails automatically.
                    </div>

                    {progress && (
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    Scraping: <span className="mono">{progress.url?.replace('https://', '')}</span>
                                </span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{progress.index}/{progress.total}</span>
                            </div>
                            <div className="progress-bar-container">
                                <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={handleStart} disabled={scraping}>
                            {scraping ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span> Scraping...</> : '🚀 Start Scraping'}
                        </button>
                        {scraping && <button className="btn btn-ghost" onClick={() => { setScraping(false); setProgress(null) }}>Stop</button>}
                    </div>
                </div>

                {/* Quick Load */}
                <div className="card">
                    <div className="card-header"><div className="card-title">⚡ Quick Load — Top IT Companies</div></div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>Click to load pre-built list of top Indian IT companies</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                        {predefinedUrls.map(u => (
                            <button key={u} className="btn btn-ghost btn-sm" style={{ fontSize: '0.72rem' }}
                                onClick={() => setUrls(prev => (prev ? prev + '\n' : '') + u)}>
                                + {u.replace('https://www.', '').replace('.com', '')}
                            </button>
                        ))}
                    </div>
                    <div className="divider" />
                    <button className="btn btn-ghost" style={{ width: '100%' }}
                        onClick={() => setUrls(predefinedUrls.join('\n'))}>
                        📋 Load All ({predefinedUrls.length} companies)
                    </button>
                    <div className="divider" />
                    <div className="alert alert-warning">
                        ⚠️ Scraping is subject to each site's robots.txt. The scraper adds random delays and respects rate limits.
                    </div>
                </div>
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">📊 Scraping Results — {results.length} sites processed</div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent-success)' }}>
                            ✅ {results.filter(r => r.emails?.length > 0).length} with emails found
                        </span>
                    </div>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Company / URL</th>
                                    <th>Emails Found</th>
                                    <th>Best Email</th>
                                    <th>Score</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((r, i) => (
                                    <tr key={i}>
                                        <td className="bold">
                                            <div>{r.companyName || r.url}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.url}</div>
                                        </td>
                                        <td>{r.emails?.length || 0}</td>
                                        <td className="mono" style={{ color: 'var(--accent-info)', fontSize: '0.8rem' }}>
                                            {r.emails?.[0]?.email || (r.error ? <span style={{ color: 'var(--accent-danger)' }}>{r.error.slice(0, 40)}</span> : '—')}
                                        </td>
                                        <td>{r.emails?.[0]?.score || '—'}</td>
                                        <td>
                                            <span className={`badge ${r.emails?.length ? 'badge-sent' : r.status === 'error' ? 'badge-failed' : 'badge-pending'}`}>
                                                {r.emails?.length ? `✅ ${r.emails.length} found` : r.status === 'error' ? '❌ Error' : '⚠️ None'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 12 }}>
                        ✅ All discovered emails are automatically saved to the Companies database.
                    </p>
                </div>
            )}
        </div>
    )
}
