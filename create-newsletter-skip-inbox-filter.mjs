import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function createNewsletterSkipInboxFilter() {
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

  console.log('📧 CREATING NEWSLETTER SKIP INBOX FILTER\n');
  console.log('═'.repeat(80) + '\n');

  try {
    console.log('Creating filter to skip inbox for all Newsletters...\n');

    const response = await gmail.users.settings.filters.create({
      userId: 'me',
      requestBody: {
        criteria: {
          query: 'label:Newsletters',
        },
        action: {
          skip: true,
          removeLabelIds: ['INBOX'],
        },
      },
    });

    console.log('✅ FILTER CREATED SUCCESSFULLY\n');
    console.log('Filter Details:');
    console.log(`  ID: ${response.data.id}`);
    console.log(`  Name: Skip Inbox for All Newsletters`);
    console.log(`  Criteria: label:Newsletters`);
    console.log(`  Action: Archive (skip inbox)\n`);

    console.log('═'.repeat(80) + '\n');
    console.log('📊 WHAT THIS DOES:\n');
    console.log('  ✓ All emails with the "Newsletters" label will be archived');
    console.log('  ✓ They won\'t appear in your Inbox');
    console.log('  ✓ They\'ll still be available under the Newsletters label');
    console.log('  ✓ Applies to all Newsletter sub-labels:');
    console.log('    • Newsletters/Company');
    console.log('    • Newsletters/News Aggregates');
    console.log('    • Newsletters/Social');
    console.log('    • Newsletters/Subject-Based');
    console.log('    • Newsletters/CCV');
    console.log('    • Newsletters/Sentry\n');
    console.log('═'.repeat(80) + '\n');
    console.log('💡 NOTE:\n');
    console.log('This filter applies to future emails only.');
    console.log('To archive existing newsletter emails from inbox, you can:');
    console.log('  1. Go to Gmail settings');
    console.log('  2. Search: label:Newsletters is:in inbox');
    console.log('  3. Select all and archive\n');

  } catch (error) {
    if (error.message.includes('exists')) {
      console.log('⚠️  Filter already exists for skipping Newsletters inbox\n');
    } else {
      console.error('❌ Error creating filter:', error.message);
      process.exit(1);
    }
  }
}

createNewsletterSkipInboxFilter().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
