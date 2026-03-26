import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, LABEL_EVENTS_COMMUNITY, LABEL_EVENTS_COMMUNITY_CREATIVE_ARTS, LABEL_EVENTS_COMMUNITY_TECH_PROFESSIONAL, LABEL_EVENTS_COMMUNITY_SPIRITUAL_WELLNESS, LABEL_EVENTS_COMMUNITY_NETWORKING, LABEL_EVENTS_COMMUNITY_LEARNING_EDUCATION, LABEL_EVENTS_COMMUNITY_SOCIAL_RECREATION, LABEL_EVENTS_COMMUNITY_FOOD_DINING } from './lib/constants.mjs';
import { getHeader } from './lib/email-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';

async function labelFinalCommunity() {
  const gmail = createGmailClient();

  console.log('📂 LABELING FINAL COMMUNITY EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  const labelCache = await buildLabelCache(gmail);
  const communityLabelId = labelCache.get(LABEL_EVENTS_COMMUNITY);
  const subLabelMap = {
    [labelCache.get(LABEL_EVENTS_COMMUNITY_CREATIVE_ARTS)]: 'Creative-Arts',
    [labelCache.get(LABEL_EVENTS_COMMUNITY_TECH_PROFESSIONAL)]: 'Tech-Professional',
    [labelCache.get(LABEL_EVENTS_COMMUNITY_SPIRITUAL_WELLNESS)]: 'Spiritual-Wellness',
    [labelCache.get(LABEL_EVENTS_COMMUNITY_NETWORKING)]: 'Networking',
    [labelCache.get(LABEL_EVENTS_COMMUNITY_LEARNING_EDUCATION)]: 'Learning-Education',
    [labelCache.get(LABEL_EVENTS_COMMUNITY_SOCIAL_RECREATION)]: 'Social-Recreation',
    [labelCache.get(LABEL_EVENTS_COMMUNITY_FOOD_DINING)]: 'Food-Dining',
  };

  const emailAssignments = [
    { subject: 'Observability at the edge', labelId: labelCache.get(LABEL_EVENTS_COMMUNITY_TECH_PROFESSIONAL) },
    { subject: 'Sacred Vessel: Nutrition for Intuition', labelId: labelCache.get(LABEL_EVENTS_COMMUNITY_SPIRITUAL_WELLNESS) },
    { subject: 'Love & Relationship Tarot', labelId: labelCache.get(LABEL_EVENTS_COMMUNITY_SPIRITUAL_WELLNESS) },
    { subject: 'Observability for LLM Apps', labelId: labelCache.get(LABEL_EVENTS_COMMUNITY_TECH_PROFESSIONAL) },
    { subject: 'Strategies for Validating World Models', labelId: labelCache.get(LABEL_EVENTS_COMMUNITY_LEARNING_EDUCATION) },
    { subject: 'Intuitive Numerology', labelId: labelCache.get(LABEL_EVENTS_COMMUNITY_SPIRITUAL_WELLNESS) },
  ];

  const allMessages = await gmail.users.messages.list({
    userId: USER_ID,
    labelIds: [communityLabelId],
    maxResults: 500
  });

  const subLabelIds = Object.keys(subLabelMap).filter(Boolean);
  const labeledMessages = await Promise.all(
    subLabelIds.map(id =>
      gmail.users.messages.list({ userId: USER_ID, labelIds: [id], maxResults: 500 })
    )
  );

  const labeledIds = new Set();
  labeledMessages.forEach(result => {
    result.data.messages?.forEach(m => labeledIds.add(m.id));
  });

  const unlabeled = allMessages.data.messages?.filter(m => !labeledIds.has(m.id)) || [];
  console.log(`Processing ${unlabeled.length} remaining emails\n`);

  const fullMsgs = await Promise.all(
    unlabeled.map(msgHeader =>
      gmail.users.messages.get({
        userId: USER_ID,
        id: msgHeader.id,
        format: 'metadata',
        metadataHeaders: ['Subject']
      })
    )
  );

  const matches = {};
  let matchedCount = 0;

  for (const msg of fullMsgs) {
    const subject = getHeader(msg.data.payload.headers, 'Subject');

    for (const assignment of emailAssignments) {
      if (subject.includes(assignment.subject)) {
        if (!matches[assignment.labelId]) {
          matches[assignment.labelId] = [];
        }
        matches[assignment.labelId].push(msg.data.id);
        matchedCount++;
        break;
      }
    }
  }

  for (const [labelId, messageIds] of Object.entries(matches)) {
    try {
      await gmail.users.messages.batchModify({
        userId: USER_ID,
        requestBody: {
          ids: messageIds,
          addLabelIds: [labelId]
        }
      });

      console.log(`✅ ${subLabelMap[labelId]}: ${messageIds.length} emails`);
    } catch (error) {
      console.log(`⚠️  ${subLabelMap[labelId]}: ${error.message}`);
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
