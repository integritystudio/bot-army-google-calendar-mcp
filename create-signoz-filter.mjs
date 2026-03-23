import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function createSignozFilter() {
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

  console.log('📊 CREATING SIGNOZ ALERTS FILTER\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get or create SigNoz label
    let signozLabelId;
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const existingLabel = labelsResponse.data.labels.find(l => l.name === 'Monitoring');

    if (existingLabel) {
      signozLabelId = existingLabel.id;
      console.log('✅ Using existing label: Monitoring\n');
    } else {
      const createLabelResponse = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: 'Monitoring',
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      signozLabelId = createLabelResponse.data.id;
      console.log('✅ Created label: Monitoring\n');
    }

    // Create filter for future emails
    await gmail.users.settings.filters.create({
      userId: 'me',
      requestBody: {
        criteria: {
          query: 'from:alertmanager@signoz.cloud'
        },
        action: {
          addLabelIds: [signozLabelId],
          removeLabelIds: ['INBOX']
        }
      }
    });
    console.log('✅ Filter created for future SigNoz alerts\n');

    // Apply to existing emails
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:alertmanager@signoz.cloud'
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`📊 Found ${messageIds.length} existing SigNoz emails\n`);

    if (messageIds.length > 0) {
      console.log('Archiving existing SigNoz emails...\n');
      const batchSize = 50;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, Math.min(i + batchSize, messageIds.length));

        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [signozLabelId],
            removeLabelIds: ['INBOX']
          }
        });

        const processed = Math.min(i + batchSize, messageIds.length);
        console.log(`  ✅ Processed ${processed}/${messageIds.length}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Label: Monitoring`);
    console.log(`✅ Filter: from:alertmanager@signoz.cloud`);
    console.log(`✅ Archived: ${messageIds.length} existing emails`);
    console.log(`✅ Future SigNoz alerts will auto-label and skip inbox\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createSignozFilter().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
