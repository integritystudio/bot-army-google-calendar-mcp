import { createGmailClient } from './lib/gmail-client.mjs';
import { LABEL_EVENTS_COMMUNITY } from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { fetchLabeledMessageMetadata } from './lib/gmail-message-utils.mjs';

async function analyzeCommunityEvents() {
  const gmail = createGmailClient();

  console.log('📊 ANALYZING COMMUNITY EVENT TYPES\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const labelCache = await buildLabelCache(gmail);
    const labelId = labelCache.get(LABEL_EVENTS_COMMUNITY);
    if (!labelId) {
      console.error('❌ Events/Community label not found');
      process.exit(1);
    }
    const { total, messages } = await fetchLabeledMessageMetadata(gmail, labelId);
    if (total === 0) {
      console.log('No community event emails found');
      return;
    }

    console.log(`📧 Found ${total} Community Event Emails\n`);
    console.log('═'.repeat(80) + '\n');

    const eventTypes = {
      'Spiritual/Wellness': [],
      'Creative/Arts': [],
      'Tech/Professional': [],
      'Social/Recreation': [],
      'Learning/Education': [],
      'Networking/Community': [],
      'Food/Dining': [],
      'Other': [],
    };

    const typePatterns = {
      'Spiritual/Wellness': /astrology|psychic|meditation|healing|yoga|zen|conscious|spiritual|energy|chakra|reiki|enlightenment/i,
      'Creative/Arts': /art|drawing|creative|sketch|music|design|performance|creative|painting/i,
      'Tech/Professional': /tech|coding|development|robotics|ai|computer|data|engineering/i,
      'Social/Recreation': /game|night|party|gathering|social|fun|recreation|laugh|wine|trivia/i,
      'Learning/Education': /workshop|class|course|training|learn|skill|development|masterclass/i,
      'Networking/Community': /networking|community|group|meetup|connect|gathering|forum/i,
      'Food/Dining': /lunch|dinner|food|restaurant|cafe|coffee|eat|brunch|feast/i,
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

    console.log('📋 COMMUNITY EVENT CATEGORIES\n');

    const sortedTypes = Object.entries(eventTypes)
      .filter(([_, emails]) => emails.length > 0)
      .sort((a, b) => b[1].length - a[1].length);

    for (const [type, emails] of sortedTypes) {
      const percentage = ((emails.length / messages.length) * 100).toFixed(0);
      console.log(`${type.toUpperCase()}`);
      console.log(`Count: ${emails.length} (${percentage}%)\n`);

      const samples = [...new Set(emails)].slice(0, 4);
      for (const subject of samples) {
        const truncated = subject.length > 70
          ? subject.substring(0, 70) + '...'
          : subject;
        console.log(`  • ${truncated}`);
      }

      if (samples.length < emails.length) {
        console.log(`  ... and ${emails.length - samples.length} more`);
      }
      console.log();
    }

    console.log('═'.repeat(80) + '\n');
    console.log('💡 RECOMMENDED SUB-LABELS:\n');

    for (const [type, emails] of sortedTypes) {
      if (emails.length > 0) {
        console.log(`  • Events/Community/${type}`);
      }
    }
    console.log();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeCommunityEvents().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});