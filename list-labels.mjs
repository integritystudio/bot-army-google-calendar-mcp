import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function listLabels() {
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

  try {
    const labels = await gmail.users.labels.list({ userId: 'me' });

    console.log('📂 ALL GMAIL LABELS\n');
    console.log('═'.repeat(80) + '\n');

    labels.data.labels.forEach(label => {
      console.log(`${label.name}`);
      console.log(`  ID: ${label.id}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listLabels();
