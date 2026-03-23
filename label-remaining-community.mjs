import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function labelRemainingCommunity() {
  const tokenFileData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  const accountMode = process.env.ACCOUNT_MODE || 'normal';
  const tokenData = tokenFileData[accountMode];

  const credPath = process.env.GOOGLE_OAUTH_CREDENTIALS || './credentials.json';
  const credData = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
  const oauth2Client = new OAuth2Client(
    credData.installed.client_id,
    credData.installed.client_secret,
    credData.installed.redirect_uris[0]
  );
  oauth2Client.setCredentials(tokenData);

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  console.log('📂 LABELING REMAINING COMMUNITY EMAILS\n');
  console.log('═'.repeat(80) + '\n');

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
  console.log(`Unlabeled emails to process: ${unlabeled.length}\n`);

  // Categorization patterns - more comprehensive
  const categoryPatterns = {
    'Label_31': { // Creative-Arts
      patterns: [/art|drawing|creative|sketch|music|design|performance|painting/i]
    },
    'Label_32': { // Tech-Professional
      patterns: [/tech|coding|development|robotics|ai|computer|data|engineering|elasticsearch|infra|platform|search|governance|rule/i]
    },
    'Label_33': { // Spiritual-Wellness
      patterns: [/astrology|psychic|meditation|healing|yoga|zen|conscious|spiritual|energy|chakra|reiki|enlightenment|manifestation|angel|astrological|embodied|nervous system|stress/i]
    },
    'Label_34': { // Networking
      patterns: [/networking|community|group|meetup|connect|gathering|forum|mastermind|entrepreneur/i]
    },
    'Label_35': { // Learning-Education
      patterns: [/workshop|class|course|training|learn|skill|development|masterclass/i]
    },
    'Label_36': { // Social-Recreation
      patterns: [/game|night|party|gathering|social|fun|recreation|laugh|wine|trivia|taboo|closet/i]
    },
    'Label_37': { // Food-Dining
      patterns: [/lunch|dinner|food|restaurant|cafe|coffee|eat|brunch|feast/i]
    }
  };

  let labeledCount = 0;

  // Fetch and categorize each unlabeled email
  const emailsToLabel = [];

  for (const msgHeader of unlabeled) {
    try {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: msgHeader.id,
        format: 'metadata',
        metadataHeaders: ['Subject']
      });

      const subject = msg.data.payload.headers.find(h => h.name === 'Subject')?.value || '';

      // Find matching category
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
        emailsToLabel.push({
          id: msgHeader.id,
          labelId: matchedLabelId,
          subject
        });
      }
    } catch (error) {
      // Skip
    }
  }

  // Group by label and batch apply
  const labelGroups = {};
  for (const email of emailsToLabel) {
    if (!labelGroups[email.labelId]) {
      labelGroups[email.labelId] = [];
    }
    labelGroups[email.labelId].push(email.id);
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

  for (const [labelId, messageIds] of Object.entries(labelGroups)) {
    try {
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: messageIds,
          addLabelIds: [labelId]
        }
      });

      console.log(`✅ ${labelNames[labelId]}: ${messageIds.length} emails`);
      labeledCount += messageIds.length;
    } catch (error) {
      console.log(`⚠️  ${labelNames[labelId]}: ${error.message}`);
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
