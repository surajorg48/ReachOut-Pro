const express = require('express');
const router = express.Router();
const db = require('../db/database');
const XLSX = require('xlsx');

// GET all logs
router.get('/', async (req, res) => {
    try {
        const { status, campaign_id, limit = 200 } = req.query;
        let query = db('email_logs').orderBy('id', 'desc').limit(parseInt(limit));
        if (status) query = query.where('status', status);
        if (campaign_id) query = query.where('campaign_id', campaign_id);
        const logs = await query;
        const [{ total }] = await db('email_logs').count('id as total');
        res.json({ logs, total });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET stats
router.get('/stats', async (req, res) => {
    try {
        const [{ sent }] = await db('email_logs').where('status', 'sent').count('id as sent');
        const [{ failed }] = await db('email_logs').where('status', 'failed').count('id as failed');
        const [{ pending }] = await db('email_logs').where('status', 'pending').count('id as pending');
        const [{ today }] = await db('email_logs').where('status', 'sent').whereRaw("DATE(sent_at) = DATE('now')").count('id as today');
        res.json({ sent, failed, pending, today });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST retry
router.post('/:id/retry', async (req, res) => {
    try {
        const log = await db('email_logs').where('id', req.params.id).first();
        if (!log) return res.status(404).json({ error: 'Log not found' });
        if (log.status !== 'failed') return res.status(400).json({ error: 'Only failed can be retried' });
        const campaign = await db('campaigns').where('id', log.campaign_id).first();
        const settings = (await db('settings').select()).reduce((a, r) => { a[r.key] = r.value; return a; }, {});
        const { sendEmail } = require('../services/email.service');
        const result = await sendEmail({
            to: log.recipient_email, toName: log.recipient_name, companyName: log.company_name,
            subject: log.subject, templateContent: campaign?.template_content,
            resumePath: campaign?.resume_path,
            campaignVars: { position: campaign?.position, applicant_name: settings.applicant_name, applicant_email: settings.sender_email, applicant_phone: settings.applicant_phone || '', applicant_linkedin: settings.applicant_linkedin || '', applicant_github: settings.applicant_github || '' },
        });
        await db('email_logs').where('id', log.id).update({ status: 'sent', sent_at: new Date().toISOString(), error_msg: null, gmail_message_id: result.messageId });
        res.json({ success: true });
    } catch (e) {
        if (req.params.id) await db('email_logs').where('id', req.params.id).update({ error_msg: e.message }).catch(() => { });
        res.status(500).json({ error: e.message });
    }
});

// DELETE log
router.delete('/:id', async (req, res) => {
    try {
        await db('email_logs').where('id', req.params.id).delete();
        res.json({ message: 'Deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET export Excel
router.get('/export', async (req, res) => {
    try {
        const logs = await db('email_logs').select('recipient_email as Email', 'company_name as Company', 'subject as Subject', 'status as Status', 'sent_at as Sent At', 'error_msg as Error').orderBy('id', 'desc');
        const ws = XLSX.utils.json_to_sheet(logs);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Email Logs');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename="email_logs.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
