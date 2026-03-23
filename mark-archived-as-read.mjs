import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function markArchivedAsRead() {
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

  console.log('📖 MARKING ARCHIVED EMAILS AS READ\n');
  console.log('═'.repeat(80) + '\n');

  const categoriesToProcess = [
    'Product Updates',
    'Monitoring',
    'Communities',
    'Services & Alerts',
    'Billing'
  ];

  let totalMarked = 0;

  try {
    // Get all labels
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const labels = labelsResponse.data.labels || [];
    const labelMap = {};
    labels.forEach(l => { labelMap[l.name] = l.id; });

    for (const category of categoriesToProcess) {
      const labelId = labelMap[category];
      if (!labelId) continue;

      // Find unread emails with this label (not in INBOX - archived)
      const searchQuery = `label:${labelId} is:unread -label:INBOX`;
      const searchResponse = await gmail.users.messages.list({
        userId: 'me',
        q: searchQuery,
        maxResults: 500
      });

      const messageIds = searchResponse.data.messages || [];
      console.log(`${category}: ${messageIds.length} unread\n`);

      if (messageIds.length === 0) continue;

      // Mark as read in batches
      const batchSize = 50;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, Math.min(i + batchSize, messageIds.length));

        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch.map(m => m.id),
            removeLabelIds: ['UNREAD']
          }
        });

        totalMarked += batch.length;
        const processed = Math.min(i + batchSize, messageIds.length);
        console.log(`  ✅ Marked ${processed}/${messageIds.length} as read`);
      }

      console.log();
    }

    console.log('═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`📖 Total emails marked as read: ${totalMarked}\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

markArchivedAsRead().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
