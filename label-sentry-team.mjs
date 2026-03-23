import { createGmailClient } from './lib/gmail-client.mjs';

async function labelSentryTeam() {
  const gmail = createGmailClient();

  console.log('🏷️  LABELING SENTRY TEAM POLICY UPDATE\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get Product Updates label
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const productLabel = labelsResponse.data.labels.find(l => l.name === 'Product Updates');

    if (!productLabel) {
      console.log('❌ Product Updates label not found\n');
      process.exit(1);
    }

    console.log('✅ Found label: Product Updates\n');

    // Find The Sentry Team policy update email
    const searchQuery = 'from:noreply@sentry.io subject:Subprocessors';
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults: 10
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} matching email(s)\n`);

    if (messageIds.length === 0) {
      console.log('⚠️  No matching emails found with "Subprocessors" query\n');
      console.log('Trying alternative search...\n');

      // Try broader search for Sentry policy updates
      const altSearchQuery = 'from:noreply@sentry.io subject:(Update OR policy OR notice)';
      const altResponse = await gmail.users.messages.list({
        userId: 'me',
        q: altSearchQuery,
        maxResults: 10
      });

      const altIds = altResponse.data.messages || [];
      console.log(`Found ${altIds.length} email(s) with alternative search\n`);

      if (altIds.length === 0) {
        console.log('❌ No Sentry policy emails found\n');
        return;
      }

      // Show the emails found
      for (const msg of altIds) {
        const fullMsg = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'Date']
        });

        const headers = fullMsg.data.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        console.log(`Subject: ${subject}`);
        console.log(`Date: ${date}\n`);
      }

      // Label the emails
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: altIds.map(m => m.id),
          addLabelIds: [productLabel.id],
          removeLabelIds: ['INBOX']
        }
      });

      console.log(`✅ Labeled and archived ${altIds.length} email(s)\n`);
      return;
    }

    // Show the emails found
    for (const msg of messageIds) {
      const fullMsg = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'Date']
      });

      const headers = fullMsg.data.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      console.log(`Subject: ${subject}`);
      console.log(`Date: ${date}\n`);
    }

    // Label the found email(s)
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: messageIds.map(m => m.id),
        addLabelIds: [productLabel.id],
        removeLabelIds: ['INBOX']
      }
    });

    console.log('═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Labeled: Product Updates`);
    console.log(`✅ Archived: ${messageIds.length} email(s)\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

labelSentryTeam().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
