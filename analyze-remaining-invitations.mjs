import { createGmailClient } from './lib/gmail-client.mjs';
import { extractEmailAddress } from './lib/email-utils.mjs';

async function analyzeRemainingInvitations() {
  const gmail = createGmailClient();

  console.log('📊 ANALYZING REMAINING INVITATIONS CATEGORIES\n');
  console.log('═'.repeat(80) + '\n');

  const categories = [
    { name: 'Professional', labelId: 'Label_15' },
    { name: 'Conferences', labelId: 'Label_17' },
    { name: 'Community Services', labelId: 'Label_18' },
  ];

  for (const category of categories) {
    try {
      console.log(`📋 ${category.name.toUpperCase()}\n`);

      const messagesResult = await gmail.users.messages.list({
        userId: 'me',
        labelIds: [category.labelId],
        maxResults: 100,
      });

      if (!messagesResult.data.messages) {
        console.log('  No emails found\n');
        console.log('═'.repeat(80) + '\n');
        continue;
      }

      const count = messagesResult.data.messages.length;
      console.log(`  Total: ${count} emails\n`);

      // Fetch message details
      const messages = [];
      for (const msgHeader of messagesResult.data.messages.slice(0, 30)) {
        try {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: msgHeader.id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From'],
          });

          const headers = msg.data.payload.headers || [];
          const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
          const from = headers.find(h => h.name === 'From')?.value || '(unknown)';

          messages.push({ subject, from });
        } catch (error) {
          // Skip
        }
      }

      // Show samples
      console.log('  Sample subjects:\n');
      const samples = [...new Set(messages.map(m => m.subject))].slice(0, 5);
      for (const subject of samples) {
        const truncated = subject.length > 70
          ? subject.substring(0, 70) + '...'
          : subject;
        console.log(`    • ${truncated}`);
      }

      console.log('\n  Primary senders:\n');
      const senders = {};
      for (const msg of messages) {
        const senderEmail = extractEmailAddress(msg.from);
        senders[senderEmail] = (senders[senderEmail] || 0) + 1;
      }

      const topSenders = Object.entries(senders)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      for (const [sender, count] of topSenders) {
        console.log(`    • ${sender} (${count})`);
      }

      console.log('\n' + '═'.repeat(80) + '\n');

    } catch (error) {
      console.log(`  Error: ${error.message}\n`);
      console.log('═'.repeat(80) + '\n');
    }
  }

  console.log('💡 ANALYSIS SUMMARY\n');
  console.log('Professional (LinkedIn): Career events, industry conferences, professional development');
  console.log('Conferences: Major events (SXSW, festivals, summits)');
  console.log('Community Services: Local community organizations and volunteer opportunities\n');
}

analyzeRemainingInvitations();
