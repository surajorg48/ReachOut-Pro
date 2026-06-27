const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const { filterAndScoreEmails } = require('../utils/emailScorer');

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Phone regex: handles +91, Indian 10-digit, international formats
const PHONE_REGEX = /(?:(?:\+|00)(?:91|1|44|61|49|33|86|81)\s?[\-.]?)?(?:\(?\d{2,4}\)?[\s.\-]?)?\d{3,5}[\s.\-]?\d{3,5}(?:[\s.\-]?\d{0,5})?/g;

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

function randomDelay(min = 800, max = 2500) {
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
        return u.origin;
    } catch {
        return null;
    }
}

function extractPhones(text) {
    const raw = text.match(PHONE_REGEX) || [];
    return [...new Set(
        raw
            .map(p => p.replace(/\s+/g, ' ').trim())
            .filter(p => {
                const digits = p.replace(/\D/g, '');
                return digits.length >= 7 && digits.length <= 15;
            })
    )];
}

async function extractFromHtml(html, sourceUrl) {
    const $ = cheerio.load(html);
    $('script, style').remove();
    const text = $.text();

    const mailtos = [];
    $('a[href^="mailto:"]').each((_, el) => {
        const href = $(el).attr('href');
        const email = href.replace('mailto:', '').split('?')[0].trim();
        if (email) mailtos.push(email);
    });

    const textEmails = text.match(EMAIL_REGEX) || [];
    const allEmails = [...new Set([...mailtos, ...textEmails])];
    const emails = filterAndScoreEmails(allEmails).map(e => ({ ...e, source_url: sourceUrl }));

    const telPhones = [];
    $('a[href^="tel:"]').each((_, el) => {
        const href = $(el).attr('href');
        const p = href.replace('tel:', '').trim();
        if (p) telPhones.push(p);
    });
    const textPhones = extractPhones(text);
    const phones = [...new Set([...telPhones, ...textPhones])];

    return { emails, phones };
}

async function scrapeWithAxios(url, signal) {
    try {
        const res = await axios.get(url, {
            timeout: 15000,
            signal,
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

/**
 * Scrape a single company website.
 * @param {string} website
 * @param {Function} onProgress
 * @param {{ cancelled: boolean }} cancelToken
 */
async function scrapeCompany(website, onProgress, cancelToken) {
    if (!cancelToken) cancelToken = { cancelled: false };
    const base = normalizeUrl(website);
    if (!base) return { emails: [], phones: [], error: 'Invalid URL' };

    const allEmails = [];
    const allPhones = [];
    const visitedUrls = new Set([base]);
    let browser = null;
    const abortController = new AbortController();

    const cancelInterval = setInterval(() => {
        if (cancelToken.cancelled) abortController.abort();
    }, 300);

    try {
        if (cancelToken.cancelled) return { emails: [], phones: [], cancelled: true };
        if (onProgress) onProgress({ step: 'visiting', url: base });

        let html = await scrapeWithAxios(base, abortController.signal);
        if (html) {
            const { emails, phones } = await extractFromHtml(html, base);
            allEmails.push(...emails);
            allPhones.push(...phones);
        }

        for (const pattern of CONTACT_PAGE_PATTERNS) {
            if (cancelToken.cancelled) break;
            const pageUrl = base + pattern;
            if (visitedUrls.has(pageUrl)) continue;
            visitedUrls.add(pageUrl);
            await randomDelay(300, 1000);
            if (cancelToken.cancelled) break;
            if (onProgress) onProgress({ step: 'visiting', url: pageUrl });
            html = await scrapeWithAxios(pageUrl, abortController.signal);
            if (html) {
                const { emails, phones } = await extractFromHtml(html, pageUrl);
                allEmails.push(...emails);
                allPhones.push(...phones);
            }
        }

        if (allEmails.length === 0 && !cancelToken.cancelled) {
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
                const { emails, phones } = await extractFromHtml(content, base);
                allEmails.push(...emails);
                allPhones.push(...phones);
                for (const pattern of CONTACT_PAGE_PATTERNS.slice(0, 3)) {
                    if (cancelToken.cancelled) break;
                    try {
                        const pageUrl = base + pattern;
                        await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 15000 });
                        await randomDelay(500, 1500);
                        const c = await page.content();
                        const { emails: e, phones: ph } = await extractFromHtml(c, pageUrl);
                        allEmails.push(...e);
                        allPhones.push(...ph);
                    } catch { }
                }
            } catch { }
        }
    } finally {
        clearInterval(cancelInterval);
        if (browser) await browser.close();
    }

    const seenEmails = new Set();
    const uniqueEmails = allEmails.filter(e => {
        if (seenEmails.has(e.email)) return false;
        seenEmails.add(e.email);
        return true;
    });

    return {
        emails: uniqueEmails.sort((a, b) => b.score - a.score),
        phones: [...new Set(allPhones)],
    };
}

module.exports = { scrapeCompany, normalizeUrl };
