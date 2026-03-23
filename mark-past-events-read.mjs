import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { extractEventDate, isPastEvent } from './lib/date-based-filter.mjs';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function markPastEventsRead() {
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

  console.log('📅 MARKING PAST EVENTS AS READ\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Find all unread emails with Events label
    const searchQuery = 'label:Events is:unread';
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults: 500
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} unread event emails\n`);

    if (messageIds.length === 0) {
      console.log('✅ No unread events to process\n');
      return;
    }

    // Get full message details for date extraction
    const pastIds = [];

    for (const msg of messageIds) {
      const fullMsg = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full'
      });

      const headers = fullMsg.data.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';

      // Extract full body
      let body = '';
      if (fullMsg.data.payload?.body?.data) {
        body = Buffer.from(fullMsg.data.payload.body.data, 'base64').toString('utf-8');
      } else if (fullMsg.data.payload?.parts) {
        const textPart = fullMsg.data.payload.parts.find(p => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      }

      const eventDate = extractEventDate(subject + '\n' + body);

      if (eventDate && isPastEvent(eventDate)) {
        pastIds.push(msg.id);
      }
    }

    console.log(`Identified ${pastCount} past events\n`);

    if (pastIds.length === 0) {
      console.log('✅ No past events found\n');
      return;
    }

    // Mark past events as read in batches
    const batchSize = 50;

    for (let i = 0; i < pastIds.length; i += batchSize) {
      const batch = pastIds.slice(i, i + batchSize);

      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: batch,
          removeLabelIds: ['UNREAD']
        }
      });

      const processed = Math.min(i + batchSize, pastIds.length);
      console.log(`  ✅ Marked ${processed}/${pastIds.length} as read`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Past events marked as read: ${pastIds.length}`);
    console.log(`📊 Future events remaining unread: ${messageIds.length - pastIds.length}\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

markPastEventsRead().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
