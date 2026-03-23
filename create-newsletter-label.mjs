import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function createNewsletterLabel() {
  if (!fs.existsSync(TOKEN_PATH)) {
    console.error('❌ Gmail tokens not found. Run: node auth-gmail.mjs');
    process.exit(1);
  }

  const tokenFileData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  const accountMode = process.env.ACCOUNT_MODE || 'normal';
  const tokenData = tokenFileData[accountMode];

  if (!tokenData) {
    console.error(`❌ No tokens found for account mode: ${accountMode}`);
    process.exit(1);
  }

  const credPath = process.env.GOOGLE_OAUTH_CREDENTIALS || './credentials.json';
  if (!fs.existsSync(credPath)) {
    console.error('❌ Credentials file not found:', credPath);
    process.exit(1);
  }

  const credData = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
  const oauth2Client = new OAuth2Client(
    credData.installed.client_id,
    credData.installed.client_secret,
    credData.installed.redirect_uris[0]
  );
  oauth2Client.setCredentials(tokenData);

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    const response = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: 'Newsletters',
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });

    console.log('✅ Label created successfully!\n');
    console.log('Label Details:');
    console.log(`  Name: ${response.data.name}`);
    console.log(`  ID: ${response.data.id}`);
    console.log(`  Visibility: ${response.data.labelListVisibility}`);
    console.log(`  Messages: ${response.data.messagesTotal || 0}`);
    console.log(`  Threads: ${response.data.threadsTotal || 0}`);

    return response.data;
  } catch (error) {
    if (error.message.includes('exists') || error.message.includes('conflicts')) {
      console.log('⚠️  Label "Newsletters" already exists\n');
      // Fetch existing label details
      const labels = await gmail.users.labels.list({ userId: 'me' });
      const existing = labels.data.labels.find(l => l.name === 'Newsletters');
      if (existing) {
        console.log('Label Details:');
        console.log(`  Name: ${existing.name}`);
        console.log(`  ID: ${existing.id}`);
        console.log(`  Visibility: ${existing.labelListVisibility}`);
        console.log(`  Messages: ${existing.messagesTotal || 0}`);
        console.log(`  Threads: ${existing.threadsTotal || 0}`);
      }
    } else {
      console.error('❌ Error creating label:', error.message);
      process.exit(1);
    }
  }
}

createNewsletterLabel();
