import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function deleteSentryFilter() {
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

  console.log('🗑️  DELETING SENTRY ALERTS FILTER\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get all filters
    const filtersResponse = await gmail.users.settings.filters.list({ userId: 'me' });
    const filters = filtersResponse.data.filter || [];

    // Find Sentry filter
    const sentryFilter = filters.find(f =>
      f.criteria?.query?.includes('from:noreply@md.getsentry.com')
    );

    if (!sentryFilter) {
      console.log('⚠️  Sentry Alerts filter not found\n');
      console.log('═'.repeat(80) + '\n');
      return;
    }

    // Delete the filter
    await gmail.users.settings.filters.delete({
      userId: 'me',
      id: sentryFilter.id
    });

    console.log('✅ SENTRY ALERTS FILTER DELETED\n');
    console.log(`Filter ID: ${sentryFilter.id}`);
    console.log(`Criteria: ${sentryFilter.criteria.query}\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteSentryFilter().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
