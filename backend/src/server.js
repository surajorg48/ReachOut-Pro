require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initializeDatabase } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/companies', require('./routes/companies'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/scraper', require('./routes/scraper'));
app.use('/api/logs', require('./routes/email'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/resume', require('./routes/resume'));

// Gmail OAuth callback
app.get('/auth/callback', async (req, res) => {
    const { handleAuthCallback } = require('./services/gmail.service');
    const db = require('./db/database');
    const { code } = req.query;
    if (!code) return res.status(400).send('No code provided');
    try {
        await handleAuthCallback(code);
        // Upsert gmail_connected flag so it works even on first run
        const existing = await db('settings').where('key', 'gmail_connected').first();
        if (existing) {
            await db('settings').where('key', 'gmail_connected').update({ value: 'true' });
        } else {
            await db('settings').insert({ key: 'gmail_connected', value: 'true' });
        }
        res.send(`
      <html><head><style>body{font-family:'Inter',sans-serif;background:#0a0a1b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px}</style></head>
      <body><div style="font-size:60px">✅</div><h2>Gmail Connected!</h2><p style="color:#888">Closing in 3 seconds...</p>
      <script>
        try { window.opener && window.opener.postMessage('gmail_connected', '*'); } catch(e) {}
        setTimeout(() => window.close(), 3000);
      </script></body></html>
    `);
    } catch (err) {
        res.status(500).send(`
      <html><head><style>body{font-family:'Inter',sans-serif;background:#0a0a1b;color:#ff6b6b;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px}</style></head>
      <body><div style="font-size:60px">❌</div><h2>Connection Failed</h2><p>${err.message}</p></body></html>
    `);
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => { res.status(404).json({ error: `Route ${req.path} not found` }); });

// Error handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start
async function main() {
    // Ensure directories
    ['data', 'credentials'].forEach(dir => {
        const p = path.join(__dirname, '..', dir);
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    });

    await initializeDatabase();

    app.listen(PORT, () => {
        console.log('');
        console.log('╔══════════════════════════════════════════╗');
        console.log('║       ReachOut Pro Backend v1.0          ║');
        console.log(`║   Server: http://localhost:${PORT}           ║`);
        console.log('╚══════════════════════════════════════════╝');
        console.log('');
    });
}

main().catch(err => { console.error('Startup error:', err); process.exit(1); });

module.exports = app;
