import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');
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

console.log('🏷️  LABELING GOOGLE DEVELOPER FORUMS\n');
console.log('═'.repeat(80) + '\n');

// Get Communities label ID
const labelsResp = await gmail.users.labels.list({ userId: 'me' });
const communitiesLabel = labelsResp.data.labels.find(l => l.name === 'Communities');

if (!communitiesLabel) {
  console.log('Communities label not found\n');
  process.exit(1);
}

// Find all Google Developer forum emails
const searchResp = await gmail.users.messages.list({
  userId: 'me',
  q: 'from:"no-reply@discuss.google.dev" OR from:"no-reply@discuss.google.com"',
  maxResults: 500
});

const messageIds = searchResp.data.messages || [];
console.log(`Found ${messageIds.length} Google Developer forum emails\n`);

if (messageIds.length === 0) {
  console.log('✅ No emails to process\n');
  process.exit(0);
}

// Label and mark as read in batches
const batchSize = 50;
let processedCount = 0;

for (let i = 0; i < messageIds.length; i += batchSize) {
  const batch = messageIds.slice(i, Math.min(i + batchSize, messageIds.length));

  await gmail.users.messages.batchModify({
    userId: 'me',
    requestBody: {
      ids: batch.map(m => m.id),
      addLabelIds: [communitiesLabel.id],
      removeLabelIds: ['UNREAD']
    }
  });

  processedCount += batch.length;
  const processed = Math.min(i + batchSize, messageIds.length);
  console.log(`  ✅ Processed ${processed}/${messageIds.length}`);
}

console.log('\n' + '═'.repeat(80));
console.log('COMPLETE\n');
console.log(`✅ Google Developer forums labeled as Communities: ${messageIds.length}`);
console.log(`✅ All marked as read\n`);
console.log('═'.repeat(80) + '\n');
