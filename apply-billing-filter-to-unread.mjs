import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function applyBillingFilterToUnread() {
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

  console.log('💳 APPLYING BILLING FILTER TO UNREAD EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get labels
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const billingLabel = labelsResponse.data.labels.find(l => l.name === 'Billing');
    const keepImportantLabel = labelsResponse.data.labels.find(l => l.name === 'Keep Important');

    if (!billingLabel || !keepImportantLabel) {
      console.log('❌ Required labels not found\n');
      process.exit(1);
    }

    const billingLabelId = billingLabel.id;
    const keepImportantLabelId = keepImportantLabel.id;

    const billingKeywords = '(invoice OR billing OR payment OR charge OR receipt OR statement)';
    const urgentKeywords = '(late fee OR overdue OR "missed payment")';

    console.log('STEP 1: Finding unread urgent billing emails\n');

    // Find urgent billing emails
    const urgentQuery = `is:unread subject:${billingKeywords} subject:${urgentKeywords}`;
    const urgentResponse = await gmail.users.messages.list({
      userId: 'me',
      q: urgentQuery,
      maxResults: 100
    });

    const urgentIds = urgentResponse.data.messages || [];
    console.log(`Found ${urgentIds.length} unread urgent billing emails\n`);

    if (urgentIds.length > 0) {
      console.log('Applying labels: Billing + Keep Important (staying in inbox)...\n');
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
        const processed = Math.min(i + batchSize, urgentIds.length);
        console.log(`  ✅ Processed ${processed}/${urgentIds.length}`);
      }
    }

    console.log('\nSTEP 2: Finding unread regular billing emails (non-urgent)\n');

    // Find regular billing emails (excluding urgent)
    const regularQuery = `is:unread subject:${billingKeywords} -"late fee" -overdue -"missed payment"`;
    const regularResponse = await gmail.users.messages.list({
      userId: 'me',
      q: regularQuery,
      maxResults: 100
    });

    const regularIds = regularResponse.data.messages || [];
    console.log(`Found ${regularIds.length} unread regular billing emails\n`);

    if (regularIds.length > 0) {
      console.log('Applying labels: Billing (archiving)...\n');
      const batchSize = 50;
      for (let i = 0; i < regularIds.length; i += batchSize) {
        const batch = regularIds.slice(i, Math.min(i + batchSize, regularIds.length));
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [billingLabelId],
            removeLabelIds: ['INBOX']
          }
        });
        const processed = Math.min(i + batchSize, regularIds.length);
        console.log(`  ✅ Processed ${processed}/${regularIds.length}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log('Applied billing filters:');
    console.log(`  🚨 Urgent billing (late fees, overdue, missed payments): ${urgentIds.length}`);
    console.log(`     → Labels: Billing + Keep Important (staying in inbox)\n`);
    console.log(`  💳 Regular billing (invoices, payments, etc.): ${regularIds.length}`);
    console.log(`     → Labels: Billing (archived)\n`);
    console.log(`Total processed: ${urgentIds.length + regularIds.length} emails\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

applyBillingFilterToUnread().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
