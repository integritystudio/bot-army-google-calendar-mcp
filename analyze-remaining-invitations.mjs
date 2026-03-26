import { createGmailClient } from './lib/gmail-client.mjs';
import { LABEL_EVENTS_INVITATIONS_PROFESSIONAL, LABEL_EVENTS_INVITATIONS_CONFERENCES, LABEL_EVENTS_INVITATIONS_COMMUNITY_SERVICES } from './lib/constants.mjs';
import { extractEmailAddress } from './lib/email-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { fetchLabeledMessageMetadata } from './lib/gmail-message-utils.mjs';

async function analyzeRemainingInvitations() {
  const gmail = createGmailClient();

  console.log('📊 ANALYZING REMAINING INVITATIONS CATEGORIES\n');
  console.log('═'.repeat(80) + '\n');

  const labelCache = await buildLabelCache(gmail);
  const categories = [
    { name: 'Professional', labelId: labelCache.get(LABEL_EVENTS_INVITATIONS_PROFESSIONAL) },
    { name: 'Conferences', labelId: labelCache.get(LABEL_EVENTS_INVITATIONS_CONFERENCES) },
    { name: 'Community Services', labelId: labelCache.get(LABEL_EVENTS_INVITATIONS_COMMUNITY_SERVICES) },
  ].filter(c => c.labelId);

  for (const category of categories) {
    try {
      console.log(`📋 ${category.name.toUpperCase()}\n`);

      const { total, messages } = await fetchLabeledMessageMetadata(gmail, category.labelId, { limit: 30 });
      if (total === 0) {
        console.log('  No emails found\n');
        console.log('═'.repeat(80) + '\n');
        continue;
      }

      console.log(`  Total: ${total} emails\n`);

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

analyzeRemainingInvitations().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
