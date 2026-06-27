const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// Domains to skip (not company websites)
const SKIP_DOMAINS = [
    'google.com', 'google.co.in', 'youtube.com', 'facebook.com', 'twitter.com',
    'linkedin.com', 'instagram.com', 'wikipedia.org', 'quora.com', 'reddit.com',
    'medium.com', 'glassdoor.com', 'glassdoor.co.in', 'indeed.com', 'naukri.com',
    'ambitionbox.com', 'justdial.com', 'indiamart.com', 'sulekha.com',
    'yellowpages.com', 'crunchbase.com', 'zaubacorp.com', 'tofler.in',
    'fundoodata.com', 'mouthshut.com', 'trustpilot.com', 'yelp.com',
    'maps.google.com', 'play.google.com', 'apps.apple.com', 'github.com',
    'pinterest.com', 'tumblr.com', 'tripadvisor.com'
];

function isCompanySite(url) {
    try {
        const domain = new URL(url).hostname.replace('www.', '').toLowerCase();
        if (SKIP_DOMAINS.some(s => domain.includes(s))) return false;
        if (domain.endsWith('.gov.in') || domain.endsWith('.gov') || domain.endsWith('.edu')) return false;
        return true;
    } catch { return false; }
}

function getDomain(url) {
    try { return new URL(url).hostname.replace('www.', '').toLowerCase(); } catch { return null; }
}

function cleanCompanyName(title, domain) {
    if (!title || title.length < 3) {
        return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    }
    // Clean up typical search suffixes
    let cleaned = title
        .split(' - ')[0]
        .split(' | ')[0]
        .split(' : ')[0]
        .split(' – ')[0]
        .trim();
    
    // Remove words like "Home", "Welcome to", "Corporate"
    cleaned = cleaned.replace(/^(Welcome to|Home -|Home page for|Corporate Website of)\s+/i, '');
    
    if (cleaned.length < 3 || cleaned.length > 80) {
        return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    }
    return cleaned;
}

/**
 * Fallback discovery using DuckDuckGo (HTML version) - highly reliable, no cookies blocks
 */
async function discoverDuckDuckGo(query, seenDomains, results, onProgress) {
    if (onProgress) onProgress({ step: 'searching', message: 'Google blocked or returned 0 results. Trying DuckDuckGo fallback...' });
    
    try {
        const response = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        $('.result').each((_, el) => {
            const titleEl = $(el).find('.result__title a');
            const href = titleEl.attr('href') || '';
            const title = titleEl.text().trim();
            const snippet = $(el).find('.result__snippet').text().trim();

            let url = null;
            if (href.startsWith('http')) {
                url = href;
            } else if (href.includes('uddg=')) {
                // DuckDuckGo redirect link
                const parts = href.split('uddg=');
                if (parts[1]) {
                    url = decodeURIComponent(parts[1].split('&')[0]);
                }
            }

            if (!url || !isCompanySite(url)) return;

            const domain = getDomain(url);
            if (!domain || seenDomains.has(domain)) return;
            seenDomains.add(domain);

            let origin;
            try { origin = new URL(url).origin; } catch { origin = url; }

            const name = cleanCompanyName(title, domain);
            const entry = { name, website: origin, domain, snippet: snippet.slice(0, 150) };
            results.push(entry);

            if (onProgress) onProgress({
                step: 'found',
                count: results.length,
                latest: entry,
                message: `Found on DuckDuckGo: ${name} (${domain})`
            });
        });
    } catch (err) {
        console.error('DuckDuckGo fallback error:', err.message);
    }
}

/**
 * Fallback discovery using Bing Search
 */
async function discoverBing(query, seenDomains, results, onProgress) {
    if (onProgress) onProgress({ step: 'searching', message: 'Trying Bing fallback...' });
    
    try {
        const response = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        $('.b_algo').each((_, el) => {
            const titleEl = $(el).find('h2 a');
            const href = titleEl.attr('href') || '';
            const title = titleEl.text().trim();
            const snippet = $(el).find('.b_caption p, .b_lineLimit2').text().trim();

            if (!href || !isCompanySite(href)) return;

            const domain = getDomain(href);
            if (!domain || seenDomains.has(domain)) return;
            seenDomains.add(domain);

            let origin;
            try { origin = new URL(href).origin; } catch { origin = href; }

            const name = cleanCompanyName(title, domain);
            const entry = { name, website: origin, domain, snippet: snippet.slice(0, 150) };
            results.push(entry);

            if (onProgress) onProgress({
                step: 'found',
                count: results.length,
                latest: entry,
                message: `Found on Bing: ${name} (${domain})`
            });
        });
    } catch (err) {
        console.error('Bing fallback error:', err.message);
    }
}

