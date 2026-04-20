import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { campaignsApi, settingsApi } from '../api'

function renderMarkdown(text) {
    // Very simple markdown preview renderer
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^#{1}\s(.+)$/gm, '<h1>$1</h1>')
        .replace(/^#{2}\s(.+)$/gm, '<h2>$1</h2>')
        .replace(/^#{3}\s(.+)$/gm, '<h3>$1</h3>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
        .replace(/^---$/gm, '<hr/>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^\*\s(.+)$/gm, '<li>$1</li>')
}

const DEFAULT_TEMPLATE = `Hi {{hr_name | "Hiring Team"}},

I hope this message finds you well!

My name is **Suraj Choudhari**, and I am a passionate and driven software developer with hands-on experience in full-stack web development, particularly with **React**, **Node.js**, **JavaScript**, and **REST APIs**.

I came across **{{company_name}}** and was genuinely impressed by your work. I would love to explore **{{position | "suitable opportunities"}}** at your organization.

**A quick snapshot of what I bring:**
* Full-Stack Development (React, Node.js, Express, REST APIs)
* Databases (MySQL, MongoDB, SQLite)
* Tools: Git, VS Code, Postman, Linux
* Passion for clean code, problem-solving, and learning

I have attached my **resume** for your review. Looking forward to hearing from you!

Best regards,
**{{applicant_name | "Suraj Choudhari"}}**
📧 {{applicant_email | "surajorg47@gmail.com"}}

---
*This email was sent as a job application. Please forward to recruitment if needed.*`

export default function CampaignCompose() {
    const { id } = useParams()
    const navigate = useNavigate()
    const isEdit = Boolean(id)

    const [form, setForm] = useState({
        name: '',
        subject: 'Application for Software Developer Role — Suraj Choudhari',
        template_content: DEFAULT_TEMPLATE,
        position: 'Software Developer',
        resume_path: 'C:\\Users\\Admin\\OneDrive\\Desktop\\code\\scrapper\\Suraj_Choudhari_Resume.pdf',
    })
    const [activeTab, setActiveTab] = useState('edit') // 'edit' | 'preview'
    const [saving, setSaving] = useState(false)
    const [testSending, setTestSending] = useState(false)
    const [testEmail, setTestEmail] = useState('surajorg48@gmail.com')
    const [showTestModal, setShowTestModal] = useState(false)

    useEffect(() => {
        if (isEdit) {
            campaignsApi.getOne(id).then(r => {
                const c = r.data
                setForm({ name: c.name, subject: c.subject, template_content: c.template_content, position: c.position, resume_path: c.resume_path })
            }).catch(e => toast.error(e.message))
        } else {
            // Load default template from settings
            settingsApi.getTemplate().then(r => {
                if (r.data.content) setForm(prev => ({ ...prev, template_content: r.data.content }))
            }).catch(() => { })
        }
    }, [id])

    const handleSave = async () => {
        if (!form.name || !form.subject) return toast.error('Name and subject are required')
        setSaving(true)
        try {
            if (isEdit) {
                await campaignsApi.update(id, form)
                toast.success('Campaign saved!')
            } else {
                const res = await campaignsApi.create(form)
                toast.success('Campaign created!')
                navigate(`/campaigns/${res.data.id}/edit`)
            }
        } catch (e) { toast.error(e.message) }
        finally { setSaving(false) }
    }

    const handleSendTest = async () => {
        setTestSending(true)
        setShowTestModal(false)
        try {
            let campaignId = id
            if (!isEdit) {
                // Save first
                const res = await campaignsApi.create(form)
                campaignId = res.data.id
            }
            await campaignsApi.sendTest(campaignId, testEmail)
            toast.success(`✅ Test email sent to ${testEmail}! Check your inbox.`)
        } catch (e) { toast.error(e.message) }
        finally { setTestSending(false) }
    }

    const previewHtml = renderMarkdown(
        form.template_content
            .replace(/\{\{company_name\}\}/g, 'ExampleTech Pvt Ltd')
            .replace(/\{\{hr_name[^}]*\}\}/g, 'Priya Sharma')
            .replace(/\{\{position[^}]*\}\}/g, form.position || 'Software Developer')
            .replace(/\{\{applicant_name[^}]*\}\}/g, 'Suraj Choudhari')
            .replace(/\{\{applicant_email[^}]*\}\}/g, 'surajorg47@gmail.com')
            .replace(/\{\{applicant_phone[^}]*\}\}/g, '+91 XXXXXXXXXX')
            .replace(/\{\{[^}]+\}\}/g, '')
    )

    const placeholders = ['{{company_name}}', '{{hr_name}}', '{{position}}', '{{applicant_name}}', '{{applicant_email}}', '{{applicant_phone}}', '{{applicant_linkedin}}', '{{applicant_github}}', '{{date}}']

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>{isEdit ? '✏️ Edit Campaign' : '✨ New Campaign'}</h1>
                <p>Compose your email template with dynamic placeholders. Test before sending!</p>
            </div>

            {/* Top fields */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
                    <div className="form-group">
                        <label className="form-label">Campaign Name *</label>
                        <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="April 2026 — Frontend Roles" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Target Position</label>
                        <input className="input" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="Software Developer" />
                    </div>
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label">Email Subject *</label>
                    <input className="input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Application for Software Developer Role — Suraj Choudhari" />
                </div>
                <div className="form-group">
                    <label className="form-label">Resume File Path</label>
                    <input className="input mono" value={form.resume_path} onChange={e => setForm({ ...form, resume_path: e.target.value })} placeholder="C:\path\to\resume.pdf" />
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>This file will be attached to every email in this campaign.</div>
                </div>
            </div>

            {/* Template Editor + Preview */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header" style={{ marginBottom: 0 }}>
                    <div className="card-title">📝 Email Template</div>
                    <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
                        <div className={`tab${activeTab === 'edit' ? ' active' : ''}`} onClick={() => setActiveTab('edit')}>✏️ Edit</div>
                        <div className={`tab${activeTab === 'preview' ? ' active' : ''}`} onClick={() => setActiveTab('preview')}>👁️ Preview</div>
                    </div>
                </div>
                <div className="divider" />

                <div className="grid-2" style={{ gap: 16 }}>
                    {/* Editor */}
                    <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>Markdown editor — use placeholders below</div>
                        <textarea className="textarea mono" style={{ minHeight: 380, fontSize: '0.8rem' }}
                            value={form.template_content} onChange={e => setForm({ ...form, template_content: e.target.value })} />

                        {/* Placeholder chips */}
                        <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>📎 Click to insert placeholder:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {placeholders.map(p => (
                                    <button key={p} className="btn btn-ghost btn-sm mono" style={{ fontSize: '0.68rem', padding: '3px 8px' }}
                                        onClick={() => setForm(prev => ({ ...prev, template_content: prev.template_content + p }))}>
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>Live preview (sample data filled in)</div>
                        <div className="markdown-preview" style={{
                            background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', padding: 20,
                            border: '1px solid var(--border)', minHeight: 380,
                            fontSize: '0.85rem', lineHeight: 1.7
                        }}
                            dangerouslySetInnerHTML={{ __html: `<p>${previewHtml}</p>` }} />
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" onClick={() => navigate('/campaigns')}>← Back</button>
                <button className="btn btn-warning" onClick={() => setShowTestModal(true)} disabled={testSending}>
                    {testSending ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span> Sending...</> : '🧪 Send Test Email'}
                </button>
                <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : isEdit ? '💾 Save Changes' : '✅ Create Campaign'}
                </button>
            </div>

            {/* Test Email Modal */}
            {showTestModal && (
                <div className="modal-overlay" onClick={() => setShowTestModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">🧪 Send Test Email</div>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowTestModal(false)}>✕</button>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
                            A test email will be sent with sample data (company = "ExampleTech Pvt Ltd") and your resume attached.
                        </p>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label">Test Email Address</label>
                            <input className="input" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
                        </div>
                        <div className="alert alert-info">
                            ✅ After confirming the test email looks correct, you can launch the campaign to send to real companies.
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowTestModal(false)}>Cancel</button>
                            <button className="btn btn-warning" onClick={handleSendTest}>🚀 Send Test</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
