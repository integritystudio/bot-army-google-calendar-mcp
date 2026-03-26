import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, LABEL_EVENTS_CALENDLY, LABEL_EVENTS_COMMUNITY, LABEL_EVENTS_WORKSHOPS, LABEL_EVENTS_INVITATIONS } from './lib/constants.mjs';
import { extractEmailAddress, getHeader } from './lib/email-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';

async function analyzeEventsDetailed() {
  const gmail = createGmailClient();

  console.log('📊 DETAILED EVENT CATEGORIES ANALYSIS\n');
  console.log('═'.repeat(80) + '\n');

  const labelCache = await buildLabelCache(gmail);
  const categories = [
    { name: 'Events/Calendly', labelId: labelCache.get(LABEL_EVENTS_CALENDLY) },
    { name: 'Events/Community', labelId: labelCache.get(LABEL_EVENTS_COMMUNITY) },
    { name: 'Events/Workshops', labelId: labelCache.get(LABEL_EVENTS_WORKSHOPS) },
    { name: 'Events/Invitations', labelId: labelCache.get(LABEL_EVENTS_INVITATIONS) },
  ].filter(c => c.labelId);

  for (const category of categories) {
    try {
      console.log(`📋 ${category.name.toUpperCase()}\n`);

      const messagesResult = await gmail.users.messages.list({
        userId: USER_ID,
        labelIds: [category.labelId],
        maxResults: 100,
      });

      if (!messagesResult.data.messages) {
        console.log('  No emails found\n');
        console.log('═'.repeat(80) + '\n');
        continue;
      }

      const count = messagesResult.data.messages.length;
      console.log(`  Total emails: ${count}\n`);

      const fullMsgs = await Promise.all(
        messagesResult.data.messages.slice(0, 30).map(msgHeader =>
          gmail.users.messages.get({
            userId: USER_ID,
            id: msgHeader.id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'Date'],
          }).catch(() => null)
        )
      );

      const messages = fullMsgs
        .filter(Boolean)
        .map(msg => {
          const headers = msg.data.payload.headers || [];
          return {
            subject: getHeader(headers, 'Subject', '(no subject)'),
            from: getHeader(headers, 'From', '(unknown)'),
            date: getHeader(headers, 'Date', '(no date)'),
          };
        });

      const eventTypes = {
        'Meeting Reminders': [],
        'Registration Confirmations': [],
        'Setup/Onboarding': [],
        'Team Coordination': [],
        'Event Announcements': [],
        'Scheduling Links': [],
        'Support/Help': [],
        'Other': [],
      };

      const typePatterns = {
        'Meeting Reminders': /reminder|confirm|upcoming|scheduled/i,
        'Registration Confirmations': /confirm|register|registration|registered/i,
        'Setup/Onboarding': /set up|setup|welcome|getting started|onboard/i,
        'Team Coordination': /team|admin|integration|feature/i,
        'Event Announcements': /event|happening|scheduled|join/i,
        'Scheduling Links': /calendar|link|schedule|book/i,
        'Support/Help': /support|help|question|issue|feedback/i,
      };

      for (const msg of messages) {
        let categorized = false;
        for (const [type, pattern] of Object.entries(typePatterns)) {
          if (pattern.test(msg.subject)) {
            eventTypes[type].push(msg.subject);
            categorized = true;
            break;
          }
        }
        if (!categorized) {
          eventTypes['Other'].push(msg.subject);
        }
      }

      console.log('  Types:\n');
      const sortedTypes = Object.entries(eventTypes)
        .filter(([_, items]) => items.length > 0)
        .sort((a, b) => b[1].length - a[1].length);

      for (const [type, items] of sortedTypes) {
        const percentage = ((items.length / messages.length) * 100).toFixed(0);
        console.log(`    ${type}: ${items.length} (${percentage}%)`);
      }

      console.log('\n  Sample subjects:\n');
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
      console.log(`  Error analyzing: ${error.message}\n`);
      console.log('═'.repeat(80) + '\n');
    }
  }

  console.log('💡 SUMMARY\n');
  console.log('Event categories breakdown:');
  console.log('  • Events/Calendly: Scheduling platform notifications (reminders, setup, team coordination)');
  console.log('  • Events/Community: Community events (spiritual, art, networking)');
  console.log('  • Events/Workshops: Educational/professional development');
  console.log('  • Events/Invitations: Calendar invitations and RSVP requests\n');
}

analyzeEventsDetailed().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
