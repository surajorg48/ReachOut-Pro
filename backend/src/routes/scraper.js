const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { scrapeCompany } = require('../services/scraper.service');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage() });

// ─── In-memory session store (survives tab switches, not server restarts) ───
const scrapeSessions = new Map();
const scraperSseClients = new Set();

const DEFAULT_CONCURRENCY = 3; // scrapers running in parallel

// ─── Helpers ───────────────────────────────────────────────────────────────

function broadcast(data) {
    const str = `data: ${JSON.stringify(data)}\n\n`;
    scraperSseClients.forEach(c => { try { c.write(str); } catch { } });
}

function getCompanyName(url) {
    try {
        return new URL(url.startsWith('http') ? url : 'https://' + url)
            .hostname.replace('www.', '').split('.')[0]
            .replace(/^./, s => s.toUpperCase());
    } catch { return url; }
}

async function saveToDb(url, companyName, emails, phones) {
    if (emails.length === 0) return null;
    const domainKey = url.replace('https://', '').replace('http://', '').split('/')[0];
    let company = await db('companies').whereLike('website', `%${domainKey}%`).first();
    let companyId;
    if (!company) {
        const [id] = await db('companies').insert({ name: companyName, website: url, industry: 'IT' });
        companyId = id;
    } else {
        companyId = company.id;
    }
    for (const e of emails) {
        const exists = await db('contacts').where({ company_id: companyId, email: e.email }).first();
        if (!exists) {
            await db('contacts').insert({
                company_id: companyId,
                email: e.email,
                score: e.score,
                source_url: e.source_url || url,
                phone: phones[0] || '',
            }).catch(() => { });
        }
    }
    return companyId;
}

// ─── True parallel worker pool using Promise.all ──────────────────────────

async function runSession(sessionId, concurrency) {
    const session = scrapeSessions.get(sessionId);
    if (!session) return;

    session.status = 'running';
    session.startTime = Date.now();
    broadcast({ type: 'session_update', sessionId, session: publicSession(session) });

    const urlQueue = [...session.pendingUrls];
    let pointer = 0; // atomic index — safe in JS single-threaded event loop

    // Create N independent worker coroutines. Each worker loops, grabbing the
    // next URL from the queue and scraping it, until the queue is empty.
    // Promise.all runs them all concurrently — this is true parallel scraping.
    const numWorkers = Math.min(concurrency, urlQueue.length);
    const workers = Array.from({ length: numWorkers }, (_, workerId) =>
        (async () => {
            while (true) {
                // Atomically grab next URL (JS is single-threaded so pointer++ is safe)
                const idx = pointer++;
                if (idx >= urlQueue.length) break; // Queue exhausted — this worker is done

                const s = scrapeSessions.get(sessionId);
                if (!s || s.cancelToken.cancelled) break; // Session cancelled

                // Wait while paused (without consuming a URL slot)
                while (true) {
                    const ss = scrapeSessions.get(sessionId);
                    if (!ss || ss.cancelToken.cancelled) break;
                    if (ss.status !== 'paused') break;
                    await new Promise(r => setTimeout(r, 300));
                }

                const url = urlQueue[idx];
                const s2 = scrapeSessions.get(sessionId);
                if (!s2 || s2.cancelToken.cancelled) break;

                // Notify frontend this worker started a new URL
                broadcast({ type: 'progress', sessionId, url, workerId, index: idx, total: urlQueue.length, status: 'scraping' });

                let result = { emails: [], phones: [] };
                try {
                    result = await scrapeCompany(url,
                        (p) => broadcast({ type: 'step', sessionId, url, workerId, ...p }),
                        s2.cancelToken
                    );
                } catch (err) {
                    result = { emails: [], phones: [], error: err.message };
                }

                const s3 = scrapeSessions.get(sessionId);
                if (!s3) break;

                const companyName = getCompanyName(url);
                let resultEntry;

                if (result.cancelled) {
                    resultEntry = { url, companyName, emails: [], phones: [], status: 'cancelled' };
                } else if (result.error) {
                    resultEntry = { url, companyName, emails: [], phones: [], status: 'error', error: result.error };
                } else {
                    await saveToDb(url, companyName, result.emails, result.phones).catch(() => { });
                    resultEntry = { url, companyName, emails: result.emails, phones: result.phones, status: 'done' };
                }

                s3.results.push(resultEntry);
                s3.done++;

                // Estimate remaining time
                const elapsed = Date.now() - s3.startTime;
                const avgMs = s3.done > 0 ? elapsed / s3.done : 0;
                const remaining = Math.round(((s3.total - s3.done) * avgMs) / 1000 / numWorkers);

                broadcast({
                    type: 'result',
                    sessionId,
                    workerId,
                    ...resultEntry,
                    done: s3.done,
                    total: s3.total,
                    remainingSeconds: remaining,
                });
            }
        })()
    );

    // Wait for ALL N workers to complete
    await Promise.all(workers);

    const s = scrapeSessions.get(sessionId);
    if (s) {
        s.status = s.cancelToken.cancelled ? 'stopped' : 'complete';
        broadcast({ type: 'done', sessionId, status: s.status, results: s.results, total: s.total, done: s.done });
    }
}


