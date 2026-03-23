import fs from 'fs';
import path from 'path';
import { homedir } from 'os';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const MAX_RESULTS = 20;
const INTERNAL_PREVIEW_COUNT = 2;
const FORUM_PREVIEW_COUNT = 1;
const SUBJECT_MAX_LENGTH = 60;
const HEADER_SUBJECT = 'Subject';
const HEADER_FROM = 'From';

const TOKEN_PATH = path.join(homedir(), '.config/google-calendar-mcp/tokens-gmail.json');
try {
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

  async function printQueryResults(query, label, previewCount) {
    const resp = await gmail.users.messages.list({
      userId: 'me',
      q: `${query.q} is:unread`,
      maxResults: MAX_RESULTS
    });

    const messages = resp.data.messages || [];
    if (messages.length === 0) return;

    console.log(`${label}: ${messages.length}`);

    const previews = await Promise.all(
      messages.slice(0, previewCount).map(m =>
        gmail.users.messages.get({
          userId: 'me',
          id: m.id,
          format: 'metadata',
          metadataHeaders: [HEADER_SUBJECT, HEADER_FROM]
        })
      )
    );

    for (const msg of previews) {
      const headers = msg.data.payload?.headers || [];
      const subject = getHeader(headers, HEADER_SUBJECT) ?? '(no subject)';
      const from = getHeader(headers, HEADER_FROM) ?? '';
      const fromName = from.split('<')[0].trim() || from;

      console.log(`  • ${subject.substring(0, SUBJECT_MAX_LENGTH)}`);
      console.log(`    From: ${fromName}\n`);
    }
  }

  console.log('📋 REMAINING UNREAD SUMMARY\n');
  console.log('═'.repeat(80) + '\n');

  const internalQueries = [
    { label: 'John Skelton (files)', q: 'from:john@integritystudio.ai' },
    { label: 'Project discussions (misc)', q: 'from:chandra@integritystudio.ai OR from:alex@integritystudio.ai OR from:jordan' }
  ];

  const forumQueries = [
    { label: 'Misc/sales', q: 'from:marcella@inmyteam.com' }
  ];

  console.log('INTERNAL: Work file shares, project discussions\n');
  await Promise.all(internalQueries.map(q => printQueryResults(q, q.label, INTERNAL_PREVIEW_COUNT)));

  console.log('\nFORUMS: Technical summaries\n');
  await Promise.all(forumQueries.map(q => printQueryResults(q, q.label, FORUM_PREVIEW_COUNT)));

  console.log('═'.repeat(80) + '\n');
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
