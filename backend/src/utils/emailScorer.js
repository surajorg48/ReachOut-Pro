/**
 * Email Scorer Utility
 * Scores email addresses by likelihood they belong to HR/Recruiting
 */

const HIGH_PRIORITY = ['hr', 'recruit', 'careers', 'career', 'hiring', 'jobs', 'talent', 'people'];
const MEDIUM_PRIORITY = ['info', 'contact', 'hello', 'team', 'office', 'admin', 'work'];
const LOW_PRIORITY = ['support', 'help', 'sales', 'marketing', 'service'];
const BLACKLIST = ['noreply', 'no-reply', 'donotreply', 'bounce', 'mailer-daemon', 'example', 'test'];

function scoreEmail(email) {
    if (!email) return 0;
    const lower = email.toLowerCase();
    const prefix = lower.split('@')[0];

    // Blacklist check
    if (BLACKLIST.some(b => prefix.includes(b))) return 0;

    // Score by prefix
    if (HIGH_PRIORITY.some(h => prefix.includes(h))) return 90 + Math.random() * 10;
    if (MEDIUM_PRIORITY.some(m => prefix.includes(m))) return 55 + Math.random() * 10;
    if (LOW_PRIORITY.some(l => prefix.includes(l))) return 20 + Math.random() * 10;

    // Generic personal email (like firstname.lastname@)
    if (/^[a-z]+\.[a-z]+$/.test(prefix)) return 60 + Math.random() * 10;

    return 35 + Math.random() * 10;
}

function filterAndScoreEmails(emails) {
    return emails
        .map(email => ({ email: email.toLowerCase().trim(), score: Math.round(scoreEmail(email)) }))
        .filter(e => e.score > 0)
        .sort((a, b) => b.score - a.score);
}

function getBestEmail(emails) {
    const scored = filterAndScoreEmails(emails);
    return scored.length > 0 ? scored[0] : null;
}

module.exports = { scoreEmail, filterAndScoreEmails, getBestEmail };
