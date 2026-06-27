const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

const CREDENTIALS_PATH = process.env.CREDENTIALS_PATH || path.join(__dirname, '../../credentials/credentials.json');
const TOKEN_PATH = process.env.TOKEN_PATH || path.join(__dirname, '../../credentials/token.json');
const SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'];

function credentialsExist() {
    return fs.existsSync(CREDENTIALS_PATH);
}

function tokenExists() {
    return fs.existsSync(TOKEN_PATH);
}

function getCredentials() {
    if (!credentialsExist()) return null;
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
}

function getOAuth2Client() {
    const creds = getCredentials();
    if (!creds) throw new Error('credentials.json not found. Please upload it in Settings.');

    const { client_secret, client_id } = creds.installed || creds.web;
    // Always use the server's callback URL regardless of what's in credentials.json
    // Desktop App credentials often have 'urn:ietf:wg:oauth:2.0:oob' which won't work
    const REDIRECT_URI = 'http://localhost:3001/auth/callback';
    return new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);
}

function getAuthenticatedClient() {
    const oAuth2Client = getOAuth2Client();
    if (!tokenExists()) throw new Error('Gmail not connected. Please complete OAuth flow in Settings.');

    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oAuth2Client.setCredentials(token);

    // Auto-refresh token
    oAuth2Client.on('tokens', (tokens) => {
        const current = tokenExists() ? JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')) : {};
        const updated = { ...current, ...tokens };
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(updated, null, 2));
    });

    return oAuth2Client;
}

function generateAuthUrl() {
    const oAuth2Client = getOAuth2Client();
    return oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
    });
}

async function handleAuthCallback(code) {
    const oAuth2Client = getOAuth2Client();
    const { tokens } = await oAuth2Client.getToken(code);

    const credDir = path.dirname(TOKEN_PATH);
    if (!fs.existsSync(credDir)) fs.mkdirSync(credDir, { recursive: true });

    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    oAuth2Client.setCredentials(tokens);
    return oAuth2Client;
}

function disconnectGmail() {
    if (tokenExists()) fs.unlinkSync(TOKEN_PATH);
}

function getStatus() {
    return {
        credentialsUploaded: credentialsExist(),
        gmailConnected: tokenExists(),
    };
}

function getToken() {
    if (!tokenExists()) return null;
    return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
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
    CREDENTIALS_PATH,
};
