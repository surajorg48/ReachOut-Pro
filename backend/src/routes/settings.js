const express = require('express');
const router = express.Router();
const db = require('../db/database');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const {
    generateAuthUrl, getStatus, addAccount, removeAccount, getAllAccounts,
    getActiveAccount, setActiveAccount, disconnectAccount
} = require('../services/gmail.service');

const credUpload = multer({ dest: path.join(__dirname, '../../credentials/tmp/') });

// ── General Settings ─────────────────────────────────────────────────────────

// GET all settings
router.get('/', async (req, res) => {
    try {
        const rows = await db('settings').select('key', 'value');
        const settings = rows.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
        const gmailStatus = getStatus();
        const accounts = await getAllAccounts();
        const active = await getActiveAccount();
        
        // Multi-account connection check
        const accountsWithStatus = accounts.map(acc => {
            const accCopy = { ...acc };
            delete accCopy.credentials_json; // Don't send secrets to frontend
            delete accCopy.token_json;
            return {
                ...accCopy,
                isConnected: !!acc.token_json
            };
        });
        const anyConnected = accountsWithStatus.some(acc => acc.isConnected);
        
        res.json({ 
            ...settings, 
            ...gmailStatus, 
            gmailConnected: gmailStatus.gmailConnected || anyConnected,
            gmail_accounts: accountsWithStatus, 
            active_account: active 
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update settings
router.put('/', async (req, res) => {
    try {
        const allowed = ['sender_email', 'test_email', 'send_delay_ms', 'resume_path',
            'applicant_name', 'applicant_phone', 'applicant_linkedin', 'applicant_github'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                const exists = await db('settings').where('key', key).first();
                if (exists) await db('settings').where('key', key).update({ value: req.body[key] });
                else await db('settings').insert({ key, value: req.body[key] });
            }
        }
        res.json({ message: 'Settings saved' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Gmail OAuth (legacy single-account) ──────────────────────────────────────

// GET Gmail auth URL
router.get('/gmail/auth-url', (req, res) => {
    try { res.json({ url: generateAuthUrl() }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// GET Gmail status
router.get('/gmail/status', async (req, res) => {
    try {
        const status = await getStatus();
        res.json(status);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Legacy routes removed for Postgres deployment

// ── Gmail Multi-Account ──────────────────────────────────────────────────────

// GET all gmail accounts
router.get('/gmail/accounts', async (req, res) => {
    try {
        const accounts = await getAllAccounts();
        const active = await getActiveAccount();
        const accountsWithStatus = accounts.map(acc => {
            const accCopy = { ...acc };
            delete accCopy.credentials_json;
            delete accCopy.token_json;
            return {
                ...accCopy,
                isConnected: !!acc.token_json
            };
        });
        res.json({ accounts: accountsWithStatus, activeId: active?.id || null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST add new gmail account (upload credentials.json + email)
router.post('/gmail/accounts', credUpload.single('credentials'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No credentials.json file uploaded' });
    const { email, label } = req.body;
    if (!email) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Email address is required' });
    }
    try {
        const account = await addAccount(email, label || email, req.file.path);
        res.json({ message: `Account ${email} added`, account });
    } catch (e) {
        try { fs.unlinkSync(req.file.path); } catch { }
        res.status(500).json({ error: e.message });
    }
});

// POST set active account
router.post('/gmail/accounts/:id/activate', async (req, res) => {
    try {
        const acc = await db('gmail_accounts').where('id', req.params.id).first();
        if (!acc) return res.status(404).json({ error: 'Account not found' });
        await setActiveAccount(parseInt(req.params.id));
        // Also update sender_email setting to match
        await db('settings').where('key', 'sender_email').update({ value: acc.email });
        res.json({ message: `Active account set to ${acc.email}` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET auth URL for a specific account
router.get('/gmail/accounts/:id/auth-url', async (req, res) => {
    try {
        const acc = await db('gmail_accounts').where('id', req.params.id).first();
        if (!acc) return res.status(404).json({ error: 'Account not found' });
        const creds = JSON.parse(acc.credentials_json);
        const url = generateAuthUrl(creds);
        // Store pending account id for the callback
        await db('settings').where('key', 'active_gmail_account').update({ value: '' });
        // Temporarily store which account is being authorized
        const exists = await db('settings').where('key', '_pending_auth_account').first();
        if (exists) await db('settings').where('key', '_pending_auth_account').update({ value: String(acc.id) });
        else await db('settings').insert({ key: '_pending_auth_account', value: String(acc.id) });
        res.json({ url });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE remove account
router.delete('/gmail/accounts/:id', async (req, res) => {
    try {
        await removeAccount(parseInt(req.params.id));
        res.json({ message: 'Account removed' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST disconnect specific account
router.post('/gmail/accounts/:id/disconnect', async (req, res) => {
    try {
        await disconnectAccount(parseInt(req.params.id));
        res.json({ message: 'Account disconnected' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Templates ────────────────────────────────────────────────────────────────

// GET template
router.get('/template', (req, res) => {
    const templatePath = process.env.TEMPLATE_PATH || path.join(__dirname, '../../../templates/email_template.md');
    try { res.json({ content: fs.readFileSync(path.resolve(templatePath), 'utf8') }); }
    catch { res.json({ content: '' }); }
});

// PUT save template
router.put('/template', (req, res) => {
    const { content } = req.body;
    const templatePath = process.env.TEMPLATE_PATH || path.join(__dirname, '../../../templates/email_template.md');
    const resolved = path.resolve(templatePath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resolved, content, 'utf8');
    res.json({ message: 'Template saved' });
});

module.exports = router;
