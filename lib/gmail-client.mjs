import fs from 'fs';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getGmailTokenPath, getActiveAccountFile } from '../src/auth/paths.js';
import { readAccountTokens, saveAccountTokens } from './token-store.mjs';

const DEFAULT_ACCOUNT_MODE = 'normal';

function resolveAccountMode() {
  if (process.env.ACCOUNT_MODE) return process.env.ACCOUNT_MODE;
  try {
    return fs.readFileSync(getActiveAccountFile(), 'utf-8').trim();
  } catch {
    return DEFAULT_ACCOUNT_MODE;
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
 * Token path and active-account file resolve through src/auth/paths.js — the canonical
 * answer, which honours XDG_CONFIG_HOME. This module used to hardcode its own copy of
 * both paths and ignored that override; it also hand-rolled the read-modify-write token
 * persistence lib/token-store.mjs exists to be the single copy of.
 *
 * @returns {Promise<Object>} Gmail API client authenticated and ready for requests
 * @throws {Error} If token file is missing, credentials are invalid, or token for account mode not found
 */
export async function createGmailClient() {
  const tokenPath = getGmailTokenPath();
  const credPath = process.env.GOOGLE_OAUTH_CREDENTIALS || './gcp-oauth.keys.json';

  const tokenFileData = await readAccountTokens(tokenPath);
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
    persistRefreshedTokens(tokenPath, accountMode, newTokens).catch((err) => {
      console.error(`Failed to persist refreshed tokens for ${accountMode}: ${err.message}`);
    });
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

async function persistRefreshedTokens(tokenPath, accountMode, newTokens) {
  // Re-read so a concurrent script's writes for other accounts aren't clobbered
  const fileData = await readAccountTokens(tokenPath);
  await saveAccountTokens(tokenPath, accountMode, {
    ...fileData[accountMode],
    ...newTokens,
    // Google omits refresh_token on refresh responses; keep the stored one
    refresh_token: newTokens.refresh_token || fileData[accountMode]?.refresh_token,
  });
}
