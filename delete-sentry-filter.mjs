import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID } from './lib/constants.mjs';

async function deleteSentryFilter() {
  const gmail = createGmailClient();

  console.log('🗑️  DELETING SENTRY ALERTS FILTER\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const filtersResponse = await gmail.users.settings.filters.list({ userId: USER_ID });
    const filters = filtersResponse.data.filter || [];

    const sentryFilter = filters.find(f =>
      f.criteria?.query?.includes('from:noreply@md.getsentry.com')
    );

    if (!sentryFilter) {
      console.log('⚠️  Sentry Alerts filter not found\n');
      console.log('═'.repeat(80) + '\n');
      return;
    }

    await gmail.users.settings.filters.delete({
      userId: USER_ID,
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
