import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, LABEL_EVENTS_MEETUP } from './lib/constants.mjs';

async function createEventsMeetupSkipFilter() {
  const gmail = createGmailClient();

  console.log('📅 CREATING EVENTS/MEETUP SKIP INBOX FILTER\n');
  console.log('═'.repeat(80) + '\n');

  try {
    console.log('Creating filter to skip inbox for Events/Meetup...\n');

    const response = await gmail.users.settings.filters.create({
      userId: USER_ID,
      requestBody: {
        criteria: {
          query: `label:"${LABEL_EVENTS_MEETUP}"`,
        },
        action: {
          skip: true,
          removeLabelIds: [GMAIL_INBOX],
        },
      },
    });

    console.log('✅ FILTER CREATED SUCCESSFULLY\n');
    console.log('Filter Details:');
    console.log(`  ID: ${response.data.id}`);
    console.log(`  Name: Skip Inbox for Events/Meetup`);
    console.log(`  Criteria: label:"Events/Meetup"`);
    console.log(`  Action: Archive (skip inbox)\n`);

    console.log('═'.repeat(80) + '\n');
    console.log('📊 WHAT THIS DOES:\n');
    console.log('  ✓ All Meetup event notifications will be archived');
    console.log('  ✓ They won\'t appear in your Inbox');
    console.log('  ✓ They\'ll still be available under Events/Meetup label');
    console.log('  ✓ Keeps your inbox clean from event invitations\n');
    console.log('═'.repeat(80) + '\n');
    console.log('💡 NOTE:\n');
    console.log('This filter applies to future emails only.');
    console.log('To archive existing Meetup emails from inbox, you can:');
    console.log('  1. Go to Gmail settings');
    console.log('  2. Search: label:"Events/Meetup" is:in inbox');
    console.log('  3. Select all and archive\n');

  } catch (error) {
    if (error.message.includes('exists')) {
      console.log('⚠️  Filter already exists for skipping Events/Meetup inbox\n');
    } else {
      console.error('❌ Error creating filter:', error.message);
      process.exit(1);
    }
  }
}

createEventsMeetupSkipFilter().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
