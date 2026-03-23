import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function listRemaining() {
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

  console.log('📧 REMAINING UNREAD EMAILS IN INBOX\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Search for unread emails still in inbox
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread is:inbox',
      maxResults: 100
    });

    const messageIds = response.data.messages || [];
    console.log(`Total remaining: ${messageIds.length} unread emails\n`);

    if (messageIds.length === 0) {
      console.log('✅ INBOX CLEAR! No unread emails remaining.\n');
      console.log('═'.repeat(80) + '\n');
      return;
    }

    // Fetch details for each message
    const messages = await Promise.all(
      messageIds.map(async (msg) => {
        const fullMsg = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date']
        });

        const headers = fullMsg.data.payload?.headers || [];
        return {
          id: msg.id,
          subject: headers.find((h) => h.name === 'Subject')?.value || '(No subject)',
          from: headers.find((h) => h.name === 'From')?.value || '(Unknown)',
          date: headers.find((h) => h.name === 'Date')?.value || '',
          snippet: fullMsg.data.snippet || ''
        };
      })
    );

    // Display emails
    messages.forEach((email, idx) => {
      console.log(`${idx + 1}. 👤 ${email.from.substring(0, 50)}`);
      console.log(`   📌 ${email.subject.substring(0, 65)}`);
      console.log(`   📝 ${email.snippet.substring(0, 70)}...`);
      console.log(`   📅 ${email.date.substring(0, 30)}\n`);
    });

    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listRemaining().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
