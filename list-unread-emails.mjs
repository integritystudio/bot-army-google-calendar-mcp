import { createGmailClient } from './lib/gmail-client.mjs';
import { extractDisplayName, getHeader } from './lib/email-utils.mjs';
import {
  USER_ID,
  LABEL_SENTRY,
  LABEL_KEEP_IMPORTANT,
  LABEL_EVENTS,
  LABEL_MONITORING,
  LABEL_PRODUCT_UPDATES,
  LABEL_COMMUNITIES,
  LABEL_SERVICES,
  LABEL_BILLING
} from './lib/constants.mjs';

async function listUnreadEmails() {
  const gmail = createGmailClient();

  console.log('📧 LISTING UNREAD EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const searchResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: 'is:unread',
      maxResults: 500
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Total unread: ${messageIds.length}\n`);

    if (messageIds.length === 0) {
      console.log('✅ Inbox is clean!\n');
      return;
    }

    const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
    const labels = labelsResponse.data.labels || [];
    const labelMap = {};
    labels.forEach(l => { labelMap[l.id] = l.name; });

    const fullMsgs = await Promise.all(
      messageIds.map(msg =>
        gmail.users.messages.get({
          userId: USER_ID,
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date']
        })
      )
    );

    const emails = fullMsgs.map(fullMsg => {
      const headers = fullMsg.data.payload?.headers || [];
      return {
        id: fullMsg.data.id,
        subject: getHeader(headers, 'Subject', '(no subject)'),
        from: getHeader(headers, 'From', '(unknown)'),
        date: getHeader(headers, 'Date'),
        labels: (fullMsg.data.labelIds || []).map(id => labelMap[id]).filter(Boolean)
      };
    });

    const categories = {
      [LABEL_SENTRY]: [],
      [LABEL_KEEP_IMPORTANT]: [],
      [LABEL_EVENTS]: [],
      [LABEL_MONITORING]: [],
      [LABEL_PRODUCT_UPDATES]: [],
      [LABEL_COMMUNITIES]: [],
      [LABEL_SERVICES]: [],
      [LABEL_BILLING]: [],
      'Other': []
    };

    emails.forEach(email => {
      let categorized = false;

      if (email.labels.includes(LABEL_KEEP_IMPORTANT)) {
        categories[LABEL_KEEP_IMPORTANT].push(email);
        categorized = true;
      } else if (email.labels.includes(LABEL_EVENTS)) {
        categories[LABEL_EVENTS].push(email);
        categorized = true;
      } else if (email.labels.includes(LABEL_MONITORING)) {
        categories[LABEL_MONITORING].push(email);
        categorized = true;
      } else if (email.labels.includes(LABEL_PRODUCT_UPDATES)) {
        categories[LABEL_PRODUCT_UPDATES].push(email);
        categorized = true;
      } else if (email.labels.includes(LABEL_COMMUNITIES)) {
        categories[LABEL_COMMUNITIES].push(email);
        categorized = true;
      } else if (email.labels.includes(LABEL_SERVICES)) {
        categories[LABEL_SERVICES].push(email);
        categorized = true;
      } else if (email.labels.includes(LABEL_BILLING)) {
        categories[LABEL_BILLING].push(email);
        categorized = true;
      }

      // Fallback: categorize by sender/subject
      if (!categorized) {
        if (email.from.includes('sentry')) {
          categories[LABEL_SENTRY].push(email);
        } else {
          categories['Other'].push(email);
        }
      }
    });

    // Print categorized results
    Object.entries(categories).forEach(([category, items]) => {
      if (items.length > 0) {
        console.log(`\n${category} (${items.length}):`);
        console.log('─'.repeat(80));
        items.slice(0, 5).forEach(email => {
          const sender = extractDisplayName(email.from);
          console.log(`  • ${email.subject.substring(0, 60)}`);
          console.log(`    From: ${sender.substring(0, 50)}`);
        });
        if (items.length > 5) {
          console.log(`  ... and ${items.length - 5} more`);
        }
      }
    });

    console.log('\n' + '═'.repeat(80));
    console.log('\nSUMMARY\n');
    Object.entries(categories).forEach(([category, items]) => {
      if (items.length > 0) {
        console.log(`  ${category}: ${items.length}`);
      }
    });
    console.log(`\nTotal: ${messageIds.length}`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

listUnreadEmails().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
