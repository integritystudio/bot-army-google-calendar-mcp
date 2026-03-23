import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function labelGoogleCloudFeb() {
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

  console.log('🏷️  LABELING GOOGLE CLOUD FEB UPDATE\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get Product Updates label
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const productLabel = labelsResponse.data.labels.find(l => l.name === 'Product Updates');

    if (!productLabel) {
      console.log('❌ Product Updates label not found\n');
      process.exit(1);
    }

    console.log('✅ Found label: Product Updates\n');

    // Find the Google Cloud Feb update email
    const searchQuery = 'from:CloudPlatform-noreply@google.com subject:"OpenTelemetry"';
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults: 10
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} matching email(s)\n`);

    if (messageIds.length === 0) {
      console.log('⚠️  No matching emails found\n');
      console.log('Trying alternative search...\n');

      // Try broader search
      const altSearchQuery = 'from:CloudPlatform-noreply@google.com subject:"OTLP ingestion"';
      const altResponse = await gmail.users.messages.list({
        userId: 'me',
        q: altSearchQuery,
        maxResults: 10
      });

      const altIds = altResponse.data.messages || [];
      if (altIds.length > 0) {
        console.log(`Found ${altIds.length} email(s) with alternative search\n`);

        for (const msg of altIds) {
          const fullMsg = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'Date']
          });

          const headers = fullMsg.data.payload?.headers || [];
          const subject = headers.find(h => h.name === 'Subject')?.value || '';
          const date = headers.find(h => h.name === 'Date')?.value || '';

          console.log(`Subject: ${subject}`);
          console.log(`Date: ${date}\n`);
        }

        // Label the emails
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: altIds.map(m => m.id),
            addLabelIds: [productLabel.id],
            removeLabelIds: ['INBOX']
          }
        });

        console.log(`✅ Labeled and archived ${altIds.length} email(s)\n`);
      } else {
        console.log('❌ No emails found\n');
      }
      return;
    }

    // Label the found email(s)
    for (const msg of messageIds) {
      const fullMsg = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'Date']
      });

      const headers = fullMsg.data.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      console.log(`Subject: ${subject}`);
      console.log(`Date: ${date}\n`);
    }

    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: messageIds.map(m => m.id),
        addLabelIds: [productLabel.id],
        removeLabelIds: ['INBOX']
      }
    });

    console.log('═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Labeled: Product Updates`);
    console.log(`✅ Archived: ${messageIds.length} email(s)\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

labelGoogleCloudFeb().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
