const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const { filterAndScoreEmails } = require('../utils/emailScorer');

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const CONTACT_PAGE_PATTERNS = [
    '/contact', '/contact-us', '/contactus', '/careers', '/jobs',
    '/about', '/about-us', '/team', '/hire', '/work-with-us',
    '/hr', '/recruitment', '/people',
];

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

function randomDelay(min = 1500, max = 4000) {
    return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

function randomAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function normalizeUrl(url) {
    if (!url) return null;
    url = url.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    try {
        const u = new URL(url);
        return u.origin; // Just the base URL
    } catch {
        return null;
    }
}

async function extractEmailsFromHtml(html, sourceUrl) {
    const $ = cheerio.load(html);

    // Remove script and style tags
    $('script, style').remove();
    const text = $.text();

    // Also extract from mailto links
    const mailtos = [];
    $('a[href^="mailto:"]').each((_, el) => {
        const href = $(el).attr('href');
        const email = href.replace('mailto:', '').split('?')[0].trim();
        if (email) mailtos.push(email);
    });

    // Find all emails in text
    const textEmails = text.match(EMAIL_REGEX) || [];
    const allEmails = [...new Set([...mailtos, ...textEmails])];

    return filterAndScoreEmails(allEmails).map(e => ({ ...e, source_url: sourceUrl }));
}

async function scrapeWithAxios(url) {
    try {
        const res = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': randomAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });
        return res.data;
    } catch {
        return null;
    }
}

async function scrapeCompany(website, onProgress) {
    const base = normalizeUrl(website);
    if (!base) return { emails: [], error: 'Invalid URL' };

    const allEmails = [];
    const visitedUrls = new Set();
    let browser = null;

    try {
        // First try Axios (faster, no JS rendering)
        if (onProgress) onProgress({ step: 'visiting', url: base });

        let html = await scrapeWithAxios(base);
        if (html) {
            const emails = await extractEmailsFromHtml(html, base);
            allEmails.push(...emails);
        }

        // Try contact sub-pages
        for (const pattern of CONTACT_PAGE_PATTERNS) {
            const pageUrl = base + pattern;
            if (visitedUrls.has(pageUrl)) continue;
            visitedUrls.add(pageUrl);

            await randomDelay(500, 1500);
            if (onProgress) onProgress({ step: 'visiting', url: pageUrl });

            html = await scrapeWithAxios(pageUrl);
            if (html) {
                const emails = await extractEmailsFromHtml(html, pageUrl);
                allEmails.push(...emails);
            }
        }

        // If no emails found, try with Puppeteer (JS-rendered pages)
        if (allEmails.length === 0) {
            if (onProgress) onProgress({ step: 'deep_scrape', url: base });

            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            });
            const page = await browser.newPage();
            await page.setUserAgent(randomAgent());

            try {
                await page.goto(base, { waitUntil: 'networkidle2', timeout: 20000 });
                const content = await page.content();
                const emails = await extractEmailsFromHtml(content, base);
                allEmails.push(...emails);

                // Try contact page with puppeteer
                for (const pattern of CONTACT_PAGE_PATTERNS.slice(0, 3)) {
                    try {
                        const pageUrl = base + pattern;
                        await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 15000 });
                        await randomDelay(1000, 2000);
                        const c = await page.content();
                        const e = await extractEmailsFromHtml(c, pageUrl);
                        allEmails.push(...e);
                    } catch { /* skip */ }
                }
            } catch (err) {
                // ignore navigation errors
            }
        }
    } finally {
        if (browser) await browser.close();
    }

    // Deduplicate by email
    const seen = new Set();
    const unique = allEmails.filter(e => {
        if (seen.has(e.email)) return false;
        seen.add(e.email);
        return true;
    });

    return { emails: unique.sort((a, b) => b.score - a.score) };
}

module.exports = { scrapeCompany, normalizeUrl };
