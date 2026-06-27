const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db/database');
const { scoreEmail, filterAndScoreEmails } = require('../utils/emailScorer');
const upload = multer({ storage: multer.memoryStorage() });

// ─── Static routes MUST come before /:id to avoid being swallowed as params ─

// GET stats
router.get('/stats/summary', async (req, res) => {
    try {
        const [{ total }] = await db('companies').count('id as total');
        const [{ pending }] = await db('companies').where('status', 'pending').count('id as pending');
        const [{ contacted }] = await db('companies').where('status', 'contacted').count('id as contacted');
        const [{ notInterested }] = await db('companies').where('status', 'not_interested').count('id as notInterested');
        const [{ totalEmails }] = await db('contacts').count('id as totalEmails');
        const [{ sentToday }] = await db('email_logs').where('status', 'sent').whereRaw("DATE(sent_at) = DATE('now')").count('id as sentToday');
        const [{ totalSent }] = await db('email_logs').where('status', 'sent').count('id as totalSent');
        const [{ totalFailed }] = await db('email_logs').where('status', 'failed').count('id as totalFailed');
        res.json({ total, pending, contacted, notInterested, totalEmails, sentToday, totalSent, totalFailed });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET export Excel
router.get('/export-excel', async (req, res) => {
    try {
        const companies = await db('companies as c').orderBy('c.name');
        const contacts = await db('contacts').orderBy('score', 'desc');

        // Group contacts by company_id
        const contactMap = {};
        for (const ct of contacts) {
            if (!contactMap[ct.company_id]) contactMap[ct.company_id] = [];
            contactMap[ct.company_id].push(ct);
        }

        const rows = companies.map(c => {
            const ctList = contactMap[c.id] || [];
            const best = ctList[0];
            const row = {
                'Company Name': c.name,
                'Website': c.website,
                'Industry': c.industry,
                'City': c.city,
                'Status': c.status,
                'Best Email': best?.email || '',
                'HR Name': best?.name || '',
                'Role': best?.role || '',
                'Phone': best?.phone || '',
                'Email Score': best?.score || '',
            };
            // Additional emails
            ctList.slice(1).forEach((ct, i) => {
                row[`Email ${i + 2}`] = ct.email;
                row[`Score ${i + 2}`] = ct.score;
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Companies');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename="reachout_companies.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET template Excel
router.get('/template-excel', (req, res) => {
    const template = [{
        'Company Name': 'Example Tech Pvt Ltd', 'Website': 'https://example.com',
        'Industry': 'IT', 'City': 'Pune', 'Email': 'hr@example.com',
        'HR Name': 'Priya Sharma', 'Role': 'HR Manager',
    }];
    const ws = XLSX.utils.json_to_sheet(template);
    ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Companies Template');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="reachout_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
});

// POST bulk delete
router.post('/bulk-delete', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids?.length) return res.status(400).json({ error: 'No IDs provided' });
        await db('companies').whereIn('id', ids).delete();
        res.json({ message: `Deleted ${ids.length} companies` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST bulk status
router.post('/bulk-status', async (req, res) => {
    try {
        const { ids, status } = req.body;
        await db('companies').whereIn('id', ids).update({ status });
        res.json({ message: 'Status updated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST bulk add (for discovered companies)
router.post('/bulk-add', async (req, res) => {
    try {
        const { companies } = req.body;
        if (!companies?.length) return res.status(400).json({ error: 'No companies provided' });
        let added = 0;
        for (const c of companies) {
            const name = c.name || 'Unknown';
            const website = c.website || '';
            const exists = await db('companies').where('name', name).orWhere('website', website).first();
            if (!exists) {
                await db('companies').insert({ name, website, industry: c.industry || 'IT', city: c.city || '' });
                added++;
            }
        }
        res.json({ message: `Added ${added} companies to database`, added });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST import Excel
router.post('/import-excel', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        let added = 0, skipped = 0;
        for (const row of rows) {
            const name = row['Company Name'] || row['company_name'] || row['Company'] || '';
            const website = row['Website'] || row['website'] || row['URL'] || '';
            const email = (row['Email'] || row['email'] || row['HR Email'] || row['hr_email'] || '').toLowerCase().trim();
            const hrName = row['HR Name'] || row['hr_name'] || '';
            const role = row['Role'] || row['role'] || '';
            const industry = row['Industry'] || row['industry'] || 'IT';
            const city = row['City'] || row['city'] || '';

            if (!name && !email) { skipped++; continue; }
            const companyName = name || email.split('@')[1]?.split('.')[0] || 'Unknown';

            try {
                let company = await db('companies').where('name', companyName).first();
                let companyId;
                if (!company) {
                    const [id] = await db('companies').insert({ name: companyName, website, industry, city });
                    companyId = id;
                } else {
                    companyId = company.id;
                }
                if (email && companyId) {
                    const exists = await db('contacts').where({ company_id: companyId, email }).first();
                    if (!exists) await db('contacts').insert({ company_id: companyId, email, name: hrName, role, score: Math.round(scoreEmail(email)) });
                }
                added++;
            } catch { skipped++; }
        }
        res.json({ message: `Import complete: ${added} imported, ${skipped} skipped`, added, skipped });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Dynamic /:id routes AFTER all static routes ─────────────────────────────

// GET all companies
router.get('/', async (req, res) => {
    try {
        const { search, status, limit = 200 } = req.query;
        let query = db('companies as c').select(
            'c.*',
            db.raw(`(SELECT email FROM contacts WHERE company_id = c.id ORDER BY score DESC LIMIT 1) as best_email`),
            db.raw(`(SELECT name FROM contacts WHERE company_id = c.id ORDER BY score DESC LIMIT 1) as hr_name`),
            db.raw(`(SELECT score FROM contacts WHERE company_id = c.id ORDER BY score DESC LIMIT 1) as email_score`),
            db.raw(`(SELECT COUNT(*) FROM contacts WHERE company_id = c.id) as email_count`)
        ).orderBy('c.created_at', 'desc').limit(parseInt(limit));

        if (search) query = query.where(b => b.whereLike('c.name', `%${search}%`).orWhereLike('c.website', `%${search}%`));
        if (status) query = query.where('c.status', status);

        const companies = await query;
        const total = companies.length;
        res.json({ companies, total });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create company
router.post('/', async (req, res) => {
    try {
        const { name, website, industry, city, notes, email, hr_name, role } = req.body;
        if (!name) return res.status(400).json({ error: 'Company name is required' });
        const [id] = await db('companies').insert({ name, website: website || '', industry: industry || 'IT', city: city || '', notes: notes || '' });
        if (email) {
            await db('contacts').insert({ company_id: id, email: email.toLowerCase().trim(), name: hr_name || '', role: role || '', score: Math.round(scoreEmail(email)) });
        }
        res.json({ id, message: 'Company added successfully' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single company
router.get('/:id', async (req, res) => {
    try {
        const company = await db('companies').where('id', req.params.id).first();
        if (!company) return res.status(404).json({ error: 'Company not found' });
        const contacts = await db('contacts').where('company_id', req.params.id).orderBy('score', 'desc');
        res.json({ ...company, contacts });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update company
router.put('/:id', async (req, res) => {
    try {
        const { name, website, industry, city, status, notes } = req.body;
        await db('companies').where('id', req.params.id).update({ name, website, industry, city, status, notes, updated_at: db.fn.now() });
        res.json({ message: 'Updated successfully' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE company
router.delete('/:id', async (req, res) => {
    try {
        await db('companies').where('id', req.params.id).delete();
        res.json({ message: 'Deleted successfully' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST add contact to company
router.post('/:id/contacts', async (req, res) => {
    try {
        const { email, name, role } = req.body;
        await db('contacts').insert({ company_id: req.params.id, email, name: name || '', role: role || '', score: Math.round(scoreEmail(email)) });
        res.json({ message: 'Contact added' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE contact
router.delete('/contacts/:contactId', async (req, res) => {
    try {
        await db('contacts').where('id', req.params.contactId).delete();
        res.json({ message: 'Contact deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
