const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const SKIP = new Set([
    'google.com','youtube.com','facebook.com','twitter.com','linkedin.com',
    'instagram.com','wikipedia.org','quora.com','reddit.com','medium.com',
    'glassdoor.com','indeed.com','naukri.com','ambitionbox.com','justdial.com',
    'indiamart.com','sulekha.com','crunchbase.com','yelp.com','tripadvisor.com',
    'github.com','pinterest.com','trustpilot.com','zaubacorp.com','tofler.in',
    'fundoodata.com','play.google.com','apps.apple.com','maps.google.com',
]);

function getDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; }
}
function isCompanySite(url) {
    const d = getDomain(url);
    if (!d) return false;
    if (SKIP.has(d) || [...SKIP].some(s => d.includes(s))) return false;
    if (/\.(gov|edu|mil)(\.|$)/.test(d)) return false;
    return true;
}
function cleanName(t, domain) {
    if (!t || t.length < 2) return domain ? domain.split('.')[0] : 'Unknown';
    return t.split(/[-|–—:·]/)[0].replace(/^(Welcome to|Home|About)\s*/i, '').trim().slice(0, 80) || domain?.split('.')[0] || 'Unknown';
}

// ─── Strategy 1: Google Maps scraping (Puppeteer) ─────────────────────────
async function scrapeGoogleMaps(query, maxResults, onProgress, cancelToken) {
    const results = [];
    const seen = new Set();
    let browser;
    try {
        if (onProgress) onProgress({ step: 'launching', message: 'Starting browser for Google Maps...' });
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
                   '--disable-blink-features=AutomationControlled','--window-size=1280,900'],
        });
        const page = await browser.newPage();
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
        await page.setUserAgent(UA);
        await page.setViewport({ width: 1280, height: 900 });

        const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
        if (onProgress) onProgress({ step: 'searching', message: `Opening Google Maps: "${query}"` });
        await page.goto(mapsUrl, { waitUntil: 'networkidle2', timeout: 25000 });
        await new Promise(r => setTimeout(r, 2000));

        // Dismiss cookie consent
        for (const sel of ['button[aria-label="Accept all"]', '#L2AGLb', 'form[action*="consent"] button']) {
            const btn = await page.$(sel);
            if (btn) { await btn.click(); await new Promise(r => setTimeout(r, 2000)); break; }
        }

        // Wait for feed
        const feedSel = 'div[role="feed"]';
        try { await page.waitForSelector(feedSel, { timeout: 8000 }); } catch {
            if (onProgress) onProgress({ step: 'page_error', message: 'Maps results feed not found' });
            return results;
        }

        // Scroll feed to load businesses
        const scrollTimes = Math.min(Math.ceil(maxResults / 7), 15);
        for (let s = 0; s < scrollTimes; s++) {
            if (cancelToken?.cancelled) break;
            if (onProgress) onProgress({ step: 'scrolling', message: `Scrolling maps results (${s + 1}/${scrollTimes})...` });
            await page.evaluate((sel) => {
                const feed = document.querySelector(sel);
                if (feed) feed.scrollTop = feed.scrollHeight;
            }, feedSel);
            await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
        }

        // Collect place links
        const placeLinks = await page.evaluate(() => {
            const links = [];
            document.querySelectorAll('a[href*="/maps/place/"]').forEach(a => {
                const label = a.getAttribute('aria-label');
                if (label && a.href && !links.some(l => l.href === a.href)) {
                    links.push({ href: a.href, label });
                }
            });
            return links;
        });

        if (onProgress) onProgress({ step: 'found_links', message: `Found ${placeLinks.length} businesses on Maps. Extracting details...`, count: placeLinks.length });

        // Visit each place to get website & phone
        for (let i = 0; i < Math.min(placeLinks.length, maxResults); i++) {
            if (cancelToken?.cancelled) break;
            const pl = placeLinks[i];
            try {
                await page.goto(pl.href, { waitUntil: 'domcontentloaded', timeout: 12000 });
                await new Promise(r => setTimeout(r, 800 + Math.random() * 600));

                const info = await page.evaluate(() => {
                    const get = (sel) => { const el = document.querySelector(sel); return el ? el.textContent.trim() : ''; };
                    const getHref = (sel) => { const el = document.querySelector(sel); return el ? el.href || '' : ''; };
                    // Website: data-item-id="authority"
                    const websiteEl = document.querySelector('a[data-item-id="authority"]');
                    const website = websiteEl ? websiteEl.href : '';
                    // Phone
                    const phoneEl = document.querySelector('button[data-item-id^="phone:"]');
                    const phone = phoneEl ? phoneEl.getAttribute('data-item-id').replace('phone:tel:', '') : '';
                    // Address
                    const addrEl = document.querySelector('button[data-item-id="address"]');
                    const address = addrEl ? addrEl.textContent.trim() : '';
                    // Name from h1
                    const name = document.querySelector('h1')?.textContent?.trim() || '';
                    // Category
                    const catEl = document.querySelector('button[jsaction*="category"]');
                    const category = catEl ? catEl.textContent.trim() : '';
                    // Rating
                    const ratingEl = document.querySelector('div[role="img"][aria-label*="star"]');
                    const rating = ratingEl ? ratingEl.getAttribute('aria-label') : '';
                    return { name, website, phone, address, category, rating };
                });

                const domain = getDomain(info.website);
                if (info.website && domain && !seen.has(domain)) {
                    seen.add(domain);
                    let origin; try { origin = new URL(info.website).origin; } catch { origin = info.website; }
                    const entry = {
                        name: info.name || cleanName(pl.label, domain),
                        website: origin,
                        domain,
                        phone: info.phone || '',
                        address: info.address || '',
                        category: info.category || '',
                        rating: info.rating || '',
                        source: 'Google Maps',
                    };
                    results.push(entry);
                    if (onProgress) onProgress({ step: 'found', count: results.length, latest: entry, message: `[Maps] ${entry.name} → ${domain}` });
                } else if (info.name && !seen.has(info.name)) {
                    // Company without website — still useful
                    seen.add(info.name);
                    const entry = {
                        name: info.name,
                        website: '',
                        domain: '',
                        phone: info.phone || '',
                        address: info.address || '',
                        category: info.category || '',
                        rating: info.rating || '',
                        source: 'Google Maps (no website)',
                    };
                    results.push(entry);
                    if (onProgress) onProgress({ step: 'found', count: results.length, latest: entry, message: `[Maps] ${entry.name} (no website)` });
                }
            } catch (err) {
                // Skip this place
            }
        }
    } catch (err) {
        console.error('Google Maps error:', err.message);
        if (onProgress) onProgress({ step: 'page_error', message: `Maps error: ${err.message}` });
    } finally {
        if (browser) await browser.close();
    }
    return results;
}

