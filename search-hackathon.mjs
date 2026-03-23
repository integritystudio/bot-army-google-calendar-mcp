import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function searchHackathon() {
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

  console.log('🔍 SEARCHING FOR "HACKATHON" IN EVENTS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Search for hackathon in all Events labels
    const searchResult = await gmail.users.messages.list({
      userId: 'me',
      q: 'label:Events hackathon',
      maxResults: 100,
    });

    if (!searchResult.data.messages || searchResult.data.messages.length === 0) {
      console.log('❌ No hackathon emails found in Events\n');
      console.log('═'.repeat(80) + '\n');
      console.log('Searched in all Events sub-labels:');
      console.log('  • Events');
      console.log('  • Events/Meetup');
      console.log('  • Events/Calendly');
      console.log('  • Events/Community');
      console.log('  • Events/Workshops');
      console.log('  • Events/Invitations\n');
      return;
    }

    const count = searchResult.data.messages.length;
    console.log(`✅ Found ${count} email(s) mentioning "hackathon"\n`);
    console.log('═'.repeat(80) + '\n');

    // Fetch full details for each email
    const emails = [];
    for (const msgHeader of searchResult.data.messages) {
      try {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: msgHeader.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date', 'To'],
        });

        const headers = msg.data.payload.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
        const from = headers.find(h => h.name === 'From')?.value || '(unknown)';
        const date = headers.find(h => h.name === 'Date')?.value || '(no date)';
        const to = headers.find(h => h.name === 'To')?.value || '(unknown)';

        emails.push({
          id: msgHeader.id,
          subject,
          from,
          date,
          to,
        });
      } catch (error) {
        console.log(`Error fetching message: ${error.message}`);
      }
    }

    // Display results
    console.log('📧 HACKATHON EMAILS\n');

    for (const email of emails) {
      console.log(`Subject: ${email.subject}`);
      console.log(`From: ${email.from}`);
      console.log(`Date: ${email.date}`);
      console.log(`ID: ${email.id}\n`);
    }

    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

searchHackathon();
