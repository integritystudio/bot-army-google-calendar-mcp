import { createGmailClient } from './lib/gmail-client.mjs';
import { extractDisplayName } from './lib/email-utils.mjs';

const MAX_RESULTS = 20;
const INTERNAL_PREVIEW_COUNT = 2;
const FORUM_PREVIEW_COUNT = 1;
const SUBJECT_MAX_LENGTH = 60;
const HEADER_SUBJECT = 'Subject';
const HEADER_FROM = 'From';

try {
  const gmail = createGmailClient();

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
      const fromName = extractDisplayName(from);

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