// ─── Strategy 2: DuckDuckGo HTML (no browser, pure HTTP) ──────────────────
async function scrapeDuckDuckGo(query, seen, results, onProgress) {
    if (onProgress) onProgress({ step: 'searching', message: 'Searching DuckDuckGo for more results...' });
    try {
        const res = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            headers: { 'User-Agent': UA }, timeout: 12000,
        });
        const $ = cheerio.load(res.data);
        $('.result').each((_, el) => {
            const a = $(el).find('.result__a');
            let href = a.attr('href') || '';
            const title = a.text().trim();
            const snippet = $(el).find('.result__snippet').text().trim();
            // Resolve DDG redirect links
            if (href.includes('uddg=')) href = decodeURIComponent(href.split('uddg=')[1]?.split('&')[0] || '');
            if (!href.startsWith('http')) return;
            if (!isCompanySite(href)) return;
            const domain = getDomain(href);
            if (!domain || seen.has(domain)) return;
            seen.add(domain);
            let origin; try { origin = new URL(href).origin; } catch { origin = href; }
            const entry = { name: cleanName(title, domain), website: origin, domain, phone: '', address: '', category: '', rating: '', source: 'DuckDuckGo' };
            results.push(entry);
            if (onProgress) onProgress({ step: 'found', count: results.length, latest: entry, message: `[DDG] ${entry.name} → ${domain}` });
        });
    } catch (err) { console.error('DDG error:', err.message); }
}

// ─── Strategy 3: Bing HTML (no browser, pure HTTP) ────────────────────────
async function scrapeBing(query, seen, results, onProgress) {
    if (onProgress) onProgress({ step: 'searching', message: 'Searching Bing for more results...' });
    try {
        const res = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(query)}&count=30`, {
            headers: { 'User-Agent': UA }, timeout: 12000,
        });
        const $ = cheerio.load(res.data);
        $('.b_algo').each((_, el) => {
            const a = $(el).find('h2 a');
            const href = a.attr('href') || '';
            const title = a.text().trim();
            const snippet = $(el).find('.b_caption p').text().trim();
            if (!href.startsWith('http') || !isCompanySite(href)) return;
            const domain = getDomain(href);
            if (!domain || seen.has(domain)) return;
            seen.add(domain);
            let origin; try { origin = new URL(href).origin; } catch { origin = href; }
            const entry = { name: cleanName(title, domain), website: origin, domain, phone: '', address: '', category: '', rating: '', source: 'Bing' };
            results.push(entry);
            if (onProgress) onProgress({ step: 'found', count: results.length, latest: entry, message: `[Bing] ${entry.name} → ${domain}` });
        });
    } catch (err) { console.error('Bing error:', err.message); }
}

// ─── Main orchestrator ────────────────────────────────────────────────────
async function discoverCompanies(query, maxResults, onProgress, cancelToken) {
    if (!cancelToken) cancelToken = { cancelled: false };
    const results = [];
    const seen = new Set();

    // 1. Try Google Maps first (most accurate for local businesses)
    const mapsResults = await scrapeGoogleMaps(query, maxResults || 50, onProgress, cancelToken);
    for (const r of mapsResults) { results.push(r); seen.add(r.domain || r.name); }

    // 2. If Maps got < 5 results, supplement with DuckDuckGo
    if (results.length < 5 && !cancelToken.cancelled) {
        await scrapeDuckDuckGo(query, seen, results, onProgress);
    }

    // 3. If still < 5, try Bing
    if (results.length < 5 && !cancelToken.cancelled) {
        await scrapeBing(query, seen, results, onProgress);
    }

    if (onProgress) onProgress({ step: 'done', count: results.length, message: `Discovery complete: ${results.length} companies found` });
    return results;
}

module.exports = { discoverCompanies };
