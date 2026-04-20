const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { getAuthenticatedClient } = require('./gmail.service');
const { renderTemplate } = require('../utils/templateRenderer');

/**
 * Creates authenticated Nodemailer transporter using Gmail OAuth2
 */
async function createTransporter() {
    const auth = getAuthenticatedClient();
    const { token } = await auth.getAccessToken();

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: process.env.SENDER_EMAIL,
            clientId: auth._clientId,
            clientSecret: auth._clientSecret,
            refreshToken: auth.credentials.refresh_token,
            accessToken: token,
        },
    });
}

/**
 * Sends a single job-application email
 */
async function sendEmail({ to, toName, companyName, subject, templateContent, resumePath, campaignVars = {} }) {
    const transporter = await createTransporter();

    // Render template
    const vars = {
        company_name: companyName || 'Your Company',
        hr_name: toName || 'Hiring Team',
        ...campaignVars,
    };

    const { html, text } = renderTemplate(templateContent, vars);

    // Build attachments
    const attachments = [];
    const resolvedResumePath = path.resolve(resumePath || process.env.RESUME_PATH);
    if (fs.existsSync(resolvedResumePath)) {
        attachments.push({
            filename: path.basename(resolvedResumePath),
            path: resolvedResumePath,
        });
    }

    const mailOptions = {
        from: `"${campaignVars.applicant_name || 'Suraj Choudhari'}" <${process.env.SENDER_EMAIL}>`,
        to: toName ? `"${toName}" <${to}>` : to,
        subject: subject,
        html,
        text,
        attachments,
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
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
                    applicant_name: settings.applicant_name || 'Suraj Choudhari',
                    applicant_email: settings.sender_email || process.env.SENDER_EMAIL,
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
