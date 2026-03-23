import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

async function markAllLabeledAsRead() {
  const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');
  const tokenFileData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  const accountMode = process.env.ACCOUNT_MODE || 'normal';
  const tokenData = tokenFileData[accountMode];

  if (!tokenData) {
    throw new Error(`Token data not found for account mode: ${accountMode}`);
  }

  const credPath = process.env.GOOGLE_OAUTH_CREDENTIALS || './credentials.json';
  const credData = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
  const oauth2Client = new OAuth2Client(
    credData.installed.client_id,
    credData.installed.client_secret,
    credData.installed.redirect_uris[0]
  );
  oauth2Client.setCredentials(tokenData);

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  console.log('📖 MARKING ALL LABELED CATEGORIES AS READ\n');
  console.log('═'.repeat(80) + '\n');

  // Labels to mark as read (excluding Sentry Alerts and Keep Important)
  const labels = {
    'Events': 'Label_1',
    'Product Updates': 'Label_41',
    'Communities': 'Label_51',
    'Services & Alerts': 'Label_52',
    'Billing': 'Label_47',
    'Monitoring': 'Label_48'
  };

  let totalMarked = 0;

for (const [name, id] of Object.entries(labels)) {
  try {
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: `label:${id} is:unread`,
      maxResults: 500
    });

    const labeledUnread = searchResponse.data.messages || [];

    if (labeledUnread.length === 0) {
      console.log(`${name}: 0 unread\n`);
      continue;
    }

    console.log(`${name}: ${labeledUnread.length} unread`);

    // Mark as read in batches
    const batchSize = 50;
    for (let i = 0; i < labeledUnread.length; i += batchSize) {
      const batch = labeledUnread.slice(i, i + batchSize).map(m => m.id);

      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: batch,
          removeLabelIds: ['UNREAD']
        }
      });

      totalMarked += batch.length;
      const processed = Math.min(i + batchSize, labeledUnread.length);
      console.log(`  ✅ Marked ${processed}/${labeledUnread.length} as read`);
    }

    console.log();
  } catch (e) {
    console.error(`Error processing ${name}:`, e.message);
  }
}

  console.log('═'.repeat(80));
  console.log('COMPLETE\n');
  console.log(`📖 Total emails marked as read: ${totalMarked}`);
  console.log(`✅ Kept unread: Sentry Alerts, Keep Important\n`);
  console.log('═'.repeat(80) + '\n');
}

markAllLabeledAsRead().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
