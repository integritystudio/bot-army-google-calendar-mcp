import { createGmailClient } from './lib/gmail-client.mjs';

async function listUnreadEmails() {
  const gmail = createGmailClient();

  console.log('📧 LISTING UNREAD EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get all unread messages
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 500
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Total unread: ${messageIds.length}\n`);

    if (messageIds.length === 0) {
      console.log('✅ Inbox is clean!\n');
      return;
    }

    // Get all labels first
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const labels = labelsResponse.data.labels || [];
    const labelMap = {};
    labels.forEach(l => { labelMap[l.id] = l.name; });

    // Get details for each message
    const emails = [];
    for (const msg of messageIds) {
      const fullMsg = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date']
      });

      const headers = fullMsg.data.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
      const from = headers.find(h => h.name === 'From')?.value || '(unknown)';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      const msgLabels = (fullMsg.data.labelIds || []).map(id => labelMap[id]).filter(Boolean);

      emails.push({
        id: msg.id,
        subject,
        from,
        date,
        labels: msgLabels
      });
    }

    // Categorize emails
    const categories = {
      'Sentry Alerts': [],
      'Keep Important': [],
      'Events': [],
      'Monitoring': [],
      'Product Updates': [],
      'Communities': [],
      'Services & Alerts': [],
      'Billing': [],
      'Other': []
    };

    emails.forEach(email => {
      let categorized = false;

      // Check labels first
      if (email.labels.includes('Keep Important')) {
        categories['Keep Important'].push(email);
        categorized = true;
      } else if (email.labels.includes('Events')) {
        categories['Events'].push(email);
        categorized = true;
      } else if (email.labels.includes('Monitoring')) {
        categories['Monitoring'].push(email);
        categorized = true;
      } else if (email.labels.includes('Product Updates')) {
        categories['Product Updates'].push(email);
        categorized = true;
      } else if (email.labels.includes('Communities')) {
        categories['Communities'].push(email);
        categorized = true;
      } else if (email.labels.includes('Services & Alerts')) {
        categories['Services & Alerts'].push(email);
        categorized = true;
      } else if (email.labels.includes('Billing')) {
        categories['Billing'].push(email);
        categorized = true;
      }

      // Fallback: categorize by sender/subject
      if (!categorized) {
        if (email.from.includes('sentry')) {
          categories['Sentry Alerts'].push(email);
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
          const fromMatch = email.from.match(/([^<]+)/) || ['Unknown'];
          const sender = fromMatch[0].trim();
          console.log(`  • ${email.subject.substring(0, 60)}`);
          console.log(`    From: ${sender.substring(0, 50)}`);
        });
        if (items.length > 5) {
          console.log(`  ... and ${items.length - 5} more`);
        }
      }
    });

    // Summary
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
