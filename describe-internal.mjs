import fs from 'fs';
import path from 'path';
import { homedir } from 'os';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const MAX_RESULTS = 50;
const PREVIEW_COUNT = 10;
const SUBJECT_MAX_LENGTH = 65;
const HEADER_SUBJECT = 'Subject';
const HEADER_FROM = 'From';
const HEADER_DATE = 'Date';
const USER_ID = 'me';

try {
  const TOKEN_PATH = path.join(homedir(), '.config/google-calendar-mcp/tokens-gmail.json');
  const tokenFileData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  const accountMode = process.env.ACCOUNT_MODE || 'normal';
  const tokenData = tokenFileData[accountMode];

  if (!tokenData) {
    console.error(`Error: No token found for account mode: ${accountMode}`);
    process.exit(1);
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

  const getHeader = (headers, name) => headers.find(h => h.name === name)?.value;

  console.log('📋 INTERNAL DISCUSSIONS - DETAILED BREAKDOWN\n');
  console.log('═'.repeat(80) + '\n');

  const internalQueries = [
    { person: 'Chandra Srivastava', q: 'from:chandra@integritystudio.ai is:unread' },
    { person: 'Jordan Taylor', q: 'from:jordan is:unread' },
    { person: 'John Skelton', q: 'from:john@integritystudio.ai is:unread' },
    { person: 'Alex', q: 'from:alex@integritystudio.ai is:unread' }
  ];

  const listResponses = await Promise.all(
    internalQueries.map(query =>
      gmail.users.messages.list({
        userId: USER_ID,
        q: query.q,
        maxResults: MAX_RESULTS
      })
    )
  );

  for (let i = 0; i < internalQueries.length; i++) {
    const query = internalQueries[i];
    const resp = listResponses[i];
    const messages = resp.data.messages || [];

    if (messages.length === 0) continue;

    console.log(`${query.person}: ${messages.length} emails\n`);

    const details = await Promise.all(
      messages.slice(0, PREVIEW_COUNT).map(msg =>
        gmail.users.messages.get({
          userId: USER_ID,
          id: msg.id,
          format: 'metadata',
          metadataHeaders: [HEADER_SUBJECT, HEADER_FROM, HEADER_DATE]
        })
      )
    );

    details.forEach(fullMsg => {
      const headers = fullMsg.data.payload?.headers || [];
      const subject = getHeader(headers, HEADER_SUBJECT) ?? '(no subject)';
      const dateStr = getHeader(headers, HEADER_DATE) ?? '';
      const emailDate = new Date(dateStr).toLocaleDateString();

      console.log(`  • ${subject.substring(0, SUBJECT_MAX_LENGTH)}`);
      console.log(`    ${emailDate}\n`);
    });

    if (messages.length > PREVIEW_COUNT) {
      console.log(`  ... and ${messages.length - PREVIEW_COUNT} more\n`);
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
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
