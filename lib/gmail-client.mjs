import fs from 'fs';
import path from 'path';
import { homedir } from 'os';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_DIR = path.join(homedir(), '.config/google-calendar-mcp');
const ACTIVE_ACCOUNT_FILE = path.join(TOKEN_DIR, '.active-account');

function resolveAccountMode() {
  if (process.env.ACCOUNT_MODE) return process.env.ACCOUNT_MODE;
  try {
    return fs.readFileSync(ACTIVE_ACCOUNT_FILE, 'utf-8').trim();
  } catch {
    return 'normal';
  }
}

/**
 * Creates an authenticated Gmail client.
 *
 * Account resolution order:
 * 1. ACCOUNT_MODE env var
 * 2. ~/.config/google-calendar-mcp/.active-account file (set by switch-account.mjs)
 * 3. Default: 'normal'
 *
 * @returns {Object} Gmail API client authenticated and ready for requests
 * @throws {Error} If token file is missing, credentials are invalid, or token for account mode not found
 */
export function createGmailClient() {
  const TOKEN_PATH = path.join(TOKEN_DIR, 'tokens-gmail.json');
  const credPath = process.env.GOOGLE_OAUTH_CREDENTIALS || './gcp-oauth.keys.json';

  const tokenFileData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  const credData = JSON.parse(fs.readFileSync(credPath, 'utf-8'));

  const accountMode = resolveAccountMode();
  const tokenData = tokenFileData[accountMode];

  if (!tokenData) {
    throw new Error(`No token found for account mode: ${accountMode}`);
  }

  const oauth2Client = new OAuth2Client(
    credData.installed.client_id,
    credData.installed.client_secret,
    credData.installed.redirect_uris[0]
  );
  oauth2Client.setCredentials(tokenData);
  oauth2Client.on('tokens', (newTokens) => {
    persistRefreshedTokens(TOKEN_PATH, accountMode, newTokens);
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function persistRefreshedTokens(tokenPath, accountMode, newTokens) {
  try {
    // Re-read so a concurrent script's writes for other accounts aren't clobbered
    const fileData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    fileData[accountMode] = {
      ...fileData[accountMode],
      ...newTokens,
      // Google omits refresh_token on refresh responses; keep the stored one
      refresh_token: newTokens.refresh_token || fileData[accountMode]?.refresh_token,
    };
    fs.writeFileSync(tokenPath, JSON.stringify(fileData, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error(`Failed to persist refreshed tokens for ${accountMode}: ${err.message}`);
  }
}
