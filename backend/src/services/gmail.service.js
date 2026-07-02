const { google } = require('googleapis');
const db = require('../db/database');

function buildOAuth2(credsObj) {
    if (!credsObj) throw new Error('Credentials missing.');
    const { client_secret, client_id } = credsObj.installed || credsObj.web;
    // We should ideally use dynamic URL, but local testing is 3001
    // The redirect URI must match exactly what's in the credentials.json
    const REDIRECT_URI = 'http://localhost:3001/auth/callback';
    return new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);
}

// ── Active account helpers ──
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
    await db('settings').where('key', 'active_gmail_account').update({ value: String(accountId) });
    await db('gmail_accounts').update({ is_active: false });
    await db('gmail_accounts').where('id', accountId).update({ is_active: true });
}

// ── Per-account OAuth2 ──
function getAccountOAuth2(account) {
    if (!account.credentials_json) throw new Error('Account has no credentials.');
    const creds = JSON.parse(account.credentials_json);
    return buildOAuth2(creds);
}

function getAuthenticatedClientForAccount(account) {
    const client = getAccountOAuth2(account);
    if (!account.token_json) {
        throw new Error(`Gmail account "${account.email}" is not connected.`);
    }
    const token = JSON.parse(account.token_json);
    client.setCredentials(token);
    client.on('tokens', async (tokens) => {
        const cur = account.token_json ? JSON.parse(account.token_json) : {};
        const newToken = { ...cur, ...tokens };
        account.token_json = JSON.stringify(newToken);
        await db('gmail_accounts').where('id', account.id).update({ token_json: account.token_json });
    });
    return client;
}

// ── Main getAuthenticatedClient (used by email.service) ──
async function getAuthenticatedClient() {
    const active = await getActiveAccount();
    if (active && active.token_json) {
        return getAuthenticatedClientForAccount(active);
    }
    throw new Error('No active connected Gmail account.');
}

// ── Auth flow for new accounts ──
function generateAuthUrl(credsObj) {
    const client = buildOAuth2(credsObj);
    return client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],
        prompt: 'consent',
    });
}

async function handleAuthCallback(code, accountId) {
    const account = await db('gmail_accounts').where('id', accountId).first();
    if (!account) throw new Error('Account not found');
    const creds = JSON.parse(account.credentials_json);
    const client = buildOAuth2(creds);
    const { tokens } = await client.getToken(code);
    await db('gmail_accounts').where('id', accountId).update({ token_json: JSON.stringify(tokens) });
    client.setCredentials(tokens);
    return client;
}

// ── Account CRUD ──
async function addAccount(email, label, credFileOrObj) {
    let credsStr = '';
    if (typeof credFileOrObj === 'string') {
        const fs = require('fs');
        credsStr = fs.readFileSync(credFileOrObj, 'utf8');
        try { fs.unlinkSync(credFileOrObj); } catch {} // Cleanup temp upload
    } else {
        credsStr = JSON.stringify(credFileOrObj);
    }

    const [id] = await db('gmail_accounts').insert({
        email,
        label: label || email,
        credentials_json: credsStr,
        token_json: '',
        is_active: false,
    });
    return { id, email, label };
}

async function removeAccount(accountId) {
    await db('gmail_accounts').where('id', accountId).delete();
    const activeRow = await db('settings').where('key', 'active_gmail_account').first();
    if (activeRow?.value === String(accountId)) {
        await db('settings').where('key', 'active_gmail_account').update({ value: '' });
    }
}

async function disconnectAccount(accountId) {
    await db('gmail_accounts').where('id', accountId).update({ token_json: '' });
}

// Legacy fallback methods for backward compat
async function getStatus() {
    const active = await getActiveAccount();
    return {
        credentialsUploaded: !!active,
        gmailConnected: !!(active && active.token_json),
    };
}

module.exports = {
    getAuthenticatedClient,
    generateAuthUrl,
    handleAuthCallback,
    getStatus,
    addAccount,
    removeAccount,
    disconnectAccount,
    getAllAccounts,
    getActiveAccount,
    setActiveAccount,
    getAccountOAuth2,
    getAuthenticatedClientForAccount,
};