/**
 * Discovers company websites by searching Google with Puppeteer.
 * Returns an array of { name, website, snippet } objects.
 */
async function discoverCompanies(query, maxPages = 3, onProgress, cancelToken) {
    if (!cancelToken) cancelToken = { cancelled: false };
    const results = [];
    const seenDomains = new Set();
    let browser = null;

    try {
        if (onProgress) onProgress({ step: 'launching', message: 'Launching stealth browser...' });

        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        });

        const page = await browser.newPage();
        
        // Remove webdriver fingerprint
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        await page.setUserAgent(USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]);
        await page.setViewport({ width: 1280, height: 800 });

        for (let p = 0; p < maxPages; p++) {
            if (cancelToken.cancelled) break;

            const start = p * 10;
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}&num=10`;

            if (onProgress) onProgress({ step: 'searching', page: p + 1, maxPages, message: `Searching Google page ${p + 1}/${maxPages}...` });

            try {
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));

                // Bypassing Consent screen if any
                const consentSelector = 'button#L2AGLb, button[aria-label="Accept all"], button[aria-label="Agree"], #introAgreeButton';
                const hasConsent = await page.$(consentSelector);
                if (hasConsent) {
                    if (onProgress) onProgress({ step: 'consent', message: 'Bypassing Google cookie consent...' });
                    await page.click(consentSelector);
                    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {});
                }

                // Scroll to load all dynamic content/Maps pack
                await page.evaluate(() => window.scrollBy(0, 800));
                await new Promise(r => setTimeout(r, 500));

                const content = await page.content();
                const $ = cheerio.load(content);

                // Scrape from Maps Local Pack if present
                // Google Maps Local Pack links are usually inside tags with specific classes like [data-lpage] or ab_button, or href containing "/url?q=" to external sites
                $('a').each((_, el) => {
                    const href = $(el).attr('href') || '';
                    const titleText = $(el).text().trim();
                    let url = null;

                    if (href.startsWith('/url?q=')) {
                        url = decodeURIComponent(href.replace('/url?q=', '').split('&')[0]);
                    } else if (href.startsWith('http') && !href.includes('google.com/search')) {
                        url = href;
                    }

                    if (!url || !isCompanySite(url)) return;

                    const domain = getDomain(url);
                    if (!domain || seenDomains.has(domain)) return;
                    seenDomains.add(domain);

                    let origin;
                    try { origin = new URL(url).origin; } catch { origin = url; }

                    const name = cleanCompanyName(titleText, domain);
                    const entry = { name, website: origin, domain, snippet: 'Local Places Listing' };
                    results.push(entry);

                    if (onProgress) onProgress({
                        step: 'found',
                        count: results.length,
                        latest: entry,
                        message: `Found Local Pack: ${name} (${domain})`
                    });
                });

                // Scrape organic results
                $('.g').each((_, el) => {
                    const linkEl = $(el).find('a[href]');
                    if (!linkEl.length) return;

                    const href = linkEl.attr('href') || '';
                    const titleText = $(el).find('h3').text().trim();
                    const snippetText = $(el).find('.VwiC3b, .yD755d, .s3v9zd').text().trim();

                    if (!href || !isCompanySite(href)) return;

                    const domain = getDomain(href);
                    if (!domain || seenDomains.has(domain)) return;
                    seenDomains.add(domain);

                    let origin;
                    try { origin = new URL(href).origin; } catch { origin = href; }

                    const name = cleanCompanyName(titleText || domain, domain);
                    const entry = { name, website: origin, domain, snippet: snippetText.slice(0, 150) };
                    results.push(entry);

                    if (onProgress) onProgress({
                        step: 'found',
                        count: results.length,
                        latest: entry,
                        message: `Found Organic: ${name} (${domain})`
                    });
                });

            } catch (err) {
                if (onProgress) onProgress({ step: 'page_error', page: p + 1, error: err.message });
            }

            if (p < maxPages - 1 && !cancelToken.cancelled) {
                await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));
            }
        }
    } catch (globalErr) {
        console.error('Puppeteer search error:', globalErr.message);
    } finally {
        if (browser) await browser.close();
    }

    // FALLBACK IF WE FOUND NOTHING
    if (results.length === 0 && !cancelToken.cancelled) {
        await discoverDuckDuckGo(query, seenDomains, results, onProgress);
        if (results.length === 0 && !cancelToken.cancelled) {
            await discoverBing(query, seenDomains, results, onProgress);
        }
    }

    if (onProgress) onProgress({ step: 'done', count: results.length, message: `Discovery complete: ${results.length} companies found` });

    return results;
}

module.exports = { discoverCompanies };
