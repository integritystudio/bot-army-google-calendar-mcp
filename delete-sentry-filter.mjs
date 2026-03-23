import { createGmailClient } from './lib/gmail-client.mjs';

async function deleteSentryFilter() {
  const gmail = createGmailClient();

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
