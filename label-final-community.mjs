import { createGmailClient } from './lib/gmail-client.mjs';

async function labelFinalCommunity() {
  const gmail = createGmailClient();

  console.log('📂 LABELING FINAL COMMUNITY EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  // Manual assignments based on remaining emails
  const emailAssignments = [
    {
      subject: 'Observability at the edge',
      labelId: 'Label_32' // Tech-Professional
    },
    {
      subject: 'Sacred Vessel: Nutrition for Intuition',
      labelId: 'Label_33' // Spiritual-Wellness
    },
    {
      subject: 'Love & Relationship Tarot',
      labelId: 'Label_33' // Spiritual-Wellness
    },
    {
      subject: 'Observability for LLM Apps',
      labelId: 'Label_32' // Tech-Professional
    },
    {
      subject: 'Strategies for Validating World Models',
      labelId: 'Label_35' // Learning-Education
    },
    {
      subject: 'Intuitive Numerology',
      labelId: 'Label_33' // Spiritual-Wellness
    }
  ];

  // Get all Community emails
  const allMessages = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['Label_4'],
    maxResults: 500
  });

  // Get emails already labeled
  const subLabelIds = ['Label_31', 'Label_32', 'Label_33', 'Label_34', 'Label_35', 'Label_36', 'Label_37'];
  const labeledMessages = await Promise.all(
    subLabelIds.map(id =>
      gmail.users.messages.list({ userId: 'me', labelIds: [id], maxResults: 500 })
    )
  );

  const labeledIds = new Set();
  labeledMessages.forEach(result => {
    result.data.messages?.forEach(m => labeledIds.add(m.id));
  });

  const unlabeled = allMessages.data.messages?.filter(m => !labeledIds.has(m.id)) || [];
  console.log(`Processing ${unlabeled.length} remaining emails\n`);

  // Match and label
  const matches = {};
  let matchedCount = 0;

  for (const msgHeader of unlabeled) {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: msgHeader.id,
      format: 'metadata',
      metadataHeaders: ['Subject']
    });

    const subject = msg.data.payload.headers.find(h => h.name === 'Subject')?.value || '';

    for (const assignment of emailAssignments) {
      if (subject.includes(assignment.subject)) {
        if (!matches[assignment.labelId]) {
          matches[assignment.labelId] = [];
        }
        matches[assignment.labelId].push(msgHeader.id);
        matchedCount++;
        break;
      }
    }
  }

  const labelNames = {
    'Label_31': 'Creative-Arts',
    'Label_32': 'Tech-Professional',
    'Label_33': 'Spiritual-Wellness',
    'Label_34': 'Networking',
    'Label_35': 'Learning-Education',
    'Label_36': 'Social-Recreation',
    'Label_37': 'Food-Dining'
  };

  // Apply labels
  for (const [labelId, messageIds] of Object.entries(matches)) {
    try {
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: messageIds,
          addLabelIds: [labelId]
        }
      });

      console.log(`✅ ${labelNames[labelId]}: ${messageIds.length} emails`);
    } catch (error) {
      console.log(`⚠️  ${labelNames[labelId]}: ${error.message}`);
    }
  }

  console.log(`\n📊 Total labeled: ${matchedCount} emails`);
  console.log(`❓ Unclassified: ${unlabeled.length - matchedCount} emails\n`);

  console.log('═'.repeat(80));
  console.log('\n✨ FINAL COMMUNITY EMAIL LABELING COMPLETE\n');
}

labelFinalCommunity().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
