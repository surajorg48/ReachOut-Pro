const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { scrapeCompany } = require('../services/scraper.service');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage() });

const scraperSseClients = new Set();
const scrapeSessions = new Map();

// POST run scraper
router.post('/run', async (req, res) => {
    const { urls } = req.body;
    if (!urls?.length) return res.status(400).json({ error: 'No URLs provided' });

    const sessionId = Date.now().toString();
    scrapeSessions.set(sessionId, { status: 'running', total: urls.length, done: 0, results: [] });
    res.json({ sessionId, message: `Started scraping ${urls.length} sites` });

    (async () => {
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            broadcast({ type: 'progress', sessionId, index: i, total: urls.length, url, status: 'scraping' });
            try {
                const result = await scrapeCompany(url, (p) => broadcast({ type: 'step', sessionId, url, ...p }));
                let companyName = '';
                try { companyName = new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace('www.', '').split('.')[0]; } catch { }
                companyName = companyName.charAt(0).toUpperCase() + companyName.slice(1);

                if (result.emails.length > 0) {
                    let company = await db('companies').whereLike('website', `%${url.replace('https://', '').replace('http://', '').split('/')[0]}%`).first();
                    let companyId;
                    if (!company) {
                        const [id] = await db('companies').insert({ name: companyName, website: url, industry: 'IT' });
                        companyId = id;
                    } else { companyId = company.id; }
                    for (const e of result.emails) {
                        const exists = await db('contacts').where({ company_id: companyId, email: e.email }).first();
                        if (!exists) {
                            await db('contacts').insert({ company_id: companyId, email: e.email, score: e.score, source_url: e.source_url || url }).catch(() => { });
                        }
                    }
                }
                const session = scrapeSessions.get(sessionId);
                session.results.push({ url, companyName, emails: result.emails, status: 'done' });
                session.done++;
                broadcast({ type: 'result', sessionId, url, companyName, emails: result.emails, status: 'done' });
            } catch (err) {
                const session = scrapeSessions.get(sessionId);
                session.results.push({ url, emails: [], status: 'error', error: err.message });
                session.done++;
                broadcast({ type: 'result', sessionId, url, emails: [], status: 'error', error: err.message });
            }
        }
        const session = scrapeSessions.get(sessionId);
        session.status = 'complete';
        broadcast({ type: 'done', sessionId, results: session.results });
    })();
});

// POST import URLs from file
router.post('/import', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const urls = rows.map(r => r['Website'] || r['website'] || r['URL'] || r['url'] || '').filter(Boolean);
        res.json({ urls, count: urls.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// SSE stream
router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    scraperSseClients.add(res);
    req.on('close', () => scraperSseClients.delete(res));
});

router.get('/session/:id', (req, res) => {
    const s = scrapeSessions.get(req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
});

function broadcast(data) {
    const str = `data: ${JSON.stringify(data)}\n\n`;
    scraperSseClients.forEach(c => { try { c.write(str); } catch { } });
}

module.exports = router;
