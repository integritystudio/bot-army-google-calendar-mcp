#!/usr/bin/env node
import { initializeOAuth2Client } from './src/auth/client.js';
import { TokenManager } from './src/auth/tokenManager.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Point to credentials.json at root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.GOOGLE_OAUTH_CREDENTIALS = path.join(__dirname, 'credentials.json');

async function verifyAndRefreshTokens() {
  try {
    console.log('🔍 Verifying OAuth tokens...\n');

    // Initialize OAuth client
    const oauth2Client = await initializeOAuth2Client();
    const tokenManager = new TokenManager(oauth2Client);
    const tokenPath = tokenManager.getTokenPath();

    // Check if token file exists
    console.log(`📁 Token file: ${tokenPath}`);
    try {
      await fs.access(tokenPath);
      console.log('✓ Token file exists\n');
    } catch {
      console.log('✗ Token file not found. Run: npm run auth\n');
      process.exit(1);
    }

    // Display token info
    const tokenContent = await fs.readFile(tokenPath, 'utf-8');
    const tokens = JSON.parse(tokenContent);

    console.log('📋 Available accounts:');
    Object.keys(tokens).forEach(account => {
      const accountTokens = tokens[account];
      const hasRefresh = !!accountTokens.refresh_token;
      const hasAccess = !!accountTokens.access_token;
      const expiryDate = accountTokens.expiry_date
        ? new Date(accountTokens.expiry_date).toLocaleString()
        : 'unknown';

      console.log(`  • ${account}`);
      console.log(`    - Access token: ${hasAccess ? '✓ present' : '✗ missing'}`);
      console.log(`    - Refresh token: ${hasRefresh ? '✓ present' : '✗ missing'}`);
      console.log(`    - Expires: ${expiryDate}`);
    });

    console.log('\n⏱️  Checking token validity...');

    // Validate and refresh if needed
    const isValid = await tokenManager.validateTokens();

    if (isValid) {
      console.log('✓ Tokens are valid\n');

      // Check expiry time
      const credentials = oauth2Client.credentials;
      if (credentials.expiry_date) {
        const expiresIn = Math.floor((credentials.expiry_date - Date.now()) / 1000);
        const hours = Math.floor(expiresIn / 3600);
        const minutes = Math.floor((expiresIn % 3600) / 60);
        console.log(`⏰ Current access token expires in: ${hours}h ${minutes}m`);
      }
      console.log('✓ Ready to use Google Calendar API');
    } else {
      console.log('✗ Tokens invalid or expired');
      console.log('💡 Run: npm run auth');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error verifying tokens:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    } else {
      console.error(`   ${error}`);
    }
    process.exit(1);
  }
}

verifyAndRefreshTokens().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});