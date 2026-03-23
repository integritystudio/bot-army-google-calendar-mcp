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

console.log('📊 QUICK STATUS\n');

// Get profile for total message count
const profile = await gmail.users.getProfile({ userId: 'me' });
console.log(`Total messages: ${profile.data.messagesTotal}`);
console.log(`Total threads: ${profile.data.threadsTotal}`);

// Count unread
const unreadResult = await gmail.users.messages.list({
  userId: 'me',
  q: 'is:unread'
});

console.log(`Unread (is:unread): ${unreadResult.data.resultSizeEstimate}`);

// Count in inbox
const inboxResult = await gmail.users.messages.list({
  userId: 'me',
  q: 'is:unread in:inbox'
});

console.log(`Unread in inbox: ${inboxResult.data.resultSizeEstimate}`);

// Count by category
const labels = ['Sentry Alerts', 'Keep Important', 'Events', 'Monitoring', 'Product Updates', 'Communities', 'Services & Alerts', 'Billing'];
const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
const labelMap = {};
labelsResponse.data.labels.forEach(l => { labelMap[l.name] = l.id; });

console.log('\n📁 By Label:');
for (const label of labels) {
  if (!labelMap[label]) continue;
  const result = await gmail.users.messages.list({
    userId: 'me',
    q: `label:${labelMap[label]} is:unread`
  });
  console.log(`  ${label}: ${result.data.resultSizeEstimate}`);
}
