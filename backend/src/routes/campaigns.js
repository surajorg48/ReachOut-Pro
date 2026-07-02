const express = require('express');
const router = express.Router();
const db = require('../db/database');

const sseClients = new Set();

async function getSettings() {
    const rows = await db('settings').select('key', 'value');
    return rows.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
}

// GET all campaigns
router.get('/', async (req, res) => {
    try {
        const campaigns = await db('campaigns').orderBy('created_at', 'desc');
        const enriched = await Promise.all(campaigns.map(async c => {
            const [{ sent }] = await db('email_logs').where({ campaign_id: c.id, status: 'sent' }).count('id as sent');
            const [{ failed }] = await db('email_logs').where({ campaign_id: c.id, status: 'failed' }).count('id as failed');
            const [{ pending }] = await db('email_logs').where({ campaign_id: c.id, status: 'pending' }).count('id as pending');
            return { ...c, stats: { sent, failed, pending } };
        }));
        res.json(enriched);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single
router.get('/:id', async (req, res) => {
    try {
        const campaign = await db('campaigns').where('id', req.params.id).first();
        if (!campaign) return res.status(404).json({ error: 'Not found' });
        res.json(campaign);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create
router.post('/', async (req, res) => {
    try {
        const { name, subject, template_content, position, resume_path } = req.body;
        if (!name || !subject) return res.status(400).json({ error: 'Name and subject required' });
        const defaultResume = process.env.RESUME_PATH || '../Suraj_Choudhari_Resume.pdf';
        const result = await db('campaigns').insert({ name, subject, template_content: template_content || '', position: position || 'Software Developer', resume_path: resume_path || defaultResume }).returning('id');
        const id = result[0]?.id || result[0];
        res.json({ id, message: 'Campaign created' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update
router.put('/:id', async (req, res) => {
    try {
        const { name, subject, template_content, position, resume_path, status } = req.body;
        await db('campaigns').where('id', req.params.id).update({ name, subject, template_content, position, resume_path, status: status || 'draft', updated_at: db.fn.now() });
        res.json({ message: 'Updated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE
router.delete('/:id', async (req, res) => {
    try {
        await db('campaigns').where('id', req.params.id).delete();
        res.json({ message: 'Deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST send test email
router.post('/:id/send-test', async (req, res) => {
    try {
        const campaign = await db('campaigns').where('id', req.params.id).first();
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        const testEmail = req.body.test_email || process.env.TEST_EMAIL || 'surajorg48@gmail.com';
        const settings = await getSettings();
        const { sendEmail } = require('../services/email.service');
        const result = await sendEmail({
            to: testEmail, toName: 'Test Recipient', companyName: 'Test Company Pvt Ltd',
            subject: `[TEST] ${campaign.subject}`, templateContent: campaign.template_content,
            resumePath: campaign.resume_path,
            campaignVars: { position: campaign.position, applicant_name: settings.applicant_name || 'Suraj Choudhari', applicant_email: settings.sender_email, applicant_phone: settings.applicant_phone || '', applicant_linkedin: settings.applicant_linkedin || '', applicant_github: settings.applicant_github || '' },
        });
        await db('email_logs').insert({ campaign_id: campaign.id, recipient_email: testEmail, recipient_name: 'Test Recipient', company_name: 'Test Company', subject: `[TEST] ${campaign.subject}`, status: 'sent', sent_at: new Date().toISOString(), gmail_message_id: result.messageId });
        res.json({ success: true, message: `Test email sent to ${testEmail}` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST send to selected
router.post('/:id/send-selected', async (req, res) => {
    try {
        const { company_ids, contact_ids } = req.body;
        const campaign = await db('campaigns').where('id', req.params.id).first();
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        let contacts = [];
        if (contact_ids?.length) {
            contacts = await db('contacts as ct').join('companies as c', 'ct.company_id', 'c.id').select('ct.*', 'c.name as company_name').whereIn('ct.id', contact_ids);
        } else if (company_ids?.length) {
            for (const cid of company_ids) {
                const contact = await db('contacts as ct').join('companies as c', 'ct.company_id', 'c.id').select('ct.*', 'c.name as company_name').where('ct.company_id', cid).orderBy('ct.score', 'desc').first();
                if (contact) contacts.push(contact);
            }
        }
        if (!contacts.length) return res.status(400).json({ error: 'No valid contacts found' });

        for (const c of contacts) {
            await db('email_logs').insert({ campaign_id: campaign.id, contact_id: c.id, company_id: c.company_id, recipient_email: c.email, recipient_name: c.name, company_name: c.company_name, subject: campaign.subject, status: 'pending' });
        }
        res.json({ message: `Queued ${contacts.length} emails`, count: contacts.length });

        const settings = await getSettings();
        runBulkSend(campaign, contacts, settings, sseClients);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST send all
router.post('/:id/send-all', async (req, res) => {
    try {
        const campaign = await db('campaigns').where('id', req.params.id).first();
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const companies = await db('companies').whereNot('status', 'not_interested').select('id');
        const contacts = [];
        for (const comp of companies) {
            const alreadySent = await db('email_logs').where({ campaign_id: campaign.id, company_id: comp.id, status: 'sent' }).first();
            if (!alreadySent) {
                const contact = await db('contacts as ct').join('companies as c', 'ct.company_id', 'c.id').select('ct.*', 'c.name as company_name').where('ct.company_id', comp.id).orderBy('ct.score', 'desc').first();
                if (contact) contacts.push(contact);
            }
        }
        if (!contacts.length) return res.status(400).json({ error: 'No pending contacts found' });

        for (const c of contacts) {
            await db('email_logs').insert({ campaign_id: campaign.id, contact_id: c.id, company_id: c.company_id, recipient_email: c.email, recipient_name: c.name, company_name: c.company_name, subject: campaign.subject, status: 'pending' });
        }
        res.json({ message: `Queued ${contacts.length} emails`, count: contacts.length });
        const settings = await getSettings();
        runBulkSend(campaign, contacts, settings, sseClients);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// SSE stream
router.get('/progress/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
});

async function runBulkSend(campaign, contacts, settings, clients) {
    const { sendBulkEmails } = require('../services/email.service');
    try {
        await sendBulkEmails({
            contacts, campaign, settings,
            onProgress: async (p) => {
                const data = JSON.stringify(p);
                clients.forEach(c => { try { c.write(`data: ${data}\n\n`); } catch { } });
                if (p.status === 'sent' || p.status === 'failed') {
                    try {
                        await db('email_logs').where({ campaign_id: campaign.id, recipient_email: contacts[p.index]?.email, status: 'pending' }).update({
                            status: p.status,
                            sent_at: p.status === 'sent' ? new Date().toISOString() : null,
                            error_msg: p.error || null,
                        });
                        if (p.status === 'sent' && contacts[p.index]?.company_id) {
                            await db('companies').where('id', contacts[p.index].company_id).update({ status: 'contacted', updated_at: db.fn.now() });
                        }
                    } catch { }
                }
            }
        });
        const done = JSON.stringify({ type: 'done', total: contacts.length });
        clients.forEach(c => { try { c.write(`data: ${done}\n\n`); } catch { } });
    } catch (err) {
        const errData = JSON.stringify({ type: 'error', message: err.message });
        clients.forEach(c => { try { c.write(`data: ${errData}\n\n`); } catch { } });
    }
}

module.exports = router;
