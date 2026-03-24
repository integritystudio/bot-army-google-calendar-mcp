import { initializeOAuth2Client } from './src/auth/client.js';
import { TokenManager } from './src/auth/tokenManager.js';
import { ListEventsHandler } from './src/handlers/core/ListEventsHandler.js';
import { GmailSearchHandler } from './src/handlers/gmail/GmailSearchHandler.js';

async function main() {
  try {
    // Initialize OAuth2 client and token manager
    const oauth2Client = await initializeOAuth2Client();
    const tokenManager = new TokenManager(oauth2Client);

    // Load valid tokens
    const accountMode = tokenManager.getAccountMode();
    const hasValidTokens = await tokenManager.validateTokens(accountMode);

    if (!hasValidTokens) {
      console.error('No valid tokens found. Please run "npm run auth" first.');
      process.exit(1);
    }

    // Get upcoming events for the next 7 days
    console.log('📅 Fetching upcoming events (next 7 days)...\n');

    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const listEvents = new ListEventsHandler();
    const eventsResult = await listEvents.runTool(
      {
        calendarId: 'primary',
        timeMin,
        timeMax,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      oauth2Client
    );

    const eventText = eventsResult.content?.[0]?.text || '';
    console.log(eventText);

    // Search for event emails
    console.log('\n\n🔍 Searching for event-related emails...\n');

    const gmailSearch = new GmailSearchHandler();
    const emailResult = await gmailSearch.execute(
      { query: 'subject:event OR subject:invitation', maxResults: 20 },
      oauth2Client
    );

    if (emailResult.messages && emailResult.messages.length > 0) {
      console.log(`📧 Found ${emailResult.total} matching emails (showing ${emailResult.returned}):\n`);
      emailResult.messages.forEach((msg: any, i: number) => {
        console.log(`${i + 1}. ${msg.subject || '(no subject)'}`);
        if (msg.from) console.log(`   From: ${msg.from}`);
        if (msg.date) console.log(`   Date: ${msg.date}`);
        console.log();
      });
    } else {
      console.log('No event-related emails found.');
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
