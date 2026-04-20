const express = require('express');
const router = express.Router();
const db = require('../db/database');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { generateAuthUrl, handleAuthCallback, disconnectGmail, getStatus, CREDENTIALS_PATH } = require('../services/gmail.service');
const credUpload = multer({ dest: path.join(__dirname, '../../credentials/') });

// GET all settings
router.get('/', async (req, res) => {
    try {
        const rows = await db('settings').select('key', 'value');
        const settings = rows.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
        const gmailStatus = getStatus();
        res.json({ ...settings, ...gmailStatus });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update settings
router.put('/', async (req, res) => {
    try {
        const allowed = ['sender_email', 'test_email', 'send_delay_ms', 'resume_path', 'applicant_name', 'applicant_phone', 'applicant_linkedin', 'applicant_github'];
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

// GET Gmail auth URL
router.get('/gmail/auth-url', (req, res) => {
    try { res.json({ url: generateAuthUrl() }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// GET Gmail status
router.get('/gmail/status', (req, res) => {
    res.json(getStatus());
});

// POST disconnect
router.post('/gmail/disconnect', async (req, res) => {
    try {
        disconnectGmail();
        await db('settings').where('key', 'gmail_connected').update({ value: 'false' });
        res.json({ message: 'Disconnected' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST upload credentials.json
router.post('/gmail/credentials', credUpload.single('credentials'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const destPath = CREDENTIALS_PATH;
    const credDir = path.dirname(destPath);
    if (!fs.existsSync(credDir)) fs.mkdirSync(credDir, { recursive: true });
    fs.renameSync(req.file.path, destPath);
    res.json({ message: 'credentials.json uploaded. Now connect Gmail.' });
});

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
