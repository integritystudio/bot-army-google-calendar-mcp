import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, LABEL_EVENTS_COMMUNITY, LABEL_EVENTS_COMMUNITY_CREATIVE_ARTS, LABEL_EVENTS_COMMUNITY_TECH_PROFESSIONAL, LABEL_EVENTS_COMMUNITY_SPIRITUAL_WELLNESS, LABEL_EVENTS_COMMUNITY_NETWORKING, LABEL_EVENTS_COMMUNITY_LEARNING_EDUCATION, LABEL_EVENTS_COMMUNITY_SOCIAL_RECREATION, LABEL_EVENTS_COMMUNITY_FOOD_DINING } from './lib/constants.mjs';
import { getHeader } from './lib/email-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';

async function labelRemainingCommunity() {
  const gmail = createGmailClient();

  console.log('📂 LABELING REMAINING COMMUNITY EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  const labelCache = await buildLabelCache(gmail);
  const communityLabelId = labelCache.get(LABEL_EVENTS_COMMUNITY);

  const allMessages = await gmail.users.messages.list({
    userId: USER_ID,
    labelIds: [communityLabelId],
    maxResults: 500
  });

  const subLabelIds = [
    LABEL_EVENTS_COMMUNITY_CREATIVE_ARTS,
    LABEL_EVENTS_COMMUNITY_TECH_PROFESSIONAL,
    LABEL_EVENTS_COMMUNITY_SPIRITUAL_WELLNESS,
    LABEL_EVENTS_COMMUNITY_NETWORKING,
    LABEL_EVENTS_COMMUNITY_LEARNING_EDUCATION,
    LABEL_EVENTS_COMMUNITY_SOCIAL_RECREATION,
    LABEL_EVENTS_COMMUNITY_FOOD_DINING,
  ].map(name => labelCache.get(name)).filter(Boolean);
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
  console.log(`Unlabeled emails to process: ${unlabeled.length}\n`);

  const categoryPatterns = {
    [labelCache.get(LABEL_EVENTS_COMMUNITY_CREATIVE_ARTS)]: {
      name: 'Creative-Arts',
      patterns: [/art|drawing|creative|sketch|music|design|performance|painting/i]
    },
    [labelCache.get(LABEL_EVENTS_COMMUNITY_TECH_PROFESSIONAL)]: {
      name: 'Tech-Professional',
      patterns: [/tech|coding|development|robotics|ai|computer|data|engineering|elasticsearch|infra|platform|search|governance|rule/i]
    },
    [labelCache.get(LABEL_EVENTS_COMMUNITY_SPIRITUAL_WELLNESS)]: {
      name: 'Spiritual-Wellness',
      patterns: [/astrology|psychic|meditation|healing|yoga|zen|conscious|spiritual|energy|chakra|reiki|enlightenment|manifestation|angel|astrological|embodied|nervous system|stress/i]
    },
    [labelCache.get(LABEL_EVENTS_COMMUNITY_NETWORKING)]: {
      name: 'Networking',
      patterns: [/networking|community|group|meetup|connect|gathering|forum|mastermind|entrepreneur/i]
    },
    [labelCache.get(LABEL_EVENTS_COMMUNITY_LEARNING_EDUCATION)]: {
      name: 'Learning-Education',
      patterns: [/workshop|class|course|training|learn|skill|development|masterclass/i]
    },
    [labelCache.get(LABEL_EVENTS_COMMUNITY_SOCIAL_RECREATION)]: {
      name: 'Social-Recreation',
      patterns: [/game|night|party|gathering|social|fun|recreation|laugh|wine|trivia|taboo|closet/i]
    },
    [labelCache.get(LABEL_EVENTS_COMMUNITY_FOOD_DINING)]: {
      name: 'Food-Dining',
      patterns: [/lunch|dinner|food|restaurant|cafe|coffee|eat|brunch|feast/i]
    },
  };

  let labeledCount = 0;

  const fullMsgs = await Promise.all(
    unlabeled.map(msgHeader =>
      gmail.users.messages.get({
        userId: USER_ID,
        id: msgHeader.id,
        format: 'metadata',
        metadataHeaders: ['Subject']
      }).catch(() => null)
    )
  );

  const emailsToLabel = [];

  for (const msg of fullMsgs.filter(Boolean)) {
    const subject = getHeader(msg.data.payload.headers, 'Subject');

    let matchedLabelId = null;
    for (const [labelId, config] of Object.entries(categoryPatterns)) {
      for (const pattern of config.patterns) {
        if (pattern.test(subject)) {
          matchedLabelId = labelId;
          break;
        }
      }
      if (matchedLabelId) break;
    }

    if (matchedLabelId) {
      emailsToLabel.push({ id: msg.data.id, labelId: matchedLabelId, subject });
    }
  }

  const labelGroups = {};
  for (const email of emailsToLabel) {
    if (!labelGroups[email.labelId]) {
      labelGroups[email.labelId] = [];
    }
    labelGroups[email.labelId].push(email.id);
  }

  for (const [labelId, messageIds] of Object.entries(labelGroups)) {
    const displayName = categoryPatterns[labelId]?.name ?? labelId;
    try {
      await batchModifyMessages(gmail, messageIds, { addLabelIds: [labelId] });
      console.log(`✅ ${displayName}: ${messageIds.length} emails`);
      labeledCount += messageIds.length;
    } catch (error) {
      console.log(`⚠️  ${displayName}: ${error.message}`);
    }
  }

  console.log(`\n📊 Total labeled: ${labeledCount} emails`);
  console.log(`❌ Unmatched: ${unlabeled.length - labeledCount} emails\n`);

  console.log('═'.repeat(80));
  console.log('\n✨ REMAINING COMMUNITY EMAILS LABELED\n');
}

labelRemainingCommunity().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
