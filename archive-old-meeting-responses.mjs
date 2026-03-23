import { createGmailClient } from './lib/gmail-client.mjs';

const gmail = createGmailClient();

console.log('📅 ARCHIVING OLD MEETING RESPONSES\n');
console.log('═'.repeat(80) + '\n');

// Calculate date one week ago
const today = new Date();
const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
const dateStr = oneWeekAgo.toISOString().split('T')[0];

console.log(`Archiving responses before ${dateStr}\n`);

// Search for meeting acceptances/declines older than a week
const searchQueries = [
  'subject:Accepted subject:Integrity',
  'subject:Declined subject:Integrity',
  'subject:"Added to a team"',
  'from:john@integritystudio.ai subject:(Accepted OR Declined)',
  'from:chandra@integritystudio.ai subject:(Accepted OR Declined)'
];

let totalArchived = 0;

for (const query of searchQueries) {
  const searchResp = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 100
  });

  const messages = searchResp.data.messages || [];
  if (messages.length === 0) continue;

  console.log(`Query: ${query}`);
  console.log(`Found ${messages.length} emails\n`);

  const oldIds = [];

  for (const msg of messages) {
    const fullMsg = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'metadata',
      metadataHeaders: ['Date', 'Subject']
    });

    const headers = fullMsg.data.payload?.headers || [];
    const dateStr = headers.find(h => h.name === 'Date')?.value || '';
    const subject = headers.find(h => h.name === 'Subject')?.value || '';

    // Parse email date
    const emailDate = new Date(dateStr);

    if (emailDate < oneWeekAgo) {
      oldIds.push(msg.id);
      console.log(`  ✓ ${subject.substring(0, 50)}`);
      console.log(`    Date: ${emailDate.toLocaleDateString()}\n`);
    }
  }

  if (oldIds.length > 0) {
    const batchSize = 50;
    for (let i = 0; i < oldIds.length; i += batchSize) {
      const batch = oldIds.slice(i, Math.min(i + batchSize, oldIds.length));

      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: batch,
          removeLabelIds: ['UNREAD', 'INBOX']
        }
      });

      totalArchived += batch.length;
    }

    console.log(`✅ Archived and marked ${oldIds.length} as read\n`);
  }
}

console.log('═'.repeat(80));
console.log('COMPLETE\n');
console.log(`✅ Total archived: ${totalArchived} meeting responses\n`);
console.log('═'.repeat(80) + '\n');
