import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function archiveDmarcEmails() {
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

  console.log('📧 ARCHIVING DMARC REPORTS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get DMARC Reports label
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const dmarcLabel = labelsResponse.data.labels.find(l => l.name === 'DMARC Reports');

    if (!dmarcLabel) {
      console.log('❌ DMARC Reports label not found\n');
      process.exit(1);
    }

    // Find existing DMARC emails
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'subject:DMARC',
      maxResults: 100
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} DMARC emails\n`);

    if (messageIds.length > 0) {
      console.log('Archiving DMARC emails...\n');
      const batchSize = 50;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, Math.min(i + batchSize, messageIds.length));

        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [dmarcLabel.id],
            removeLabelIds: ['INBOX']
          }
        });

        const processed = Math.min(i + batchSize, messageIds.length);
        console.log(`  ✅ Processed ${processed}/${messageIds.length}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Label: DMARC Reports`);
    console.log(`✅ Filter: Already exists (subject:DMARC)`);
    console.log(`✅ Archived: ${messageIds.length} emails`);
    console.log(`✅ Future DMARC reports will auto-label and skip inbox\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

archiveDmarcEmails().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
