const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];

/**
 * Discovers company websites by searching Google with Puppeteer.
 * Returns an array of { name, website, snippet } objects.
 * @param {string} query - e.g. "IT companies in Pune"
 * @param {number} maxPages - Google result pages to scan (each ≈ 10 results)
 * @param {Function} onProgress - progress callback
 * @param {{ cancelled: boolean }} cancelToken
 */
async function discoverCompanies(query, maxPages = 3, onProgress, cancelToken) {
    if (!cancelToken) cancelToken = { cancelled: false };
    const results = [];
    const seenDomains = new Set();
    let browser = null;

    // Domains to skip (not company websites)
    const SKIP_DOMAINS = [
        'google.com', 'google.co.in', 'youtube.com', 'facebook.com', 'twitter.com',
        'linkedin.com', 'instagram.com', 'wikipedia.org', 'quora.com', 'reddit.com',
        'medium.com', 'glassdoor.com', 'glassdoor.co.in', 'indeed.com', 'naukri.com',
        'ambitionbox.com', 'justdial.com', 'indiamart.com', 'sulekha.com',
        'yellowpages.com', 'crunchbase.com', 'zaubacorp.com', 'tofler.in',
        'fundoodata.com', 'mouthshut.com', 'trustpilot.com', 'yelp.com',
        'maps.google.com', 'play.google.com', 'apps.apple.com',
    ];

    function isCompanySite(url) {
        try {
            const domain = new URL(url).hostname.replace('www.', '');
            if (SKIP_DOMAINS.some(s => domain.includes(s))) return false;
            if (domain.endsWith('.gov.in') || domain.endsWith('.gov')) return false;
            return true;
        } catch { return false; }
    }

    function getDomain(url) {
        try { return new URL(url).hostname.replace('www.', ''); } catch { return null; }
    }

    try {
        if (onProgress) onProgress({ step: 'launching', message: 'Starting browser for Google search...' });

        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]);
        await page.setViewport({ width: 1280, height: 800 });

        for (let p = 0; p < maxPages; p++) {
            if (cancelToken.cancelled) break;

            const start = p * 10;
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}&num=10`;

            if (onProgress) onProgress({ step: 'searching', page: p + 1, maxPages, message: `Searching Google page ${p + 1}/${maxPages}...` });

            try {
                await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 });
                // Wait a bit to avoid captchas
                await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));

                const content = await page.content();
                const $ = cheerio.load(content);

                // Extract search result links
                $('a[href]').each((_, el) => {
                    const href = $(el).attr('href') || '';
                    let url = null;

                    // Google wraps URLs in /url?q=... format
                    if (href.startsWith('/url?q=')) {
                        url = decodeURIComponent(href.replace('/url?q=', '').split('&')[0]);
                    } else if (href.startsWith('http') && !href.includes('google.com/search')) {
                        url = href;
                    }

                    if (!url || !isCompanySite(url)) return;

                    const domain = getDomain(url);
                    if (!domain || seenDomains.has(domain)) return;
                    seenDomains.add(domain);

                    // Try to get the title/snippet from the parent container
                    const parentBlock = $(el).closest('div');
                    const title = $(el).text().trim().split('\n')[0] || domain;
                    const snippet = parentBlock.find('span').text().trim().slice(0, 200) || '';

                    // Normalize to just origin
                    let origin;
                    try { origin = new URL(url).origin; } catch { origin = url; }

                    const name = title.length > 3 && title.length < 100
                        ? title.replace(/ - .*$/, '').replace(/\|.*$/, '').trim()
                        : domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);

                    results.push({ name, website: origin, domain, snippet: snippet.slice(0, 150) });

                    if (onProgress) onProgress({
                        step: 'found',
                        count: results.length,
                        latest: { name, website: origin },
                        message: `Found: ${name} (${domain})`,
                    });
                });

            } catch (err) {
                if (onProgress) onProgress({ step: 'page_error', page: p + 1, error: err.message });
            }

            // Delay between pages to avoid captcha
            if (p < maxPages - 1 && !cancelToken.cancelled) {
                await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
            }
        }
    } finally {
        if (browser) await browser.close();
    }

    if (onProgress) onProgress({ step: 'done', count: results.length, message: `Discovery complete: ${results.length} companies found` });

    return results;
}

module.exports = { discoverCompanies };
