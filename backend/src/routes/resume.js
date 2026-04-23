const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parseResume, extractResumeInfo, generateEmailTemplate } = require('../services/resume.service');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only PDF, JPG, PNG, WebP files are supported'));
    }
});

// POST /api/resume/parse
// Upload resume, parse it, extract info, generate email template
router.post('/parse', upload.single('resume'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded. Please upload a PDF or image.' });

    try {
        // Call AI layout parsing API
        const { markdown, rawResult } = await parseResume(req.file.buffer, req.file.mimetype);

        if (!markdown || markdown.trim().length < 10) {
            return res.status(422).json({ error: 'Could not extract text from the file. Please try a clearer PDF or image.' });
        }

        // Extract structured info from markdown
        const info = extractResumeInfo(markdown);

        // Generate a custom email template based on the resume
        const position = req.body.position || 'a Software Developer role';
        const emailTemplate = generateEmailTemplate(info, position);

        res.json({
            success: true,
            markdown,
            info,
            emailTemplate,
            message: 'Resume parsed successfully!',
        });
    } catch (err) {
        console.error('Resume parse error:', err.message);
        if (err.response?.status === 401) return res.status(500).json({ error: 'API authentication failed. Check the token.' });
        if (err.response?.status === 429) return res.status(500).json({ error: 'API rate limit reached. Please wait a moment and try again.' });
        res.status(500).json({ error: `Parse failed: ${err.message}` });
    }
});

// POST /api/resume/generate-template
// Generate email template from already-extracted info (no re-parse needed)
router.post('/generate-template', (req, res) => {
    const { info, position } = req.body;
    if (!info) return res.status(400).json({ error: 'Resume info is required' });
    try {
        const template = generateEmailTemplate(info, position || 'a suitable role');
        res.json({ template });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