function publicSession(s) {
    return {
        status: s.status,
        total: s.total,
        done: s.done,
        results: s.results,
        startTime: s.startTime,
        concurrency: s.concurrency,
    };
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// POST /run — Start new scraping session
router.post('/run', async (req, res) => {
    const { urls, concurrency } = req.body;
    if (!urls?.length) return res.status(400).json({ error: 'No URLs provided' });

    const c = Math.min(Math.max(parseInt(concurrency) || DEFAULT_CONCURRENCY, 1), 8);
    const sessionId = Date.now().toString();

    const session = {
        status: 'running',
        total: urls.length,
        done: 0,
        results: [],
        pendingUrls: urls,
        startTime: Date.now(),
        concurrency: c,
        cancelToken: { cancelled: false },
    };
    scrapeSessions.set(sessionId, session);

    res.json({ sessionId, message: `Started scraping ${urls.length} sites with ${c} parallel workers` });
    runSession(sessionId, c);
});

// POST /stop — Stop/cancel a session
router.post('/stop', (req, res) => {
    const { sessionId } = req.body;
    const s = scrapeSessions.get(sessionId);
    if (!s) return res.status(404).json({ error: 'Session not found' });
    s.cancelToken.cancelled = true;
    s.status = 'stopped';
    broadcast({ type: 'stopped', sessionId });
    res.json({ message: 'Stopped' });
});

// POST /pause — Pause a session
router.post('/pause', (req, res) => {
    const { sessionId } = req.body;
    const s = scrapeSessions.get(sessionId);
    if (!s) return res.status(404).json({ error: 'Session not found' });
    s.status = 'paused';
    broadcast({ type: 'paused', sessionId });
    res.json({ message: 'Paused' });
});

// POST /resume — Resume a paused session
router.post('/resume', (req, res) => {
    const { sessionId } = req.body;
    const s = scrapeSessions.get(sessionId);
    if (!s) return res.status(404).json({ error: 'Session not found' });
    s.status = 'running';
    broadcast({ type: 'resumed', sessionId });
    res.json({ message: 'Resumed' });
});

// GET /session/:id — Get full session state (used on page reload)
router.get('/session/:id', (req, res) => {
    const s = scrapeSessions.get(req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(publicSession(s));
});

// GET /sessions — List all session IDs (so frontend can recover active one)
router.get('/sessions', (req, res) => {
    const list = [];
    for (const [id, s] of scrapeSessions.entries()) {
        list.push({ sessionId: id, status: s.status, total: s.total, done: s.done, startTime: s.startTime });
    }
    res.json(list.sort((a, b) => b.startTime - a.startTime).slice(0, 5));
});

// PATCH /result — Update best email for a specific result (user-picked)
router.patch('/result', (req, res) => {
    const { sessionId, url, bestEmail } = req.body;
    const s = scrapeSessions.get(sessionId);
    if (!s) return res.status(404).json({ error: 'Session not found' });
    const result = s.results.find(r => r.url === url);
    if (!result) return res.status(404).json({ error: 'Result not found' });
    result.selectedBestEmail = bestEmail;

    // Also update DB contact
    db('contacts').where('email', bestEmail).update({ score: 99 }).catch(() => { });

    res.json({ message: 'Updated' });
});

// GET /export — Export session results as Excel
router.get('/export/:sessionId', (req, res) => {
    const s = scrapeSessions.get(req.params.sessionId);
    if (!s) return res.status(404).json({ error: 'Session not found' });

    const rows = s.results.map(r => {
        const bestEmail = r.selectedBestEmail || r.emails?.[0]?.email || '';
        const row = {
            'Company': r.companyName || '',
            'Website': r.url || '',
            'Status': r.status || '',
            'Best Email': bestEmail,
            'Phone': (r.phones || []).join(', '),
        };
        // Add individual emails
        (r.emails || []).forEach((e, i) => {
            if (i === 0 && !r.selectedBestEmail) return; // already in Best Email
            row[`Email ${i + 1}`] = e.email;
            row[`Score ${i + 1}`] = e.score;
        });
        return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Scrape Results');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="scrape_results_${req.params.sessionId}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
});

// POST /import — Import URLs from Excel/CSV
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

// GET /stream — SSE stream
router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    scraperSseClients.add(res);
    req.on('close', () => scraperSseClients.delete(res));
});

module.exports = router;
