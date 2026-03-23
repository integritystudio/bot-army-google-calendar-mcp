import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function checkUnreadEmails() {
  try {
    // Load credentials
    const credPath = path.join(__dirname, 'credentials.json');
    const credFile = JSON.parse(await fs.readFile(credPath, 'utf-8'));
    const cred = credFile.installed || credFile;

    // Try multiple token paths
    const tokenDir = path.join(homedir(), '.config/google-calendar-mcp');
    const accountMode = process.env.ACCOUNT_MODE || 'normal';
    const tokenPaths = [
      path.join(tokenDir, 'tokens-gmail.json'),
      path.join(tokenDir, 'tokens.json'),
      process.env.CALENDARMCP_TOKEN_PATH
    ].filter(Boolean);

    let tokens = null;
    for (const tokenPath of tokenPaths) {
      try {
        const content = await fs.readFile(tokenPath, 'utf-8');
        const multiAccountTokens = JSON.parse(content);
        tokens = multiAccountTokens[accountMode];
        if (tokens) {
          console.log(`Using tokens from: ${tokenPath}`);
          break;
        }
      } catch (e) {
        // Try next path
      }
    }

    if (!tokens) {
      console.error(`\nNo Gmail tokens found for account: ${accountMode}`);
      console.error('\nSetup Gmail OAuth with proper scopes:');
      console.error('1. Add https://www.googleapis.com/auth/gmail.readonly to your OAuth scopes');
      console.error('2. Re-run: npm run auth');
      console.error('\nOr authenticate with Gmail scopes directly.');
      process.exit(1);
    }

    // Setup OAuth client
    const oauth2Client = new OAuth2Client(
      cred.client_id,
      cred.client_secret,
      cred.redirect_uris[0]
    );

    oauth2Client.setCredentials(tokens);

    // Query Gmail API
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 1
    });

    const unreadCount = response.data.resultSizeEstimate || 0;
    console.log(`\nUnread messages: ${unreadCount}`);

  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.message.includes('insufficient permissions')) {
      console.error('\nYour OAuth tokens need Gmail scope. Authenticate again with:');
      console.error('npm run auth');
    }
    process.exit(1);
  }
}

checkUnreadEmails();
