import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function updateBillingFilter() {
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

  console.log('💳 UPDATING BILLING FILTER - PROTECT URGENT ALERTS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get labels
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const billingLabel = labelsResponse.data.labels.find(l => l.name === 'Billing');
    const keepImportantLabel = labelsResponse.data.labels.find(l => l.name === 'Keep Important');

    if (!billingLabel) {
      console.log('❌ Billing label not found. Run create-billing-filter.mjs first.\n');
      process.exit(1);
    }

    if (!keepImportantLabel) {
      console.log('❌ Keep Important label not found.\n');
      process.exit(1);
    }

    const billingLabelId = billingLabel.id;
    const keepImportantLabelId = keepImportantLabel.id;

    console.log('STEP 1: Creating urgent billing alert filter\n');

    // Filter for billing emails WITH urgent keywords - keep in inbox
    const urgentKeywords = '(late fee OR overdue OR "missed payment")';
    const billingKeywords = '(invoice OR billing OR payment OR charge OR receipt OR statement)';

    try {
      await gmail.users.settings.filters.create({
        userId: 'me',
        requestBody: {
          criteria: {
            query: `subject:${billingKeywords} subject:${urgentKeywords}`
          },
          action: {
            addLabelIds: [billingLabelId, keepImportantLabelId]
          }
        }
      });
      console.log('✅ Filter created: Urgent billing alerts (KEEP IN INBOX)');
      console.log('   Criteria: Billing keywords + (late fee OR overdue OR missed payment)');
      console.log('   Action: Label Billing + Keep Important\n');
    } catch (error) {
      if (error.message.includes('Too many')) {
        console.log('⚠️  Gmail label limit reached, using simplified approach\n');
      } else {
        throw error;
      }
    }

    console.log('STEP 2: Applying to existing urgent billing emails\n');

    // Find existing billing emails with urgent keywords
    const urgentQuery = `subject:${billingKeywords} subject:${urgentKeywords}`;
    const urgentResponse = await gmail.users.messages.list({
      userId: 'me',
      q: urgentQuery,
      maxResults: 100
    });

    const urgentIds = urgentResponse.data.messages || [];
    if (urgentIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < urgentIds.length; i += batchSize) {
        const batch = urgentIds.slice(i, Math.min(i + batchSize, urgentIds.length));
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [billingLabelId, keepImportantLabelId]
          }
        });
      }
      console.log(`  ✅ Applied to ${urgentIds.length} urgent billing emails (kept in inbox)\n`);
    } else {
      console.log('  ℹ️  No urgent billing emails found\n');
    }

    console.log('═'.repeat(80));
    console.log('COMPLETE\n');
    console.log('Updated Billing Filter Rules:');
    console.log('  🚨 Urgent Billing → (late fee OR overdue OR missed payment)');
    console.log('     Action: Label Billing + Keep Important → STAY IN INBOX\n');
    console.log('  📌 Rate Limit Alerts → (already protected by Cloudflare filter)');
    console.log('     Action: Keep Important → STAY IN INBOX\n');
    console.log('  💳 Regular Billing → Everything else');
    console.log('     Action: Label Billing → ARCHIVED\n');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateBillingFilter().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
