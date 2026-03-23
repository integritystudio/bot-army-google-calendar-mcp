import fs from 'fs';
import path from 'path';
import { homedir } from 'os';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

/**
 * Creates an authenticated Gmail client.
 * Reads tokens and credentials from environment-configured paths.
 *
 * Environment variables:
 * - ACCOUNT_MODE: Account key to use (default: 'normal')
 * - GOOGLE_OAUTH_CREDENTIALS: Path to credentials.json (default: './credentials.json')
 *
 * Token file location: ~/.config/google-calendar-mcp/tokens-gmail.json
 *
 * @returns {Object} Gmail API client authenticated and ready for requests
 * @throws {Error} If token file is missing, credentials are invalid, or token for account mode not found
 */
export function createGmailClient() {
  const TOKEN_PATH = path.join(homedir(), '.config/google-calendar-mcp/tokens-gmail.json');
  const tokenFileData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  const accountMode = process.env.ACCOUNT_MODE || 'normal';
  const tokenData = tokenFileData[accountMode];

  if (!tokenData) {
    throw new Error(`No token found for account mode: ${accountMode}`);
  }

  const credPath = process.env.GOOGLE_OAUTH_CREDENTIALS || './credentials.json';
  const credData = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
  const oauth2Client = new OAuth2Client(
    credData.installed.client_id,
    credData.installed.client_secret,
    credData.installed.redirect_uris[0]
  );
  oauth2Client.setCredentials(tokenData);

  return google.gmail({ version: 'v1', auth: oauth2Client });
}
