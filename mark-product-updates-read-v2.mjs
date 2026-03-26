import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_UNREAD } from './lib/constants.mjs';

async function markProductUpdatesRead() {
  const gmail = createGmailClient();

  console.log('📖 MARKING PRODUCT UPDATES AS READ\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const queries = [
      'from:workspace-noreply@google.com',
      'from:GoogleCloudStartups@google.com',
      'from:no-reply@discuss.google.d',
      'from:analytics-noreply@google.com',
      'from:noreply@notifications.hubspot.com',
      'from:notifications@mail.postman.com',
      'from:zeno@updates.resend.com',
      'from:(support@mixpanel.com OR content@mixpanel.com)',
      'from:noreply@tm.openai.com',
      'from:communications@yodlee.com',
      'from:hello@adapty.io',
      'from:no-reply@comms.datahub.com',
      'from:arthur@storylane.io'
    ];

    const searchQuery = queries.map(q => `(${q})`).join(' OR ');
    const searchResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: searchQuery,
      maxResults: 500
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} Product Updates emails\n`);

    if (messageIds.length === 0) {
      console.log('✅ No Product Updates to process\n');
      return;
    }

    const batchSize = 50;

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize).map(m => m.id);

      await gmail.users.messages.batchModify({
        userId: USER_ID,
        requestBody: {
          ids: batch,
          removeLabelIds: [GMAIL_UNREAD]
        }
      });

      const processed = i + batch.length;
      console.log(`  ✅ Marked ${processed}/${messageIds.length} as read`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Product Updates marked as read: ${messageIds.length}\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

markProductUpdatesRead().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
