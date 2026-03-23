import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function createBillingFilter() {
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

  console.log('💳 CREATING BILLING FILTER WITH SMART RULES\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get or create labels
    let billingLabelId, keepImportantLabelId;
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });

    // Find or create Billing label
    const billingLabel = labelsResponse.data.labels.find(l => l.name === 'Billing');
    if (billingLabel) {
      billingLabelId = billingLabel.id;
      console.log('✅ Using existing label: Billing\n');
    } else {
      const createBillingResponse = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: 'Billing',
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      billingLabelId = createBillingResponse.data.id;
      console.log('✅ Created label: Billing\n');
    }

    // Find Keep Important label
    const keepImportantLabel = labelsResponse.data.labels.find(l => l.name === 'Keep Important');
    if (keepImportantLabel) {
      keepImportantLabelId = keepImportantLabel.id;
      console.log('✅ Found label: Keep Important\n');
    } else {
      console.log('⚠️  Keep Important label not found\n');
    }

    // Define billing keywords
    const billingKeywords = '(invoice OR billing OR payment OR charge OR receipt OR statement)';

    console.log('STEP 1: Creating filters\n');

    // Filter 1: Billing emails WITH rate limit - keep in inbox (label both Billing & Keep Important)
    try {
      const labelIds = keepImportantLabelId
        ? [billingLabelId, keepImportantLabelId]
        : [billingLabelId];

      await gmail.users.settings.filters.create({
        userId: 'me',
        requestBody: {
          criteria: {
            query: `subject:${billingKeywords} subject:"rate limit"`
          },
          action: {
            addLabelIds: labelIds
          }
        }
      });
      console.log('✅ Filter 1: Billing + Rate Limit (KEEP IN INBOX)');
      console.log('   Criteria: Billing keywords + "rate limit"');
      console.log('   Action: Label Billing + Keep Important\n');
    } catch (error) {
      console.log(`⚠️  Filter 1 error: ${error.message}\n`);
    }

    // Filter 2: Billing emails WITHOUT rate limit - archive
    try {
      await gmail.users.settings.filters.create({
        userId: 'me',
        requestBody: {
          criteria: {
            query: `subject:${billingKeywords} -"rate limit"`
          },
          action: {
            addLabelIds: [billingLabelId],
            removeLabelIds: ['INBOX']
          }
        }
      });
      console.log('✅ Filter 2: Billing Only (SKIP INBOX)');
      console.log('   Criteria: Billing keywords, excluding "rate limit"');
      console.log('   Action: Label Billing + Archive\n');
    } catch (error) {
      console.log(`⚠️  Filter 2 error: ${error.message}\n`);
    }

    console.log('STEP 2: Applying to existing emails\n');

    // Apply to existing billing emails WITH rate limit
    const rateLimitQuery = `subject:${billingKeywords} subject:"rate limit"`;
    const rateLimitResponse = await gmail.users.messages.list({
      userId: 'me',
      q: rateLimitQuery,
      maxResults: 100
    });

    const rateLimitIds = rateLimitResponse.data.messages || [];
    if (rateLimitIds.length > 0) {
      const labelIds = keepImportantLabelId
        ? [billingLabelId, keepImportantLabelId]
        : [billingLabelId];

      const batchSize = 50;
      for (let i = 0; i < rateLimitIds.length; i += batchSize) {
        const batch = rateLimitIds.slice(i, Math.min(i + batchSize, rateLimitIds.length));
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: labelIds
          }
        });
      }
      console.log(`  ✅ Applied to ${rateLimitIds.length} rate limit emails (kept in inbox)`);
    }

    // Apply to existing billing emails WITHOUT rate limit
    const regularBillingQuery = `subject:${billingKeywords} -"rate limit"`;
    const regularBillingResponse = await gmail.users.messages.list({
      userId: 'me',
      q: regularBillingQuery,
      maxResults: 100
    });

    const regularBillingIds = regularBillingResponse.data.messages || [];
    if (regularBillingIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < regularBillingIds.length; i += batchSize) {
        const batch = regularBillingIds.slice(i, Math.min(i + batchSize, regularBillingIds.length));
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [billingLabelId],
            removeLabelIds: ['INBOX']
          }
        });
      }
      console.log(`  ✅ Applied to ${regularBillingIds.length} regular billing emails (archived)`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log('Billing Filter Rules:');
    console.log('  📌 Rate Limit Alerts → Label: Billing + Keep Important → STAY IN INBOX');
    console.log('  💳 Regular Billing → Label: Billing → ARCHIVED\n');
    console.log('Emails detected:');
    console.log(`  • Rate limit billing: ${rateLimitIds.length}`);
    console.log(`  • Regular billing: ${regularBillingIds.length}\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createBillingFilter().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
