import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID } from './lib/constants.mjs';

const MAX_RESULTS = 50;
const PREVIEW_COUNT = 10;
const SUBJECT_MAX_LENGTH = 65;
const HEADER_SUBJECT = 'Subject';
const HEADER_FROM = 'From';
const HEADER_DATE = 'Date';

try {
  const gmail = createGmailClient();

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

  console.log('═'.repeat(80) + '\n');
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
