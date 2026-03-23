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

console.log('📋 REMAINING UNREAD SUMMARY\n');
console.log('═'.repeat(80) + '\n');

// Internal work items
console.log('INTERNAL: Work file shares, project discussions\n');

const internalQueries = [
  { label: 'John Skelton (files)', q: 'from:john@integritystudio.ai' },
  { label: 'Project discussions (misc)', q: 'from:chandra@integritystudio.ai OR from:alex@integritystudio.ai OR from:jordan' }
];

for (const query of internalQueries) {
  const resp = await gmail.users.messages.list({
    userId: 'me',
    q: `${query.q} is:unread`,
    maxResults: 20
  });

  const messages = resp.data.messages || [];
  if (messages.length === 0) continue;

  console.log(`${query.label}: ${messages.length}`);

  for (let i = 0; i < Math.min(2, messages.length); i++) {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: messages[i].id,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From']
    });

    const headers = msg.data.payload?.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
    const from = headers.find(h => h.name === 'From')?.value || '';
    const fromName = from.match(/([^<]+)/)?.[0]?.trim() || from;

    console.log(`  • ${subject.substring(0, 60)}`);
    console.log(`    From: ${fromName}\n`);
  }
}

console.log('\nFORUMS: Technical summaries\n');

const forumQueries = [
  { label: 'Misc/sales', q: 'from:marcella@inmyteam.com' }
];

for (const query of forumQueries) {
  const resp = await gmail.users.messages.list({
    userId: 'me',
    q: `${query.q} is:unread`,
    maxResults: 20
  });

  const messages = resp.data.messages || [];
  if (messages.length === 0) continue;

  console.log(`${query.label}: ${messages.length}`);

  for (let i = 0; i < Math.min(1, messages.length); i++) {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: messages[i].id,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From']
    });

    const headers = msg.data.payload?.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
    const from = headers.find(h => h.name === 'From')?.value || '';
    const fromName = from.match(/([^<]+)/)?.[0]?.trim() || from;

    console.log(`  • ${subject.substring(0, 60)}`);
    console.log(`    From: ${fromName}\n`);
  }
}

console.log('═'.repeat(80) + '\n');
