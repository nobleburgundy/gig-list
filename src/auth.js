const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const TOKENS_FILE = path.join(__dirname, '..', 'data', 'tokens.json');
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

function getOAuthClient() {
  const port = process.env.PORT || 3000;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `http://localhost:${port}/auth/callback`
  );
}

function getAuthUrl() {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

function loadTokens() {
  if (!fs.existsSync(TOKENS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

function clearTokens() {
  if (fs.existsSync(TOKENS_FILE)) fs.unlinkSync(TOKENS_FILE);
}

async function getAuthenticatedClient() {
  const tokens = loadTokens();
  if (!tokens) return null;

  const client = getOAuthClient();
  client.setCredentials(tokens);

  // Auto-save refreshed tokens
  client.on('tokens', (newTokens) => {
    const current = loadTokens() || {};
    saveTokens({ ...current, ...newTokens });
  });

  return client;
}

module.exports = { getOAuthClient, getAuthUrl, loadTokens, saveTokens, clearTokens, getAuthenticatedClient };
