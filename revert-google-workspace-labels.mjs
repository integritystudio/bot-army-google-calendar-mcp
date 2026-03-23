import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function revertGoogleWorkspaceLabels() {
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

  console.log('⏮️  REVERTING GOOGLE WORKSPACE LABELS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get labels
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const updatesLabel = labelsResponse.data.labels.find(l => l.name === 'Updates');
    const orgLabel = labelsResponse.data.labels.find(l => l.name === 'Organization: Google Workspace');

    if (!updatesLabel && !orgLabel) {
      console.log('No labels to remove\n');
      return;
    }

    // Find Google Workspace emails with these labels
    console.log('STEP 1: Finding labeled Google Workspace emails\n');

    const labelIds = [];
    if (updatesLabel) labelIds.push(`label:${updatesLabel.id}`);
    if (orgLabel) labelIds.push(`label:${orgLabel.id}`);

    const searchQuery = labelIds.join(' OR ');
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults: 100
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} emails with these labels\n`);

    if (messageIds.length > 0) {
      console.log('STEP 2: Removing labels\n');

      const removeLabelIds = [];
      if (updatesLabel) removeLabelIds.push(updatesLabel.id);
      if (orgLabel) removeLabelIds.push(orgLabel.id);

      const batchSize = 50;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, Math.min(i + batchSize, messageIds.length));

        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch.map(m => m.id),
            removeLabelIds: removeLabelIds
          }
        });

        const processed = Math.min(i + batchSize, messageIds.length);
        console.log(`  ✅ Removed from ${processed}/${messageIds.length}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Reverted: ${messageIds.length} emails`);
    if (updatesLabel) console.log(`✅ Removed label: Updates`);
    if (orgLabel) console.log(`✅ Removed label: Organization: Google Workspace`);
    console.log('\n');
    console.log('Note: Labels still exist but are no longer applied to emails\n');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

revertGoogleWorkspaceLabels().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
