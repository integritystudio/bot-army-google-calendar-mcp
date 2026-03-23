import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { extractEmailAddress } from './lib/email-utils.mjs';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function analyzeEventsDetailed() {
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

  console.log('📊 DETAILED EVENT CATEGORIES ANALYSIS\n');
  console.log('═'.repeat(80) + '\n');

  const categories = [
    { name: 'Events/Calendly', labelId: 'Label_3' },
    { name: 'Events/Community', labelId: 'Label_4' },
    { name: 'Events/Workshops', labelId: 'Label_5' },
    { name: 'Events/Invitations', labelId: 'Label_6' },
  ];

  for (const category of categories) {
    try {
      console.log(`📋 ${category.name.toUpperCase()}\n`);

      const messagesResult = await gmail.users.messages.list({
        userId: 'me',
        labelIds: [category.labelId],
        maxResults: 100,
      });

      if (!messagesResult.data.messages) {
        console.log('  No emails found\n');
        console.log('═'.repeat(80) + '\n');
        continue;
      }

      const count = messagesResult.data.messages.length;
      console.log(`  Total emails: ${count}\n`);

      // Fetch full message details
      const messages = [];
      for (const msgHeader of messagesResult.data.messages.slice(0, 30)) {
        try {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: msgHeader.id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'Date'],
          });

          const headers = msg.data.payload.headers || [];
          const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
          const from = headers.find(h => h.name === 'From')?.value || '(unknown)';
          const date = headers.find(h => h.name === 'Date')?.value || '(no date)';

          messages.push({ subject, from, date });
        } catch (error) {
          // Skip if can't fetch
        }
      }

      // Categorize by type
      const eventTypes = {
        'Meeting Reminders': [],
        'Registration Confirmations': [],
        'Setup/Onboarding': [],
        'Team Coordination': [],
        'Event Announcements': [],
        'Scheduling Links': [],
        'Support/Help': [],
        'Other': [],
      };

      const typePatterns = {
        'Meeting Reminders': /reminder|confirm|upcoming|scheduled/i,
        'Registration Confirmations': /confirm|register|registration|registered/i,
        'Setup/Onboarding': /set up|setup|welcome|getting started|onboard/i,
        'Team Coordination': /team|admin|integration|feature/i,
        'Event Announcements': /event|happening|scheduled|join/i,
        'Scheduling Links': /calendar|link|schedule|book/i,
        'Support/Help': /support|help|question|issue|feedback/i,
      };

      for (const msg of messages) {
        let categorized = false;
        for (const [type, pattern] of Object.entries(typePatterns)) {
          if (pattern.test(msg.subject)) {
            eventTypes[type].push(msg.subject);
            categorized = true;
            break;
          }
        }
        if (!categorized) {
          eventTypes['Other'].push(msg.subject);
        }
      }

      // Display breakdown
      console.log('  Types:\n');
      const sortedTypes = Object.entries(eventTypes)
        .filter(([_, items]) => items.length > 0)
        .sort((a, b) => b[1].length - a[1].length);

      for (const [type, items] of sortedTypes) {
        const percentage = ((items.length / messages.length) * 100).toFixed(0);
        console.log(`    ${type}: ${items.length} (${percentage}%)`);
      }

      // Sample emails
      console.log('\n  Sample subjects:\n');
      const samples = [...new Set(messages.map(m => m.subject))].slice(0, 5);
      for (const subject of samples) {
        const truncated = subject.length > 70
          ? subject.substring(0, 70) + '...'
          : subject;
        console.log(`    • ${truncated}`);
      }

      // Sender analysis
      console.log('\n  Primary senders:\n');
      const senders = {};
      for (const msg of messages) {
        const senderEmail = extractEmailAddress(msg.from);
        senders[senderEmail] = (senders[senderEmail] || 0) + 1;
      }

      const topSenders = Object.entries(senders)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      for (const [sender, count] of topSenders) {
        console.log(`    • ${sender} (${count})`);
      }

      console.log('\n' + '═'.repeat(80) + '\n');

    } catch (error) {
      console.log(`  Error analyzing: ${error.message}\n`);
      console.log('═'.repeat(80) + '\n');
    }
  }

  console.log('💡 SUMMARY\n');
  console.log('Event categories breakdown:');
  console.log('  • Events/Calendly: Scheduling platform notifications (reminders, setup, team coordination)');
  console.log('  • Events/Community: Community events (spiritual, art, networking)');
  console.log('  • Events/Workshops: Educational/professional development');
  console.log('  • Events/Invitations: Calendar invitations and RSVP requests\n');
}

analyzeEventsDetailed().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
