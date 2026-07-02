const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');

const BASE_CRED_DIR = path.join(__dirname, '../../credentials');
const SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'];

// Legacy single-account paths (kept for backward compat)
const LEGACY_CREDENTIALS = path.join(BASE_CRED_DIR, 'credentials.json');
const LEGACY_TOKEN = path.join(BASE_CRED_DIR, 'token.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function credentialsExist() {
    return fs.existsSync(LEGACY_CREDENTIALS);
}

function tokenExists() {
    return fs.existsSync(LEGACY_TOKEN);
}

function getCredentials(credPath) {
    const p = credPath || LEGACY_CREDENTIALS;
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function buildOAuth2(credPath) {
    const creds = getCredentials(credPath);
    if (!creds) throw new Error('credentials.json not found. Please upload it in Settings.');
    const { client_secret, client_id } = creds.installed || creds.web;
    const REDIRECT_URI = 'http://localhost:3001/auth/callback';
    return new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);
}

// ── Active account helpers ───────────────────────────────────────────────────

async function getActiveAccount() {
    const row = await db('settings').where('key', 'active_gmail_account').first();
    const id = row?.value ? parseInt(row.value) : null;
    if (!id) return null;
    return db('gmail_accounts').where('id', id).first();
}

async function getAllAccounts() {
    return db('gmail_accounts').orderBy('id', 'asc');
}

async function setActiveAccount(accountId) {
    await db('settings').where('key', 'active_gmail_account')
        .update({ value: String(accountId) });
    await db('gmail_accounts').update({ is_active: false });
    await db('gmail_accounts').where('id', accountId).update({ is_active: true });
}

// ── Per-account OAuth2 ───────────────────────────────────────────────────────

function getAccountOAuth2(account) {
    return buildOAuth2(account.credentials_path);
}

function getAuthenticatedClientForAccount(account) {
    const client = getAccountOAuth2(account);
    if (!fs.existsSync(account.token_path)) {
        throw new Error(`Gmail account "${account.email}" is not connected.`);
    }
    const token = JSON.parse(fs.readFileSync(account.token_path, 'utf8'));
    client.setCredentials(token);
    client.on('tokens', (tokens) => {
        const cur = fs.existsSync(account.token_path) ? JSON.parse(fs.readFileSync(account.token_path, 'utf8')) : {};
        fs.writeFileSync(account.token_path, JSON.stringify({ ...cur, ...tokens }, null, 2));
    });
    return client;
}

// ── Main getAuthenticatedClient (used by email.service) ──────────────────────

async function getAuthenticatedClient() {
    // Try active account first
    const active = await getActiveAccount();
    if (active && fs.existsSync(active.token_path)) {
        return getAuthenticatedClientForAccount(active);
    }
    // Fallback to legacy single-account
    const client = buildOAuth2();
    if (!tokenExists()) throw new Error('Gmail not connected. Please complete OAuth flow in Settings.');
    const token = JSON.parse(fs.readFileSync(LEGACY_TOKEN, 'utf8'));
    client.setCredentials(token);
    client.on('tokens', (tokens) => {
        const cur = tokenExists() ? JSON.parse(fs.readFileSync(LEGACY_TOKEN, 'utf8')) : {};
        fs.writeFileSync(LEGACY_TOKEN, JSON.stringify({ ...cur, ...tokens }, null, 2));
    });
    return client;
}

// ── Auth flow for new accounts ───────────────────────────────────────────────

function generateAuthUrl(credPath) {
    const client = buildOAuth2(credPath);
    return client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
    });
}

async function handleAuthCallback(code, credPath, tokenPath) {
    const client = buildOAuth2(credPath);
    const { tokens } = await client.getToken(code);
    ensureDir(path.dirname(tokenPath || LEGACY_TOKEN));
    fs.writeFileSync(tokenPath || LEGACY_TOKEN, JSON.stringify(tokens, null, 2));
    client.setCredentials(tokens);
    return client;
}

// ── Account CRUD ─────────────────────────────────────────────────────────────

async function addAccount(email, label, credFile) {
    // Create a directory for this account
    const slug = email.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dir = path.join(BASE_CRED_DIR, slug);
    ensureDir(dir);

    const credPath = path.join(dir, 'credentials.json');
    const tokenPath = path.join(dir, 'token.json');

    // Save credentials file
    if (typeof credFile === 'string') {
        // It's a file path from multer
        fs.renameSync(credFile, credPath);
    } else {
        fs.writeFileSync(credPath, JSON.stringify(credFile, null, 2));
    }

    // Insert into DB
    const [id] = await db('gmail_accounts').insert({
        email,
        label: label || email,
        credentials_path: credPath,
        token_path: tokenPath,
        is_active: false,
    });

    return { id, email, label, credentials_path: credPath, token_path: tokenPath };
}

async function removeAccount(accountId) {
    const acc = await db('gmail_accounts').where('id', accountId).first();
    if (!acc) throw new Error('Account not found');
    // Delete files
    if (fs.existsSync(acc.credentials_path)) fs.unlinkSync(acc.credentials_path);
    if (fs.existsSync(acc.token_path)) fs.unlinkSync(acc.token_path);
    // Try to remove dir
    const dir = path.dirname(acc.credentials_path);
    try { fs.rmdirSync(dir); } catch { }
    await db('gmail_accounts').where('id', accountId).delete();
    // If was active, clear active
    const activeRow = await db('settings').where('key', 'active_gmail_account').first();
    if (activeRow?.value === String(accountId)) {
        await db('settings').where('key', 'active_gmail_account').update({ value: '' });
    }
}

async function disconnectAccount(accountId) {
    const acc = await db('gmail_accounts').where('id', accountId).first();
    if (!acc) throw new Error('Account not found');
    if (fs.existsSync(acc.token_path)) fs.unlinkSync(acc.token_path);
}

function disconnectGmail() {
    if (tokenExists()) fs.unlinkSync(LEGACY_TOKEN);
}

function getStatus() {
    return {
        credentialsUploaded: credentialsExist(),
        gmailConnected: tokenExists(),
    };
}

function getToken() {
    if (!tokenExists()) return null;
    return JSON.parse(fs.readFileSync(LEGACY_TOKEN, 'utf8'));
}

module.exports = {
    getAuthenticatedClient,
    generateAuthUrl,
    handleAuthCallback,
    disconnectGmail,
    getStatus,
    credentialsExist,
    tokenExists,
    getCredentials,
    getToken,
    CREDENTIALS_PATH: LEGACY_CREDENTIALS,
    // Multi-account
    addAccount,
    removeAccount,
    disconnectAccount,
    getAllAccounts,
    getActiveAccount,
    setActiveAccount,
    getAccountOAuth2,
    getAuthenticatedClientForAccount,
    BASE_CRED_DIR,
};
