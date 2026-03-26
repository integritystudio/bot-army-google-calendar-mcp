#!/usr/bin/env node
import { initializeOAuth2Client } from './src/auth/client.js';
import { TokenManager } from './src/auth/tokenManager.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.GOOGLE_OAUTH_CREDENTIALS = path.join(__dirname, 'credentials.json');

async function verifyAndRefreshTokens() {
  console.log('Verifying OAuth tokens...\n');

  const oauth2Client = await initializeOAuth2Client();
  const tokenManager = new TokenManager(oauth2Client);
  const tokenPath = tokenManager.getTokenPath();

  console.log(`Token file: ${tokenPath}`);
  try {
    await fs.access(tokenPath);
    console.log('Token file exists\n');
  } catch {
    console.log('Token file not found. Run: npm run auth\n');
    process.exit(1);
  }

  const tokenContent = await fs.readFile(tokenPath, 'utf-8');
  const tokens = JSON.parse(tokenContent);

  console.log('Available accounts:');
  Object.keys(tokens).forEach(account => {
    const accountTokens = tokens[account];
    const expiryDate = accountTokens.expiry_date
      ? new Date(accountTokens.expiry_date).toLocaleString()
      : 'unknown';
    console.log(`  • ${account}`);
    console.log(`    - Access token: ${accountTokens.access_token ? 'present' : 'missing'}`);
    console.log(`    - Refresh token: ${accountTokens.refresh_token ? 'present' : 'missing'}`);
    console.log(`    - Expires: ${expiryDate}`);
  });

  console.log('\nChecking token validity...');
  const isValid = await tokenManager.validateTokens();

  if (isValid) {
    console.log('Tokens are valid\n');
    const credentials = oauth2Client.credentials;
    if (credentials.expiry_date) {
      const expiresIn = Math.floor((credentials.expiry_date - Date.now()) / 1000);
      console.log(`Access token expires in: ${Math.floor(expiresIn / 3600)}h ${Math.floor((expiresIn % 3600) / 60)}m`);
    }
    console.log('Ready to use Google Calendar API');
  } else {
    console.log('Tokens invalid or expired. Run: npm run auth');
    process.exit(1);
  }
}

verifyAndRefreshTokens().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
