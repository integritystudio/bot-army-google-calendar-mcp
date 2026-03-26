import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, LABEL_PRODUCT_UPDATES } from './lib/constants.mjs';
import { getHeader } from './lib/email-utils.mjs';

async function labelGoogleCloudFeb() {
  const gmail = createGmailClient();

  console.log('🏷️  LABELING GOOGLE CLOUD FEB UPDATE\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
    const productLabel = labelsResponse.data.labels.find(l => l.name === LABEL_PRODUCT_UPDATES);

    if (!productLabel) {
      console.log('❌ Product Updates label not found\n');
      process.exit(1);
    }

    console.log('✅ Found label: Product Updates\n');

    const searchQuery = 'from:CloudPlatform-noreply@google.com subject:"OpenTelemetry"';
    const searchResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: searchQuery,
      maxResults: 10
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} matching email(s)\n`);

    if (messageIds.length === 0) {
      console.log('⚠️  No matching emails found\n');
      console.log('Trying alternative search...\n');

      const altSearchQuery = 'from:CloudPlatform-noreply@google.com subject:"OTLP ingestion"';
      const altResponse = await gmail.users.messages.list({
        userId: USER_ID,
        q: altSearchQuery,
        maxResults: 10
      });

      const altIds = altResponse.data.messages || [];
      if (altIds.length > 0) {
        console.log(`Found ${altIds.length} email(s) with alternative search\n`);

        const altFullMsgs = await Promise.all(
          altIds.map(msg =>
            gmail.users.messages.get({
              userId: USER_ID,
              id: msg.id,
              format: 'metadata',
              metadataHeaders: ['Subject', 'Date']
            })
          )
        );

        for (const fullMsg of altFullMsgs) {
          const headers = fullMsg.data.payload?.headers || [];
          const subject = getHeader(headers, 'Subject');
          const date = getHeader(headers, 'Date');

          console.log(`Subject: ${subject}`);
          console.log(`Date: ${date}\n`);
        }

        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: altIds.map(m => m.id),
            addLabelIds: [productLabel.id],
            removeLabelIds: [GMAIL_INBOX]
          }
        });

        console.log(`✅ Labeled and archived ${altIds.length} email(s)\n`);
      } else {
        console.log('❌ No emails found\n');
      }
      return;
    }

    const fullMsgs = await Promise.all(
      messageIds.map(msg =>
        gmail.users.messages.get({
          userId: USER_ID,
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'Date']
        })
      )
    );

    for (const fullMsg of fullMsgs) {
      const headers = fullMsg.data.payload?.headers || [];
      const subject = getHeader(headers, 'Subject');
      const date = getHeader(headers, 'Date');

      console.log(`Subject: ${subject}`);
      console.log(`Date: ${date}\n`);
    }

    await gmail.users.messages.batchModify({
      userId: USER_ID,
      requestBody: {
        ids: messageIds.map(m => m.id),
        addLabelIds: [productLabel.id],
        removeLabelIds: [GMAIL_INBOX]
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

labelGoogleCloudFeb().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
