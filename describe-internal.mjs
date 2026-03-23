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

console.log('📋 INTERNAL DISCUSSIONS - DETAILED BREAKDOWN\n');
console.log('═'.repeat(80) + '\n');

// Get all unread emails from internal team
const internalQueries = [
  { person: 'Chandra Srivastava', q: 'from:chandra@integritystudio.ai is:unread' },
  { person: 'Jordan Taylor', q: 'from:jordan' },
  { person: 'John Skelton', q: 'from:john@integritystudio.ai is:unread' },
  { person: 'Alex', q: 'from:alex@integritystudio.ai is:unread' }
];

for (const query of internalQueries) {
  const resp = await gmail.users.messages.list({
    userId: 'me',
    q: query.q,
    maxResults: 50
  });

  const messages = resp.data.messages || [];
  if (messages.length === 0) continue;

  console.log(`${query.person}: ${messages.length} emails\n`);

  // Get details for all messages
  const details = [];
  for (const msg of messages.slice(0, 10)) {
    const fullMsg = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date']
    });

    const headers = fullMsg.data.payload?.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
    const from = headers.find(h => h.name === 'From')?.value || '';
    const date = headers.find(h => h.name === 'Date')?.value || '';

    const emailDate = new Date(date);
    const fromName = from.match(/([^<]+)/)?.[0]?.trim() || from;

    details.push({ subject, fromName, date: emailDate.toLocaleDateString() });
  }

  details.forEach(d => {
    console.log(`  • ${d.subject.substring(0, 65)}`);
    console.log(`    ${d.date}\n`);
  });

  if (messages.length > 10) {
    console.log(`  ... and ${messages.length - 10} more\n`);
  }
}

console.log('═'.repeat(80));
console.log('\nSUMMARY:\n');
console.log('Internal discussions are primarily:');
console.log('1. Calendar meeting responses (Accepted/Declined) from Chandra');
console.log('2. Project collaboration emails from Jordan Taylor (HubSpot)');
console.log('3. File shares and coordination from John Skelton');
console.log('4. Project discussions from other team members\n');
console.log('Recommendation: Keep unread for active coordination reference\n');
console.log('═'.repeat(80) + '\n');
