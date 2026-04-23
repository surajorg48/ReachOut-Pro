import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { resumeApi, campaignsApi } from '../api'

export default function ResumeAnalyzer() {
    const [file, setFile] = useState(null)
    const [position, setPosition] = useState('Software Developer')
    const [parsing, setParsing] = useState(false)
    const [result, setResult] = useState(null)
    const [emailTemplate, setEmailTemplate] = useState('')
    const [activeTab, setActiveTab] = useState('info') // 'info' | 'skills' | 'template' | 'markdown'
    const [dragging, setDragging] = useState(false)
    const [savingCampaign, setSavingCampaign] = useState(false)
    const fileRef = useRef()
    const navigate = useNavigate()

    const handleFileDrop = (e) => {
        e.preventDefault()
        setDragging(false)
        const dropped = e.dataTransfer.files[0]
        if (dropped) handleFileSelect(dropped)
    }

    const handleFileSelect = (f) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if (!allowed.includes(f.type)) return toast.error('Please upload a PDF, JPG, PNG, or WebP file')
        setFile(f)
        setResult(null)
        setEmailTemplate('')
    }

    const handleParse = async () => {
        if (!file) return toast.error('Please upload your resume first')
        setParsing(true)
        setResult(null)
        try {
            const res = await resumeApi.parse(file, position)
            setResult(res.data)
            setEmailTemplate(res.data.emailTemplate)
            toast.success('✅ Resume parsed successfully!')
            setActiveTab('info')
        } catch (e) {
            toast.error(e.message || 'Failed to parse resume')
        } finally {
            setParsing(false)
        }
    }

    const handleRegenerateTemplate = async () => {
        if (!result?.info) return
        try {
            const res = await resumeApi.generateTemplate(result.info, position)
            setEmailTemplate(res.data.template)
            toast.success('Template regenerated!')
        } catch (e) { toast.error(e.message) }
    }

    const handleUseBullet = (bullet) => {
        const plain = bullet.replace(/[*_`]/g, '').replace(/^[💻💼🎓🚀✨]\s*/, '').trim()
        setEmailTemplate(prev => prev + '\n* ' + plain)
        toast.success('Bullet point added to template!')
    }

    const handleSaveAsCampaign = async () => {
        if (!emailTemplate) return toast.error('Generate a template first')
        setSavingCampaign(true)
        try {
            const res = await campaignsApi.create({
                name: `Resume Campaign — ${position} — ${new Date().toLocaleDateString('en-IN')}`,
                subject: `Application for ${position} — ${result?.info?.name || 'Suraj Choudhari'}`,
                template_content: emailTemplate,
                position,
            })
            toast.success('Campaign created from resume!')
            navigate(`/campaigns/${res.data.id}/edit`)
        } catch (e) { toast.error(e.message) }
        finally { setSavingCampaign(false) }
    }

    const info = result?.info

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>📄 Resume Analyzer</h1>
                <p>Upload your resume — AI will extract your details and generate a personalized email template</p>
            </div>

            {/* Upload Section */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                    <div className="card-title">📤 Upload Resume</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supports PDF, JPG, PNG, WebP (max 20MB)</span>
                </div>

                {/* Drop Zone */}
                <div
                    className={`drop-zone${dragging ? ' dragging' : ''}`}
                    style={{ marginBottom: 16, padding: '40px 24px' }}
                    onClick={() => fileRef.current.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleFileDrop}
                >
                    <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
                        onChange={e => handleFileSelect(e.target.files[0])} />
                    {file ? (
                        <div>
                            <span className="drop-icon">✅</span>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{file.name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>
                                {(file.size / 1024).toFixed(1)} KB • {file.type.includes('pdf') ? 'PDF' : 'Image'}
                            </div>
                            <div style={{ color: 'var(--accent-primary)', fontSize: '0.78rem', marginTop: 8 }}>Click to change file</div>
                        </div>
                    ) : (
                        <div>
                            <span className="drop-icon">📎</span>
                            <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>Drop your resume here or click to browse</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 6 }}>PDF, JPG, PNG, WebP supported</div>
                        </div>
                    )}
                </div>

                <div className="grid-2" style={{ gap: 14, marginBottom: 16 }}>
                    <div className="form-group">
                        <label className="form-label">Target Position (enhances template)</label>
                        <input className="input" value={position} onChange={e => setPosition(e.target.value)}
                            placeholder="Software Developer, React Developer, Full Stack..." />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleParse} disabled={!file || parsing}>
                            {parsing ? (
                                <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span> Analyzing Resume...</>
                            ) : '🤖 Analyze with AI'}
                        </button>
                    </div>
                </div>

                {parsing && (
                    <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, flexShrink: 0 }}></span>
                        <span>Sending resume to AI layout parser... This may take 15–30 seconds depending on file size.</span>
                    </div>
                )}
            </div>

            {/* Results Section */}
            {result && (
                <>
                    {/* Quick Bullets — Suggested points from resume */}
                    {info?.suggestedBullets?.length > 0 && (
                        <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(108, 99, 255, 0.4)', background: 'rgba(108,99,255,0.05)' }}>
                            <div className="card-header">
                                <div className="card-title">✨ Suggested Points from Your Resume</div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>Click any point to add it to your email template</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {info.suggestedBullets.map((bullet, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
                                        background: 'rgba(108,99,255,0.08)', borderRadius: 'var(--radius-sm)',
                                        border: '1px solid rgba(108,99,255,0.2)', cursor: 'pointer', transition: 'all 0.15s'
                                    }}
                                        onClick={() => handleUseBullet(bullet)}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(108,99,255,0.15)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(108,99,255,0.08)'}
                                    >
                                        <span style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.9rem', marginTop: 1 }}>+</span>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{bullet}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tabs: Info / Skills / Template / Raw Markdown */}
                    <div className="card">
                        <div className="tabs" style={{ marginBottom: 0 }}>
                            {[
                                { key: 'info', label: '👤 Profile Info' },
                                { key: 'skills', label: '💻 Skills & Experience' },
                                { key: 'template', label: '✉️ Generated Template' },
                                { key: 'markdown', label: '📝 Raw Markdown' },
                            ].map(t => (
                                <div key={t.key} className={`tab${activeTab === t.key ? ' active' : ''}`} onClick={() => setActiveTab(t.key)}>
                                    {t.label}
                                </div>
                            ))}
                        </div>
                        <div className="divider" />

                        {/* Profile Info Tab */}
                        {activeTab === 'info' && (
                            <div>
                                <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
                                    {[
                                        { label: 'Full Name', value: info.name, icon: '👤' },
                                        { label: 'Email', value: info.email, icon: '📧' },
                                        { label: 'Phone', value: info.phone, icon: '📞' },
                                        { label: 'LinkedIn', value: info.linkedin, icon: '🔗' },
                                        { label: 'GitHub', value: info.github, icon: '💻' },
                                    ].map(field => (
                                        <div key={field.label} style={{ padding: '12px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{field.icon} {field.label}</div>
                                            <div style={{ fontSize: '0.875rem', color: field.value ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: field.value ? 600 : 400 }}>
                                                {field.value || 'Not detected'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {info.summary && (
                                    <div style={{ padding: 14, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>📋 Summary / Objective</div>
                                        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{info.summary}</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Skills & Experience Tab */}
                        {activeTab === 'skills' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {/* Skills */}
                                {info.skills.length > 0 && (
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 10, color: 'var(--text-primary)' }}>💻 Technical Skills ({info.skills.length} detected)</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {info.skills.map((s, i) => (
                                                <span key={i} style={{ padding: '4px 12px', background: 'rgba(108,99,255,0.12)', borderRadius: 999, border: '1px solid rgba(108,99,255,0.3)', fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Experience */}
                                {info.experience.length > 0 && (
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 10, color: 'var(--text-primary)' }}>💼 Work Experience Highlights</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {info.experience.map((e, i) => (
                                                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                                    <span style={{ color: 'var(--accent-success)', fontSize: '0.8rem', marginTop: 1 }}>▸</span>
                                                    <span style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{e}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Education */}
                                {info.education.length > 0 && (
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 10, color: 'var(--text-primary)' }}>🎓 Education</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {info.education.map((e, i) => (
                                                <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                                                    {e}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Projects */}
                                {info.projects.length > 0 && (
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 10, color: 'var(--text-primary)' }}>🚀 Projects</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {info.projects.map((p, i) => (
                                                <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                                                    {p}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Generated Template Tab */}
                        {activeTab === 'template' && (
                            <div>
                                <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                                    <button className="btn btn-ghost btn-sm" onClick={handleRegenerateTemplate}>🔄 Regenerate</button>
                                    <button className="btn btn-success btn-sm" onClick={handleSaveAsCampaign} disabled={savingCampaign}>
                                        {savingCampaign ? 'Creating...' : '✅ Save as Campaign'}
                                    </button>
                                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/campaigns/new')}>
                                        📤 Open Campaign Editor
                                    </button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(emailTemplate); toast.success('Copied!') }}>
                                        📋 Copy
                                    </button>
                                </div>

                                <div className="alert alert-info" style={{ marginBottom: 14 }}>
                                    ✨ This template was auto-generated from your resume. Edit it below, then <strong>Save as Campaign</strong> to start sending.
                                </div>

                                <div className="grid-2" style={{ gap: 16 }}>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>✏️ EDIT TEMPLATE</div>
                                        <textarea className="textarea mono" style={{ minHeight: 400, fontSize: '0.79rem' }}
                                            value={emailTemplate} onChange={e => setEmailTemplate(e.target.value)} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>👁️ PREVIEW</div>
                                        <div className="markdown-preview" style={{
                                            background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)',
                                            padding: 16, border: '1px solid var(--border)', minHeight: 400, fontSize: '0.84rem', lineHeight: 1.7
                                        }}
                                            dangerouslySetInnerHTML={{
                                                __html: '<p>' + emailTemplate
                                                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                                    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
                                                    .replace(/^---$/gm, '<hr/>')
                                                    .replace(/^\*\s(.+)$/gm, '<li>$1</li>')
                                                    .replace(/\n\n/g, '</p><p>')
                                                    .replace(/\{\{[^}]+\}\}/g, m => `<span style="color:var(--accent-primary);font-style:italic">${m}</span>`)
                                                    + '</p>'
                                            }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Raw Markdown Tab */}
                        {activeTab === 'markdown' && (
                            <div>
                                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                                    <div className="badge badge-sent">✅ Extracted by AI</div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{result.markdown.length} characters extracted</span>
                                </div>
                                <pre style={{
                                    background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)', padding: 16,
                                    fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace',
                                    overflow: 'auto', maxHeight: 500, border: '1px solid var(--border)', lineHeight: 1.6, whiteSpace: 'pre-wrap'
                                }}>
                                    {result.markdown}
                                </pre>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* How it works — shown before any parse */}
            {!result && !parsing && (
                <div className="card" style={{ borderStyle: 'dashed' }}>
                    <div className="card-title" style={{ marginBottom: 16 }}>🤖 How Resume Analyzer Works</div>
                    <div className="grid-3" style={{ gap: 14 }}>
                        {[
                            { step: '1', icon: '📤', title: 'Upload Resume', desc: 'Upload your resume as PDF, JPG, or PNG. Up to 20MB.' },
                            { step: '2', icon: '🤖', title: 'AI Parses It', desc: 'Our AI layout parser extracts all text, skills, experience, and education from your resume.' },
                            { step: '3', icon: '✨', title: 'Get Suggestions', desc: 'Review extracted bullet points — click any to add to your email template.' },
                            { step: '4', icon: '✉️', title: 'Custom Template', desc: 'A professional email template is auto-generated using your resume details.' },
                            { step: '5', icon: '🚀', title: 'Save & Send', desc: 'Save as a Campaign and send to all HR contacts with one click.' },
                        ].map(s => (
                            <div key={s.step} style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{s.icon}</div>
                                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 4 }}>Step {s.step}: {s.title}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
