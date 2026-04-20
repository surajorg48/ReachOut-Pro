const { marked } = require('marked');

/**
 * Renders an email template with given variables
 * @param {string} template - Markdown template string with {{placeholders}}
 * @param {object} vars - Variables to replace
 * @returns {{ html: string, text: string }}
 */
function renderTemplate(template, vars = {}) {
    // Merge with defaults
    const defaults = {
        company_name: 'Your Company',
        hr_name: 'Hiring Team',
        position: 'a suitable role',
        date: new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
        applicant_name: 'Suraj Choudhari',
        applicant_email: 'surajorg47@gmail.com',
        applicant_phone: '',
        applicant_linkedin: '',
        applicant_github: '',
    };

    const merged = { ...defaults, ...vars };

    // Replace all {{key}} or {{key | "fallback"}} patterns
    let rendered = template.replace(/\{\{(\w+)(?:\s*\|\s*"([^"]*)")?\}\}/g, (match, key, fallback) => {
        const val = merged[key];
        if (val !== undefined && val !== '') return val;
        if (fallback !== undefined) return fallback;
        return match; // keep original if no value
    });

    // Convert markdown to HTML
    const html = marked(rendered);

    // Plain text version (strip markdown)
    const text = rendered
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/#{1,6}\s/g, '')
        .replace(/---/g, '---');

    return { html, text };
}

module.exports = { renderTemplate };
