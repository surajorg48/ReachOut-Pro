const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { getAuthenticatedClient } = require('./gmail.service');
const { renderTemplate } = require('../utils/templateRenderer');
const db = require('../db/database');

/**
 * Reads the sender email from DB settings (fallback to env)
 */
async function getSenderEmail() {
    try {
        const row = await db('settings').where('key', 'sender_email').first();
        if (row && row.value) return row.value;
    } catch { }
    return process.env.SENDER_EMAIL || '';
}

/**
 * Encodes a raw RFC 2822 email string to URL-safe base64 for the Gmail API
 */
function encodeEmail(rawEmail) {
    return Buffer.from(rawEmail)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Builds a raw RFC 2822 email string with optional attachment
 */
function buildRawEmail({ from, to, subject, htmlBody, textBody, attachmentPath }) {
    const boundary = `boundary_${Date.now()}`;
    const hasAttachment = attachmentPath && fs.existsSync(attachmentPath);

    let raw = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: multipart/alternative; boundary="alt_${boundary}"`,
        ``,
        `--alt_${boundary}`,
        `Content-Type: text/plain; charset="UTF-8"`,
        ``,
        textBody || '',
        ``,
        `--alt_${boundary}`,
        `Content-Type: text/html; charset="UTF-8"`,
        ``,
        htmlBody || '',
        ``,
        `--alt_${boundary}--`,
    ];

    if (hasAttachment) {
        const filename = path.basename(attachmentPath);
        const data = fs.readFileSync(attachmentPath).toString('base64');
        raw = raw.concat([
            ``,
            `--${boundary}`,
            `Content-Type: application/octet-stream; name="${filename}"`,
            `Content-Disposition: attachment; filename="${filename}"`,
            `Content-Transfer-Encoding: base64`,
            ``,
            data,
        ]);
    }

    raw.push(`--${boundary}--`);
    return raw.join('\r\n');
}

/**
 * Sends a single job-application email using the Gmail REST API directly.
 * This is more reliable than nodemailer OAuth2 transport for Google OAuth2 flows.
 */
async function sendEmail({ to, toName, companyName, subject, templateContent, resumePath, campaignVars = {} }) {
    const auth = getAuthenticatedClient();
    const gmail = google.gmail({ version: 'v1', auth });
    const senderEmail = await getSenderEmail();

    if (!senderEmail) throw new Error('Sender email is not configured. Please set it in Settings.');

    // Render template
    const vars = {
        company_name: companyName || 'Your Company',
        hr_name: toName || 'Hiring Team',
        ...campaignVars,
    };
    const { html, text } = renderTemplate(templateContent, vars);

    // Build attachment path
    const resolvedResumePath = resumePath ? path.resolve(resumePath) : null;

    const fromField = `"${campaignVars.applicant_name || 'Applicant'}" <${senderEmail}>`;
    const toField = toName ? `"${toName}" <${to}>` : to;

    const rawEmail = buildRawEmail({
        from: fromField,
        to: toField,
        subject,
        htmlBody: html,
        textBody: text,
        attachmentPath: resolvedResumePath,
    });

    const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodeEmail(rawEmail) },
    });

    return { success: true, messageId: response.data.id };
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sends emails in bulk with delay
 */
async function sendBulkEmails({ contacts, campaign, settings, onProgress }) {
    const delay = parseInt(settings.send_delay_ms || process.env.SEND_DELAY_MS || 15000);
    const results = [];

    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];

        if (onProgress) {
            onProgress({ index: i, total: contacts.length, email: contact.email, status: 'sending' });
        }

        try {
            const result = await sendEmail({
                to: contact.email,
                toName: contact.name,
                companyName: contact.company_name,
                subject: campaign.subject,
                templateContent: campaign.template_content,
                resumePath: campaign.resume_path,
                campaignVars: {
                    position: campaign.position,
                    applicant_name: settings.applicant_name || '',
                    applicant_email: settings.sender_email || '',
                    applicant_phone: settings.applicant_phone || '',
                    applicant_linkedin: settings.applicant_linkedin || '',
                    applicant_github: settings.applicant_github || '',
                },
            });

            results.push({ ...contact, status: 'sent', messageId: result.messageId });
            if (onProgress) onProgress({ index: i, total: contacts.length, email: contact.email, status: 'sent' });
        } catch (err) {
            results.push({ ...contact, status: 'failed', error: err.message });
            if (onProgress) onProgress({ index: i, total: contacts.length, email: contact.email, status: 'failed', error: err.message });
        }

        // Delay between sends (skip after last)
        if (i < contacts.length - 1) {
            await sleep(delay);
        }
    }

    return results;
}

module.exports = { sendEmail, sendBulkEmails, sleep };
