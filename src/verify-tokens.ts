import { Credentials } from 'google-auth-library';
import { initializeOAuth2Client } from './auth/client.js';
import { TokenManager } from './auth/tokenManager.js';
import fs from 'fs/promises';
import { isNodeError, toErrorMessage } from './auth/utils.js';

const AUTH_HINT = '💡 Run: npm run auth';

/**
 * Same legacy shape TokenManager.loadMultiAccountTokens() migrates: tokens written
 * before multi-account support sit flat at the top level rather than under an
 * account key. Reported as one account instead of iterating the credential fields,
 * which would otherwise list "access_token"/"expiry_date" as if they were accounts.
 */
function isLegacyFlatShape(parsed: object): parsed is Credentials {
  const credentials = parsed as Credentials;
  return Boolean(credentials.access_token || credentials.refresh_token);
}

function describeAccount(account: string, tokens: Credentials | undefined): void {
  console.log(`  • ${account}`);
  if (!tokens) {
    console.log('    - (no credentials stored)');
    return;
  }
  const expiry = tokens.expiry_date
    ? `${new Date(tokens.expiry_date).toLocaleString()}` +
      `${tokens.expiry_date < Date.now() ? ' (expired)' : ''}`
    : 'unknown';
  console.log(`    - Access token: ${tokens.access_token ? '✓ present' : '✗ missing'}`);
  console.log(`    - Refresh token: ${tokens.refresh_token ? '✓ present' : '✗ missing'}`);
  console.log(`    - Expires: ${expiry}`);
}

/**
 * Read and parse the token file, reporting *why* it is unusable rather than
 * surfacing a bare parser message. An interrupted write leaves a 0-byte file,
 * which reads as "exists" but parses as "Unexpected end of JSON input" — the
 * least actionable way to say "re-authenticate".
 *
 * Read-only: unlike TokenManager, this never renames or rewrites the file. A
 * diagnostic that repairs what it inspects cannot be run to inspect the damage.
 */
async function readTokenFile(tokenPath: string): Promise<Record<string, unknown> | null> {
  let content: string;
  try {
    content = await fs.readFile(tokenPath, 'utf-8');
  } catch (error: unknown) {
    if (isNodeError(error, 'ENOENT')) {
      console.log('✗ Token file not found\n');
      console.log(AUTH_HINT);
      return null;
    }
    throw error;
  }

  if (content.trim() === '') {
    console.log(`✗ Token file is empty (${content.length} bytes) — likely an interrupted write\n`);
    console.log('   Authenticating overwrites it; no need to delete it first.');
    console.log(AUTH_HINT);
    return null;
  }

  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error: unknown) {
    console.log(`✗ Token file is not valid JSON: ${toErrorMessage(error)}\n`);
    console.log(`   Inspect or back up ${tokenPath}, then re-authenticate.`);
    console.log('   Authenticating moves the unreadable file aside automatically.');
    console.log(AUTH_HINT);
    return null;
  }
}

async function verifyAndRefreshTokens() {
  try {
    console.log('🔍 Verifying OAuth tokens...\n');

    const oauth2Client = await initializeOAuth2Client();
    const tokenManager = new TokenManager(oauth2Client);
    const tokenPath = tokenManager.getTokenPath();

    // Checks Calendar/MCP credentials only. The root .mjs Gmail scripts read a
    // separate tokens-gmail.json — verify that side with `node verify-tokens.mjs`.
    console.log(`📁 Token file: ${tokenPath}`);
    const parsed = await readTokenFile(tokenPath);
    if (!parsed) {
      process.exit(1);
    }

    console.log('📋 Available accounts:');
    if (isLegacyFlatShape(parsed)) {
      describeAccount('normal (legacy flat file — migrates on next save)', parsed);
    } else {
      const accounts = Object.keys(parsed);
      if (accounts.length === 0) {
        console.log('  (none stored)');
      }
      for (const account of accounts) {
        describeAccount(account, parsed[account] as Credentials | undefined);
      }
    }

    console.log('\n⏱️  Checking token validity...');

    const isValid = await tokenManager.isAuthenticated();

    if (!isValid) {
      console.log('✗ Tokens invalid or expired');
      console.log(AUTH_HINT);
      process.exit(1);
    }

    console.log('✓ Tokens are valid\n');

    const credentials = tokenManager.getCredentials();
    if (credentials?.expiry_date) {
      const expiresIn = Math.floor((credentials.expiry_date - Date.now()) / 1000);
      const hours = Math.floor(expiresIn / 3600);
      const minutes = Math.floor((expiresIn % 3600) / 60);
      console.log(`⏰ Current access token expires in: ${hours}h ${minutes}m`);
    }
    console.log('✓ Ready to use Google Calendar API');

  } catch (error: unknown) {
    console.error('❌ Error verifying tokens:');
    console.error(`   ${toErrorMessage(error)}`);
    process.exit(1);
  }
}

verifyAndRefreshTokens();
