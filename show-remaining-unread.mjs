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

console.log('📧 REMAINING UNREAD EMAILS (201 total)\n');
console.log('═'.repeat(80) + '\n');

const searchResponse = await gmail.users.messages.list({
  userId: 'me',
  q: 'is:unread',
  maxResults: 50
});

const messages = searchResponse.data.messages || [];

for (const msg of messages) {
  const fullMsg = await gmail.users.messages.get({
    userId: 'me',
    id: msg.id,
    format: 'metadata',
    metadataHeaders: ['Subject', 'From', 'Date']
  });

  const headers = fullMsg.data.payload?.headers || [];
  const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
  const from = headers.find(h => h.name === 'From')?.value || '(unknown)';

  console.log(`• ${subject.substring(0, 70)}`);
  console.log(`  From: ${from.substring(0, 60)}\n`);
}

console.log(`Showing first 50 of 201 unread emails`);
console.log('═'.repeat(80) + '\n');
