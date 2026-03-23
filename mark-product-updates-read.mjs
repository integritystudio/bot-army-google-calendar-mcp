import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function markProductUpdatesRead() {
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

  console.log('📖 MARKING PRODUCT UPDATES AS READ\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get Product Updates label
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const productLabel = labelsResponse.data.labels.find(l => l.name === 'Product Updates');

    if (!productLabel) {
      console.log('Product Updates label not found\n');
      return;
    }

    // Find all emails with Product Updates label
    const searchQuery = `label:${productLabel.id}`;
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults: 500
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} Product Updates emails\n`);

    if (messageIds.length === 0) {
      console.log('✅ No Product Updates to process\n');
      return;
    }

    // Mark all as read in batches
    const batchSize = 50;
    let markedCount = 0;

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, Math.min(i + batchSize, messageIds.length));

      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: batch.map(m => m.id),
          removeLabelIds: ['UNREAD']
        }
      });

      markedCount += batch.length;
      const processed = Math.min(i + batchSize, messageIds.length);
      console.log(`  ✅ Marked ${processed}/${messageIds.length} as read`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Product Updates marked as read: ${messageIds.length}\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

markProductUpdatesRead().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
