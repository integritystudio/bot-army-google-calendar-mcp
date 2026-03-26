import { createGmailClient } from './lib/gmail-client.mjs';
import { LABEL_EVENTS_INVITATIONS_WORK } from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { fetchLabeledMessageMetadata } from './lib/gmail-message-utils.mjs';

async function analyzeWorkInvitations() {
  const gmail = createGmailClient();

  console.log('📊 ANALYZING WORK MEETING INVITATIONS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const labelCache = await buildLabelCache(gmail);
    const labelId = labelCache.get(LABEL_EVENTS_INVITATIONS_WORK);
    if (!labelId) {
      console.log('Events/Invitations/Work label not found');
      return;
    }
    const { total, messages } = await fetchLabeledMessageMetadata(gmail, labelId);
    if (total === 0) {
      console.log('No work invitation emails found');
      return;
    }

    console.log(`📧 Found ${total} Work Meeting Invitations\n`);
    console.log('═'.repeat(80) + '\n');

    const meetingTypes = {
      'One-on-One Meetings': [],
      'Team Meetings': [],
      'Standup/Check-in': [],
      'Interviews': [],
      'Internal Meetings': [],
      'External/Client': [],
      'Project Coordination': [],
      'Admin/HR': [],
      'Other Work': [],
    };

    const typePatterns = {
      'One-on-One Meetings': /1:1|one-on-one|one on one|individual|personal|private meeting/i,
      'Team Meetings': /team|group|sync|all hands|standup|sync/i,
      'Standup/Check-in': /standup|check.?in|status|daily|morning/i,
      'Interviews': /interview|screening|assessment|technical interview/i,
      'Internal Meetings': /meeting|discussion|review|planning|strategy/i,
      'External/Client': /client|customer|external|partner|vendor/i,
      'Project Coordination': /project|sprint|planning|roadmap|backlog|epic/i,
      'Admin/HR': /onboarding|hr|benefits|payroll|admin|compliance/i,
    };

    for (const msg of messages) {
      let categorized = false;
      for (const [type, pattern] of Object.entries(typePatterns)) {
        if (pattern.test(msg.subject)) {
          meetingTypes[type].push(msg);
          categorized = true;
          break;
        }
      }
      if (!categorized) {
        meetingTypes['Other Work'].push(msg);
      }
    }

    console.log('📋 WORK MEETING TYPES\n');

    const sortedTypes = Object.entries(meetingTypes)
      .filter(([_, emails]) => emails.length > 0)
      .sort((a, b) => b[1].length - a[1].length);

    for (const [type, emails] of sortedTypes) {
      const percentage = ((emails.length / messages.length) * 100).toFixed(0);
      console.log(`${type.toUpperCase()}`);
      console.log(`Count: ${emails.length} (${percentage}%)\n`);

      const samples = [...new Set(emails.map(m => m.subject))].slice(0, 4);
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
        console.log(`  • Events/Invitations/Work/${type}`);
      }
    }
    console.log();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeWorkInvitations().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});