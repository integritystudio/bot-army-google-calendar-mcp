import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function markSignozRead() {
  const tokenFileData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  const accountMode = process.env.ACCOUNT_MODE || 'normal';
  const tokenData = tokenFileData[accountMode];

  const credPath = process.env.GOOGLE_OAUTH_CREDENTIALS || './credentials.json';
  const credData = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
  const oauth2Client = new OAuth2Client(
    credData.installed.client_id,
    credData.installed.client_secret,
    credData.installed.redirect_uris[0]
  );
  oauth2Client.setCredentials(tokenData);

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  console.log('📖 MARKING SIGNOZ EMAILS AS READ\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Search for all SigNoz emails (both read and unread)
    const searchQuery = 'from:(alertmanager@signoz.cloud OR vishal@mail.signoz.io)';
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults: 500
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} SigNoz emails\n`);

    if (messageIds.length === 0) {
      console.log('✅ No SigNoz emails found\n');
      return;
    }

    // Mark all as read in batches
    const batchSize = 50;

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);

      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: batch.map(m => m.id),
          removeLabelIds: ['UNREAD']
        }
      });

      const processed = Math.min(i + batchSize, messageIds.length);
      console.log(`  ✅ Marked ${processed}/${messageIds.length} as read`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ SigNoz emails marked as read: ${messageIds.length}\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

markSignozRead().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
