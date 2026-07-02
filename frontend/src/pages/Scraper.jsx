import { useEffect, useState, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { scraperApi } from '../api'
import { DownloadIcon, UploadIcon, RefreshIcon, SendIcon, ScraperIcon, CheckIcon, AlertIcon } from '../components/Icons'

const StopIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    </svg>
)
const PauseIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <line x1="6" y1="4" x2="6" y2="20"/><line x1="18" y1="4" x2="18" y2="20"/>
    </svg>
)
const PlayIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
)
const ListIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
)

const CONCURRENCY_OPTIONS = [1, 2, 3, 4, 6, 8]

function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '—'
    if (seconds < 60) return `${seconds}s`
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s}s`
}

function EmailPickerPopup({ result, sessionId, onClose, onPicked }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12,
                padding: 24, minWidth: 360, maxWidth: 480,
            }} onClick={e => e.stopPropagation()}>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                    📧 Select Best Email
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                    {result.companyName} — click to set as best email
                </div>
                {result.emails.map((e, i) => (
                    <div key={e.email}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', marginBottom: 6, borderRadius: 8, cursor: 'pointer',
                            background: (result.selectedBestEmail || result.emails[0]?.email) === e.email
                                ? 'rgba(99,102,241,0.18)' : 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            transition: 'background 0.15s',
                        }}
                        onClick={async () => {
                            await scraperApi.updateBestEmail(sessionId, result.url, e.email).catch(() => { })
                            onPicked(result.url, e.email)
                            onClose()
                            toast.success(`Best email updated to ${e.email}`)
                        }}>
                        <span style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--accent-info)', flex: 1 }}>{e.email}</span>
                        <span className="badge badge-pending" style={{ fontSize: '0.65rem' }}>score: {e.score}</span>
                        {i === 0 && !result.selectedBestEmail && <span className="badge badge-sent" style={{ fontSize: '0.65rem' }}>default</span>}
                        {result.selectedBestEmail === e.email && <span className="badge badge-sent" style={{ fontSize: '0.65rem' }}>✓ selected</span>}
                    </div>
                ))}
                <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>Close</button>
            </div>
        </div>
    )
}

export default function Scraper() {
    const [urls, setUrls] = useState('')
    const [concurrency, setConcurrency] = useState(3)

    const handleScrapeUrls = (urlList) => {
        setUrls(urlList.join('\n'))
        toast.success(`Loaded ${urlList.length} company URLs into the scraper!`)
    }
    const [sessionId, setSessionId] = useState(null)
    const [session, setSession] = useState(null) // { status, total, done, results }
    const [remainingSeconds, setRemainingSeconds] = useState(null)
    const [activeScraping, setActiveScraping] = useState([]) // currently running URLs
    const [pickerTarget, setPickerTarget] = useState(null) // result to pick email for
    const eventSourceRef = useRef(null)
    const fileRef = useRef()
    const sessionRef = useRef(null)

    const isRunning = session?.status === 'running'
    const isPaused = session?.status === 'paused'
    const isDone = session?.status === 'complete' || session?.status === 'stopped'

    // ── Recover active session on mount ──────────────────────────────────
    useEffect(() => {
        scraperApi.getSessions().then(r => {
            const active = r.data.find(s => s.status === 'running' || s.status === 'paused')
            if (active) {
                setSessionId(active.sessionId)
                scraperApi.getSession(active.sessionId).then(r2 => {
                    setSession(r2.data)
                    sessionRef.current = r2.data
                })
                toast('Reconnected to active scraping session')
            }
        }).catch(() => { })
    }, [])

    // ── SSE connection ────────────────────────────────────────────────────
    useEffect(() => {
        const es = new EventSource('/api/scraper/stream')
        eventSourceRef.current = es

        es.onmessage = (e) => {
            const data = JSON.parse(e.data)

            if (data.type === 'progress') {
                setActiveScraping(prev => {
                    const next = prev.filter(u => u !== data.url)
                    return [...next, data.url]
                })
                setSession(prev => prev ? { ...prev, status: 'running' } : prev)

            } else if (data.type === 'result') {
                setActiveScraping(prev => prev.filter(u => u !== data.url))
                setRemainingSeconds(data.remainingSeconds ?? null)
                setSession(prev => {
                    if (!prev) return prev
                    const existing = prev.results?.find(r => r.url === data.url)
                    const newResult = { url: data.url, companyName: data.companyName, emails: data.emails || [], phones: data.phones || [], status: data.status, error: data.error }
                    const results = existing
                        ? prev.results.map(r => r.url === data.url ? newResult : r)
                        : [...(prev.results || []), newResult]
                    return { ...prev, done: data.done, total: data.total, results }
                })

            } else if (data.type === 'done') {
                setActiveScraping([])
                setRemainingSeconds(0)
                setSession(prev => prev ? { ...prev, status: data.status || 'complete', done: data.done } : prev)
                if (data.status !== 'stopped') {
                    toast.success(`✅ Done! Found emails for ${data.results?.filter(r => r.emails?.length > 0).length || 0} companies.`)
                }

            } else if (data.type === 'paused') {
                setSession(prev => prev ? { ...prev, status: 'paused' } : prev)
                toast('⏸ Scraping paused', { icon: '⏸️' })

            } else if (data.type === 'resumed') {
                setSession(prev => prev ? { ...prev, status: 'running' } : prev)
                toast('▶️ Scraping resumed')

            } else if (data.type === 'stopped') {
                setActiveScraping([])
                setSession(prev => prev ? { ...prev, status: 'stopped' } : prev)
                toast('🛑 Scraping stopped')
            }
        }

        return () => es.close()
    }, [])

    // ── Handlers ─────────────────────────────────────────────────────────
    const handleStart = async () => {
        const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean)
        if (!urlList.length) return toast.error('Enter at least one website URL')
        const newSession = { status: 'running', total: urlList.length, done: 0, results: [], startTime: Date.now() }
        setSession(newSession)
        setActiveScraping([])
        setRemainingSeconds(null)
        try {
            const res = await scraperApi.run(urlList, concurrency)
            setSessionId(res.data.sessionId)
            toast.success(`🚀 Scraping ${urlList.length} sites with ${concurrency} workers`)
        } catch (e) {
            toast.error(e.message)
            setSession(null)
        }
    }

    const handleStop = async () => {
        if (!sessionId) return
        await scraperApi.stop(sessionId).catch(() => { })
    }

    const handlePause = async () => {
        if (!sessionId) return
        await scraperApi.pause(sessionId).catch(() => { })
    }

    const handleResume = async () => {
        if (!sessionId) return
        await scraperApi.resume(sessionId).catch(() => { })
    }

    const handleNewScrape = () => {
        setSession(null)
        setSessionId(null)
        setActiveScraping([])
        setRemainingSeconds(null)
        setUrls('')
    }

    const handleFileImport = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        try {
            const res = await scraperApi.importUrls(file)
            setUrls(res.data.urls.join('\n'))
            toast.success(`📂 ${res.data.count} URLs loaded`)
        } catch (e) { toast.error(e.message) }
        e.target.value = ''
    }

    const handlePickEmail = useCallback((url, newBest) => {
        setSession(prev => {
            if (!prev) return prev
            return {
                ...prev,
                results: prev.results.map(r => r.url === url ? { ...r, selectedBestEmail: newBest } : r),
            }
        })
    }, [])

    const pct = session ? Math.round((session.done / session.total) * 100) : 0

    const predefinedUrls = [
        'https://www.tcs.com', 'https://www.infosys.com', 'https://www.wipro.com',
        'https://www.hcltech.com', 'https://www.techmahindra.com', 'https://www.mphasis.com',
        'https://www.persistent.com', 'https://www.zensar.com', 'https://www.hexaware.com',
        'https://www.cyient.com', 'https://www.nihilentsolutions.com', 'https://www.mastech.com',
    ]

    return (
        <div className="page-container">
            {pickerTarget && (
                <EmailPickerPopup
                    result={pickerTarget}
                    sessionId={sessionId}
                    onClose={() => setPickerTarget(null)}
                    onPicked={handlePickEmail}
                />
            )}

            <div className="page-header">
                <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                    <ScraperIcon size={22} /> Web Scraper
                </h1>
                <p style={{ marginTop: 4 }}>Discover HR emails &amp; phones from company websites — parallel scraping with real-time results</p>
            </div>

            {/* URL Scraper Panel */}
            {(!session || isDone) && (
                <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
                        {/* Input Panel */}
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title">Enter Company Websites</div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()} style={{ gap: 7 }}>
                                        <UploadIcon size={13} /> Import Excel/CSV
                                    </button>
                                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileImport} />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">Website URLs (one per line)</label>
                                <textarea className="textarea" style={{ minHeight: 180, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}
                                    value={urls} onChange={e => setUrls(e.target.value)}
                                    placeholder={'https://company1.com\nhttps://company2.com\ncompany3.com'} />
                            </div>

                            {/* Concurrency */}
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">Parallel Workers: <strong style={{ color: 'var(--accent-primary)' }}>{concurrency}</strong></label>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {CONCURRENCY_OPTIONS.map(n => (
                                        <button key={n}
                                            className={`btn btn-sm ${concurrency === n ? 'btn-primary' : 'btn-ghost'}`}
                                            onClick={() => setConcurrency(n)}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                    Higher = faster but may trigger rate limits. Recommended: 2–4.
                                </div>
                            </div>

                            <div className="alert alert-info" style={{ marginBottom: 12 }}>
                                💡 Scraper visits /contact, /careers, /about + uses Puppeteer for JS-heavy sites.
                            </div>

                            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleStart}>
                                <SendIcon size={16} /> Start Scraping {urls.split('\n').filter(u => u.trim()).length > 0 ? `(${urls.split('\n').filter(u => u.trim()).length} sites)` : ''}
                            </button>
                        </div>

                        {/* Quick Load */}
                        <div className="card">
                            <div className="card-header"><div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ListIcon size={15} /> Quick Load — Top IT Companies</div></div>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>Click to add individual companies or load all at once</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                                {predefinedUrls.map(u => (
                                    <button key={u} className="btn btn-ghost btn-sm" style={{ fontSize: '0.72rem' }}
                                        onClick={() => setUrls(prev => (prev ? prev + '\n' : '') + u)}>
                                        + {u.replace('https://www.', '').replace('.com', '')}
                                    </button>
                                ))}
                            </div>
                            <div className="divider" />
                            <button className="btn btn-ghost" style={{ width: '100%', marginBottom: 12 }} onClick={() => setUrls(predefinedUrls.join('\n'))}>
                                Load All ({predefinedUrls.length} companies)
                            </button>
                            <div className="alert alert-warning">
                                ⚠️ Scraping is subject to each site's robots.txt. Random delays are added between requests.
                            </div>

                            {isDone && session?.results?.length > 0 && (
                                <div style={{ marginTop: 12 }}>
                                    <div className="divider" />
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 8 }}>Last session results:</div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-ghost" style={{ flex: 1, gap: 7 }} onClick={() => scraperApi.exportExcel(sessionId)}>
                                            <DownloadIcon size={14} /> Export Excel
                                        </button>
                                        <button className="btn btn-ghost" style={{ flex: 1, gap: 7 }} onClick={handleNewScrape}>
                                            <RefreshIcon size={14} /> New Scrape
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
            )}

            {/* Active Session Status Bar */}
            {session && !isDone && (
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {isRunning && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, flexShrink: 0 }} />}
                            {isPaused && <PauseIcon size={18} />}
                            <div>
                                <div className="card-title" style={{ marginBottom: 2 }}>
                                    {isRunning ? 'Scraping in Progress' : isPaused ? 'Scraping Paused' : 'Scraping'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {session.done} / {session.total} done
                                    {remainingSeconds > 0 && ` · ~${formatTime(remainingSeconds)} remaining`}
                                    · {concurrency} parallel workers
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {isRunning && (
                                <button className="btn btn-ghost btn-sm" onClick={handlePause} style={{ gap: 6 }}><PauseIcon /> Pause</button>
                            )}
                            {isPaused && (
                                <button className="btn btn-primary btn-sm" onClick={handleResume} style={{ gap: 6 }}><PlayIcon /> Resume</button>
                            )}
                            <button className="btn btn-danger btn-sm" onClick={handleStop} style={{ gap: 6 }}><StopIcon /> Stop</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => scraperApi.exportExcel(sessionId)} disabled={!session.results?.length} style={{ gap: 6 }}>
                                <DownloadIcon size={14} /> Export
                            </button>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginBottom: 12 }}>
                        <div className="progress-bar-container">
                            <div className="progress-bar-fill" style={{ width: `${pct}%`, transition: 'width 0.4s' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            <span>{pct}% complete</span>
                            <span>{session.results?.filter(r => r.emails?.length > 0).length || 0} with emails</span>
                        </div>
                    </div>

                    {/* Active workers */}
                    {activeScraping.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {activeScraping.map(url => (
                                <span key={url} style={{
                                    fontSize: '0.7rem', padding: '3px 8px', borderRadius: 20,
                                    background: 'rgba(99,102,241,0.12)', color: 'var(--accent-primary)',
                                    border: '1px solid rgba(99,102,241,0.3)', fontFamily: 'monospace',
                                    display: 'flex', alignItems: 'center', gap: 4,
                                }}>
                                    <span className="spinner" style={{ width: 8, height: 8, borderWidth: 1.5 }} />
                                    {url.replace('https://', '').replace('http://', '').split('/')[0]}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Results Table */}
            {session?.results?.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">
                            Results — {session.results.length} processed
                            {isDone && <span style={{ marginLeft: 8, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                · session {isDone && session.status === 'stopped' ? '(stopped)' : '(complete)'}
                            </span>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <CheckIcon size={13} /> {session.results.filter(r => r.emails?.length > 0).length} with emails
                            </span>
                            {sessionId && (
                                <button className="btn btn-ghost btn-sm" onClick={() => scraperApi.exportExcel(sessionId)} style={{ gap: 6 }}>
                                    <DownloadIcon size={13} /> Export Excel
                                </button>
                            )}
                            {isDone && (
                                <button className="btn btn-ghost btn-sm" onClick={handleNewScrape} style={{ gap: 6 }}><RefreshIcon size={13} /> New Scrape</button>
                            )}
                        </div>
                    </div>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Company / URL</th>
                                    <th>Best Email</th>
                                    <th>Phone</th>
                                    <th>Emails Found</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {session.results.map((r, i) => {
                                    const bestEmail = r.selectedBestEmail || r.emails?.[0]?.email
                                    const emailCount = r.emails?.length || 0
                                    const hasMultiple = emailCount > 1
                                    return (
                                        <tr key={i} style={{ animation: 'fadeIn 0.3s ease' }}>
                                            <td>
                                                <div className="bold">{r.companyName || r.url}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.url}</div>
                                            </td>
                                            <td className="mono" style={{ fontSize: '0.8rem' }}>
                                                {bestEmail ? (
                                                    <span style={{ color: 'var(--accent-info)' }}>{bestEmail}</span>
                                                ) : r.error ? (
                                                    <span style={{ color: 'var(--accent-danger)', fontSize: '0.72rem' }}>{r.error.slice(0, 40)}</span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                                                )}
                                            </td>
                                            <td className="mono" style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                                                {r.phones?.[0] || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                            </td>
                                            <td>
                                                <button
                                                    disabled={emailCount === 0}
                                                    onClick={() => emailCount > 0 && setPickerTarget(r)}
                                                    style={{
                                                        background: 'none', border: 'none', cursor: emailCount > 0 ? 'pointer' : 'default',
                                                        padding: 0,
                                                    }}>
                                                    <span className={`badge ${emailCount > 0 ? (hasMultiple ? 'badge-pending' : 'badge-sent') : 'badge-failed'}`}
                                                        style={{ cursor: emailCount > 0 ? 'pointer' : 'default' }}
                                                        title={hasMultiple ? 'Click to pick best email' : ''}>
                                                        {emailCount > 0 ? `${emailCount} email${emailCount > 1 ? 's' : ''} found${hasMultiple ? ' ▾' : ''}` : '—'}
                                                    </span>
                                                </button>
                                            </td>
                                            <td>
                                                {r.status === 'done' ? (
                                                    <span className={`badge ${emailCount > 0 ? 'badge-sent' : 'badge-pending'}`}>
                                                        {emailCount > 0 ? 'Found' : 'None'}
                                                    </span>
                                                ) : r.status === 'error' ? (
                                                    <span className="badge badge-failed">Error</span>
                                                ) : r.status === 'cancelled' ? (
                                                    <span className="badge badge-pending">Stopped</span>
                                                ) : (
                                                    <span className="badge badge-pending">Pending</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckIcon size={13} style={{ color: 'var(--accent-success)' }} /> All discovered emails &amp; phones are saved to the Companies database automatically.
                    </p>
                </div>
            )}
        </div>
    )
}
