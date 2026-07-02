import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { settingsApi } from '../api'
import { SettingsIcon, MailIcon, InfoIcon, PlusIcon, LinkIcon, TrashIcon, DisconnectIcon, CheckIcon, AlertIcon, ZapIcon, DownloadIcon, XIcon } from '../components/Icons'

const BookIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
)
const UserIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
)
const SendDelayIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
)
const SaveIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
    </svg>
)

// ── Setup Guide Modal ────────────────────────────────────────────────────────
function SetupGuideModal({ onClose }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', maxWidth: 680, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: '28px 32px', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ margin: 0, fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: 10 }}><BookIcon size={22} /> Gmail OAuth2 Setup Guide</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ gap: 6 }}><XIcon size={14} /> Close</button>
                </div>

                <div style={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                    <div className="alert alert-info" style={{ marginBottom: 16 }}>
                        This guide walks you through creating a Google Cloud OAuth2 credential so ReachOut Pro can send emails from your Gmail account securely.
                    </div>

                    <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Step 1: Create a Google Cloud Project</h3>
                    <ol style={{ paddingLeft: 20, marginBottom: 16 }}>
                        <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-info)' }}>Google Cloud Console</a></li>
                        <li>Click the project dropdown at top → <strong>"New Project"</strong></li>
                        <li>Name it anything (e.g., "ReachOut Pro") → Click <strong>"Create"</strong></li>
                        <li>Select the new project from the dropdown</li>
                    </ol>

                    <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Step 2: Enable Gmail API</h3>
                    <ol style={{ paddingLeft: 20, marginBottom: 16 }}>
                        <li>Go to <strong>APIs & Services → Library</strong></li>
                        <li>Search for <strong>"Gmail API"</strong></li>
                        <li>Click it → Click <strong>"Enable"</strong></li>
                    </ol>

                    <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Step 3: Configure OAuth Consent Screen</h3>
                    <ol style={{ paddingLeft: 20, marginBottom: 16 }}>
                        <li>Go to <strong>APIs & Services → OAuth consent screen</strong></li>
                        <li>Select <strong>"External"</strong> → Click <strong>"Create"</strong></li>
                        <li>Fill in the app name and your email → Save</li>
                        <li>On "Scopes" page, click <strong>"Add or remove scopes"</strong></li>
                        <li>Search for <code>gmail.send</code> and <code>gmail.readonly</code> → Check both → Update</li>
                        <li>On "Test users" page, click <strong>"Add users"</strong></li>
                        <li>Add your Gmail address(es) that will send emails → Save</li>
                    </ol>

                    <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Step 4: Create OAuth2 Credentials</h3>
                    <ol style={{ paddingLeft: 20, marginBottom: 16 }}>
                        <li>Go to <strong>APIs & Services → Credentials</strong></li>
                        <li>Click <strong>"+ Create Credentials"</strong> → <strong>"OAuth client ID"</strong></li>
                        <li>Application type: <strong>"Desktop app"</strong></li>
                        <li>Name it anything → Click <strong>"Create"</strong></li>
                        <li>Click <strong>"Download JSON"</strong> button (⬇️ icon)</li>
                        <li>Save the downloaded <code>credentials.json</code> file</li>
                    </ol>

                    <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Step 5: Add Account in ReachOut Pro</h3>
                    <ol style={{ paddingLeft: 20, marginBottom: 16 }}>
                        <li>In the Gmail section below, click <strong>"+ Add Gmail Account"</strong></li>
                        <li>Enter your Gmail email address</li>
                        <li>Upload the <code>credentials.json</code> you downloaded</li>
                        <li>Click <strong>"Add Account"</strong></li>
                        <li>Click <strong>"🔗 Connect"</strong> on the new account card</li>
                        <li>A popup will open — sign in with your Google account</li>
                        <li>Click <strong>"Allow"</strong> to grant permissions</li>
                        <li>Done! ✅ The popup will close automatically</li>
                    </ol>

                    <div className="alert alert-warning">
                        ⚠️ <strong>Important:</strong> Your Gmail must be added as a "Test user" in the OAuth consent screen (Step 3.7). Otherwise, Google will block the authentication.
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Main Settings Component ──────────────────────────────────────────────────
export default function Settings({ onGmailChange }) {
    const [settings, setSettings] = useState({
        sender_email: '', test_email: '', send_delay_ms: '15000',
        resume_path: '', applicant_name: '', applicant_phone: '',
        applicant_linkedin: '', applicant_github: '',
        gmailConnected: false, credentialsUploaded: false,
    })
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [showGuide, setShowGuide] = useState(false)

    // Multi-account
    const [accounts, setAccounts] = useState([])
    const [activeAccountId, setActiveAccountId] = useState(null)
    const [showAddForm, setShowAddForm] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [newLabel, setNewLabel] = useState('')
    const [newCredFile, setNewCredFile] = useState(null)
    const [addingAccount, setAddingAccount] = useState(false)
    const credRef = useRef()
    const newCredRef = useRef()

    const load = () => {
        settingsApi.get().then(r => {
            setSettings(r.data)
            setAccounts(r.data.gmail_accounts || [])
            setActiveAccountId(r.data.active_account?.id || null)
            if (onGmailChange) onGmailChange(r.data.gmailConnected)
        }).catch(() => {}).finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            await settingsApi.update({
                sender_email: settings.sender_email, test_email: settings.test_email,
                send_delay_ms: settings.send_delay_ms, resume_path: settings.resume_path,
                applicant_name: settings.applicant_name, applicant_phone: settings.applicant_phone,
                applicant_linkedin: settings.applicant_linkedin, applicant_github: settings.applicant_github,
            })
            toast.success('Settings saved!')
        } catch (e) { toast.error(e.message) }
        finally { setSaving(false) }
    }

    // Legacy connect (for backward compat)
    const handleConnectGmail = async () => {
        try {
            const res = await settingsApi.getAuthUrl()
            window.open(res.data.url, '_blank', 'width=500,height=600')
            const onMessage = (event) => {
                if (event.data === 'gmail_connected') {
                    window.removeEventListener('message', onMessage)
                    load(); toast.success('✅ Gmail connected!')
                }
            }
            window.addEventListener('message', onMessage)
            // Backup polling just in case postMessage fails
            const poll = setInterval(() => {
                settingsApi.getGmailStatus().then(r => {
                    if (r.data.gmailConnected) { clearInterval(poll); window.removeEventListener('message', onMessage); load() }
                })
            }, 3000)
            setTimeout(() => { clearInterval(poll); window.removeEventListener('message', onMessage) }, 120000)
        } catch (e) { toast.error(e.message) }
    }

    // Multi-account: connect
    const handleConnectAccount = async (accId) => {
        try {
            const res = await settingsApi.getAccountAuthUrl(accId)
            window.open(res.data.url, '_blank', 'width=500,height=600')
            const onMessage = (event) => {
                if (event.data === 'gmail_connected') {
                    window.removeEventListener('message', onMessage)
                    load(); toast.success('✅ Account connected!')
                }
            }
            window.addEventListener('message', onMessage)
            // Fallback polling for the specific account
            const poll = setInterval(() => {
                settingsApi.getGmailAccounts().then(r => {
                    const acc = r.data.accounts?.find(a => a.id === accId)
                    if (acc && acc.isConnected) { 
                        clearInterval(poll); window.removeEventListener('message', onMessage); load(); toast.success('✅ Account connected!')
                    }
                })
            }, 3000)
            setTimeout(() => { clearInterval(poll); window.removeEventListener('message', onMessage) }, 120000)
        } catch (e) { toast.error(e.message) }
    }

    const handleActivate = async (accId) => {
        try {
            await settingsApi.activateGmailAccount(accId)
            load()
            toast.success('Switched active sending account')
        } catch (e) { toast.error(e.message) }
    }
    const handleDisconnectAccount = async (accId, email) => {
        if (!confirm(`Disconnect ${email}? You can reconnect later without re-uploading credentials.`)) return
        try {
            await settingsApi.disconnectGmailAccount(accId)
            load()
            toast.success('Account disconnected')
        } catch (e) { toast.error(e.message) }
    }

    const handleRemoveAccount = async (accId, email) => {
        if (!confirm(`Remove ${email}? Credentials will be deleted.`)) return
        try { await settingsApi.removeGmailAccount(accId); load(); toast.success('Account removed') }
        catch (e) { toast.error(e.message) }
    }

    const handleAddAccount = async () => {
        if (!newEmail.trim()) return toast.error('Enter email address')
        if (!newCredFile) return toast.error('Upload credentials.json for this account')
        setAddingAccount(true)
        try {
            await settingsApi.addGmailAccount(newEmail.trim(), newLabel.trim() || newEmail.trim(), newCredFile)
            toast.success(`Account ${newEmail} added! Now click "Connect" to authorize.`)
            setNewEmail(''); setNewLabel(''); setNewCredFile(null); setShowAddForm(false)
            load()
        } catch (e) { toast.error(e.message) }
        finally { setAddingAccount(false) }
    }

    const handleDisconnect = async () => {
        if (!confirm('Disconnect Gmail?')) return
        await settingsApi.disconnect().catch(e => toast.error(e.message))
        load()
        toast.success('Gmail disconnected')
    }

    const handleUploadCreds = async (e) => {
        const file = e.target.files[0]; if (!file) return
        try {
            await settingsApi.uploadCredentials(file)
            setSettings(prev => ({ ...prev, credentialsUploaded: true }))
            toast.success('credentials.json uploaded!')
        } catch (e) { toast.error(e.message) }
        e.target.value = ''
    }

    const delaySeconds = Math.round(parseInt(settings.send_delay_ms || 15000) / 1000)

    return (
        <div className="page-container">
            {showGuide && <SetupGuideModal onClose={() => setShowGuide(false)} />}

            <div className="page-header">
                <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                    <SettingsIcon size={22} /> Settings
                </h1>
                <p style={{ marginTop: 4 }}>Configure your accounts, Gmail connections, and email preferences.</p>
            </div>

            {loading ? <div className="empty-state"><div className="spinner"></div></div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 780 }}>

                    {/* Gmail Connection */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <MailIcon size={16} /> Gmail Accounts
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowGuide(true)}
                                    style={{ fontSize: '0.75rem', borderRadius: 20, padding: '3px 12px', gap: 5 }}
                                    title="How to set up Gmail OAuth2">
                                    <InfoIcon size={13} /> Setup Guide
                                </button>
                            </div>
                            <span className={`badge ${settings.gmailConnected ? 'badge-sent' : 'badge-failed'}`} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                                {settings.gmailConnected ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>

                        {/* Account List */}
                        {accounts.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                                {accounts.map(acc => {
                                    const isActive = acc.id === activeAccountId
                                    return (
                                        <div key={acc.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                                            background: isActive ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                                            borderRadius: 'var(--radius-sm)', marginBottom: 8,
                                            border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border)'}`,
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    {acc.email}
                                                    {isActive && <span style={{ fontSize: '0.7rem', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: 4 }}><CheckIcon size={11} /> ACTIVE</span>}
                                                    {acc.isConnected && <span style={{ fontSize: '0.7rem', color: 'var(--accent-info)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} /> CONNECTED</span>}
                                                    {!acc.isConnected && <span style={{ fontSize: '0.7rem', color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertIcon size={11} /> DISCONNECTED</span>}
                                                </div>
                                                {acc.label && acc.label !== acc.email && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{acc.label}</div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                {!isActive && acc.isConnected && (
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleActivate(acc.id)} style={{ gap: 5 }}>
                                                        <ZapIcon size={13} /> Set Active
                                                    </button>
                                                )}
                                                {!acc.isConnected && (
                                                    <button className="btn btn-primary btn-sm" onClick={() => handleConnectAccount(acc.id)} style={{ gap: 5 }}>
                                                        <LinkIcon size={13} /> Connect
                                                    </button>
                                                )}
                                                {acc.isConnected && (
                                                    <button className="btn btn-warning btn-sm" onClick={() => handleDisconnectAccount(acc.id, acc.email)} style={{ gap: 5 }}>
                                                        <DisconnectIcon size={13} /> Disconnect
                                                    </button>
                                                )}
                                                <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleRemoveAccount(acc.id, acc.email)} data-tooltip="Remove account">
                                                    <TrashIcon size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Add Account Form */}
                        {showAddForm ? (
                            <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: 12 }}>
                                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <PlusIcon size={15} /> Add New Gmail Account
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                    <div className="form-group">
                                        <label className="form-label">Email Address *</label>
                                        <input className="input" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="yourname@gmail.com" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Label (optional)</label>
                                        <input className="input" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Work account" />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">credentials.json *</label>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => newCredRef.current.click()} style={{ gap: 6 }}>
                                        <DownloadIcon size={13} /> {newCredFile ? `${newCredFile.name}` : 'Upload credentials.json'}
                                        </button>
                                        <input ref={newCredRef} type="file" accept=".json" style={{ display: 'none' }}
                                            onChange={e => { setNewCredFile(e.target.files[0] || null); e.target.value = '' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-primary" onClick={handleAddAccount} disabled={addingAccount} style={{ gap: 6 }}>
                                        {addingAccount ? 'Adding...' : <><PlusIcon size={14} /> Add Account</>}
                                    </button>
                                    <button className="btn btn-ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
                                    ➕ Add Gmail Account
                                </button>
                                {/* Only use multi-account flow */}
                            </div>
                        )}
                    </div>

                    {/* Personal Info */}
                    <div className="card">
                        <div className="card-header"><div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><UserIcon size={16} /> Your Information</div></div>
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
                        <div className="card-header"><div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MailIcon size={16} /> Email Settings</div></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div className="form-group">
                                <label className="form-label">Sender Email (auto-set from active Gmail account)</label>
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
                                    <span>5s (fast, risky)</span><span>60s (slow, safe)</span>
                                </div>
                                <div className="alert alert-warning" style={{ marginTop: 8 }}>
                                    ⚠️ Recommended: 15–30s to avoid Gmail spam flags.
                                </div>
                            </div>
                        </div>
                    </div>

                    <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving} style={{ gap: 8 }}>
                        {saving ? 'Saving...' : <><SaveIcon size={16} /> Save Settings</>}
                    </button>
                </div>
            )}
        </div>
    )
}
