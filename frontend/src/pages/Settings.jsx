import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { settingsApi } from '../api'

export default function Settings({ onGmailChange }) {
    const [settings, setSettings] = useState({
        sender_email: 'surajorg47@gmail.com',
        test_email: 'surajorg48@gmail.com',
        send_delay_ms: '15000',
        resume_path: 'C:\\Users\\Admin\\OneDrive\\Desktop\\code\\scrapper\\Suraj_Choudhari_Resume.pdf',
        applicant_name: 'Suraj Choudhari',
        applicant_phone: '',
        applicant_linkedin: '',
        applicant_github: '',
        gmailConnected: false,
        credentialsUploaded: false,
    })
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const credRef = useRef()
    const [authUrl, setAuthUrl] = useState(null)

    const load = () => {
        settingsApi.get().then(r => {
            setSettings(r.data)
            if (onGmailChange) onGmailChange(r.data.gmailConnected)
        }).catch(() => { }).finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            await settingsApi.update({
                sender_email: settings.sender_email,
                test_email: settings.test_email,
                send_delay_ms: settings.send_delay_ms,
                resume_path: settings.resume_path,
                applicant_name: settings.applicant_name,
                applicant_phone: settings.applicant_phone,
                applicant_linkedin: settings.applicant_linkedin,
                applicant_github: settings.applicant_github,
            })
            toast.success('Settings saved!')
        } catch (e) { toast.error(e.message) }
        finally { setSaving(false) }
    }

    const handleConnectGmail = async () => {
        try {
            const res = await settingsApi.getAuthUrl()
            setAuthUrl(res.data.url)
            window.open(res.data.url, '_blank', 'width=500,height=600')

            // Poll for connection
            const poll = setInterval(() => {
                settingsApi.getGmailStatus().then(r => {
                    if (r.data.gmailConnected) {
                        clearInterval(poll)
                        setSettings(prev => ({ ...prev, gmailConnected: true }))
                        if (onGmailChange) onGmailChange(true)
                        toast.success('✅ Gmail connected successfully!')
                    }
                })
            }, 3000)
            setTimeout(() => clearInterval(poll), 120000) // Stop polling after 2min
        } catch (e) { toast.error(e.message + ' — Make sure credentials.json is uploaded first.') }
    }

    const handleDisconnect = async () => {
        if (!confirm('Disconnect Gmail? You will need to re-authenticate to send emails.')) return
        await settingsApi.disconnect().catch(e => toast.error(e.message))
        setSettings(prev => ({ ...prev, gmailConnected: false }))
        if (onGmailChange) onGmailChange(false)
        toast.success('Gmail disconnected')
    }

    const handleUploadCreds = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        try {
            await settingsApi.uploadCredentials(file)
            setSettings(prev => ({ ...prev, credentialsUploaded: true }))
            toast.success('credentials.json uploaded! Now click "Connect Gmail".')
        } catch (e) { toast.error(e.message) }
        e.target.value = ''
    }

    const delaySeconds = Math.round(parseInt(settings.send_delay_ms || 15000) / 1000)

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>⚙️ Settings</h1>
                <p>Configure your account, Gmail connection, and email preferences.</p>
            </div>

            {loading ? <div className="empty-state"><div className="spinner"></div></div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>

                    {/* Gmail Connection */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">📧 Gmail Connection</div>
                            <span className={`badge ${settings.gmailConnected ? 'badge-sent' : 'badge-failed'}`}>
                                {settings.gmailConnected ? '🟢 Connected' : '🔴 Disconnected'}
                            </span>
                        </div>

                        {!settings.gmailConnected && (
                            <div className="alert alert-info" style={{ marginBottom: 16 }}>
                                <div>
                                    <strong>Step 1:</strong> Upload your <code>credentials.json</code> from Google Cloud Console.<br />
                                    <strong>Step 2:</strong> Click "Connect Gmail" to authorize via OAuth2.
                                    <br /><br />
                                    📖 <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer">Open Google Cloud Console →</a>
                                    &nbsp;(APIs & Services → Credentials → OAuth 2.0 Client → Desktop App → Download JSON)
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {!settings.gmailConnected && (
                                <>
                                    <button className="btn btn-ghost" onClick={() => credRef.current.click()}>
                                        📂 {settings.credentialsUploaded ? '✅ credentials.json uploaded' : 'Upload credentials.json'}
                                    </button>
                                    <input ref={credRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleUploadCreds} />
                                    <button className="btn btn-primary" onClick={handleConnectGmail} disabled={!settings.credentialsUploaded}>
                                        🔗 Connect Gmail
                                    </button>
                                </>
                            )}
                            {settings.gmailConnected && (
                                <button className="btn btn-danger" onClick={handleDisconnect}>🔌 Disconnect Gmail</button>
                            )}
                        </div>
                    </div>

                    {/* Personal Info */}
                    <div className="card">
                        <div className="card-header"><div className="card-title">👤 Your Information</div></div>
                        <div className="grid-2" style={{ gap: 12 }}>
                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <input className="input" value={settings.applicant_name} onChange={e => setSettings({ ...settings, applicant_name: e.target.value })} placeholder="Suraj Choudhari" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone Number</label>
                                <input className="input" value={settings.applicant_phone} onChange={e => setSettings({ ...settings, applicant_phone: e.target.value })} placeholder="+91 XXXXXXXXXX" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">LinkedIn URL</label>
                                <input className="input" value={settings.applicant_linkedin} onChange={e => setSettings({ ...settings, applicant_linkedin: e.target.value })} placeholder="https://linkedin.com/in/..." />
                            </div>
                            <div className="form-group">
                                <label className="form-label">GitHub URL</label>
                                <input className="input" value={settings.applicant_github} onChange={e => setSettings({ ...settings, applicant_github: e.target.value })} placeholder="https://github.com/..." />
                            </div>
                        </div>
                    </div>

                    {/* Email Settings */}
                    <div className="card">
                        <div className="card-header"><div className="card-title">📮 Email Settings</div></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div className="form-group">
                                <label className="form-label">Sender Email</label>
                                <input className="input" value={settings.sender_email} onChange={e => setSettings({ ...settings, sender_email: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Test Email Address</label>
                                <input className="input" value={settings.test_email} onChange={e => setSettings({ ...settings, test_email: e.target.value })} />
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Test emails are always sent here before real sends.</div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Default Resume Path</label>
                                <input className="input mono" value={settings.resume_path} onChange={e => setSettings({ ...settings, resume_path: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Delay Between Emails: <strong style={{ color: 'var(--accent-primary)' }}>{delaySeconds}s</strong></label>
                                <input type="range" min="5" max="60" value={delaySeconds}
                                    onChange={e => setSettings({ ...settings, send_delay_ms: String(parseInt(e.target.value) * 1000) })}
                                    style={{ width: '100%', accentColor: 'var(--accent-primary)' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    <span>5s (fast, risky)</span>
                                    <span>60s (slow, safe)</span>
                                </div>
                                <div className="alert alert-warning" style={{ marginTop: 8 }}>
                                    ⚠️ Recommended: 15–30s to avoid Gmail spam flags.
                                </div>
                            </div>
                        </div>
                    </div>

                    <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : '💾 Save Settings'}
                    </button>
                </div>
            )}
        </div>
    )
}
