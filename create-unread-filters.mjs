import { createGmailClient } from './lib/gmail-client.mjs';

const USER_ID = 'me';

async function createFilters() {
  const gmail = createGmailClient();

  console.log('📧 CREATING AUTO-ARCHIVE FILTERS FOR UNREAD EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  // Pre-fetch all labels once to avoid N+1 queries
  const existingLabelsRes = await gmail.users.labels.list({
    userId: USER_ID,
    fields: 'labels(id,name)'
  });
  const existingLabelMap = new Map(
    (existingLabelsRes.data.labels || []).map(l => [l.name, l.id])
  );

  // Define labels to create and filters
  const configs = [
    {
      name: 'Sentry Alerts',
      query: 'from:noreply@md.getsentry.com',
      description: 'Sentry error/alert notifications'
    },
    {
      name: 'Meetup Events',
      query: 'from:info@email.meetup.com',
      description: 'Meetup group invitations and event updates'
    },
    {
      name: 'Community Events',
      query: 'from:("ATX - Awkwardly Zen" OR "Austin Cafe Drawing Group" OR "Austin Robotics & AI")',
      description: 'Local community event invitations'
    },
    {
      name: 'Product Updates',
      query: 'from:(noreply@email.openai.com OR no-reply@email.claude.com OR googlecloud@google.com OR "AlphaSignal" OR lukak@storylane.io)',
      description: 'AI/SaaS product announcements and updates'
    },
    {
      name: 'Calendly Notifications',
      query: 'from:teamcalendly@send.calendly.com',
      description: 'Calendly team setup and scheduling guides'
    },
    {
      name: 'LinkedIn Updates',
      query: 'from:updates-noreply@linkedin.com',
      description: 'LinkedIn job notifications and updates'
    },
    {
      name: 'DMARC Reports',
      query: 'subject:DMARC',
      description: 'Automated DMARC aggregate reports'
    }
  ];

  const results = {
    created: [],
    skipped: [],
    errors: []
  };

  // Create labels
  console.log('STEP 1: Creating labels...\n');
  const labelMap = {};

  for (const config of configs) {
    // Check if label already exists in pre-fetched map
    if (existingLabelMap.has(config.name)) {
      labelMap[config.name] = existingLabelMap.get(config.name);
      console.log(`  ℹ️  Label already exists: ${config.name}`);
      continue;
    }

    try {
      const labelResponse = await gmail.users.labels.create({
        userId: USER_ID,
        requestBody: {
          name: config.name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      labelMap[config.name] = labelResponse.data.id;
      existingLabelMap.set(config.name, labelResponse.data.id);
      console.log(`  ✅ Created label: ${config.name}`);
    } catch (error) {
      console.log(`  ⚠️  Error creating label ${config.name}: ${error.message}`);
      results.errors.push({ config: config.name, error: error.message });
    }
  }

  console.log('\nSTEP 2: Creating filters...\n');

  // Create filters
  for (const config of configs) {
    const labelId = labelMap[config.name];
    if (!labelId) {
      console.log(`  ⚠️  Skipping filter for ${config.name} (label not created)`);
      results.skipped.push(config.name);
      continue;
    }

    try {
      await gmail.users.settings.filters.create({
        userId: USER_ID,
        requestBody: {
          criteria: {
            query: config.query
          },
          action: {
            addLabelIds: [labelId],
            removeLabelIds: ['INBOX']
          }
        }
      });
      console.log(`  ✅ Filter created: ${config.name}`);
      console.log(`     Query: ${config.query}`);
      console.log(`     Action: Label + Skip Inbox\n`);
      results.created.push(config.name);
    } catch (error) {
      console.log(`  ❌ Error creating filter for ${config.name}: ${error.message}\n`);
      results.errors.push({ config: config.name, error: error.message });
    }
  }

  // Summary
  console.log('═'.repeat(80));
  console.log('SUMMARY\n');
  console.log(`✅ Filters created: ${results.created.length}`);
  console.log(`⚠️  Filters skipped: ${results.skipped.length}`);
  console.log(`❌ Errors: ${results.errors.length}\n`);

  if (results.created.length > 0) {
    console.log('Created filters for:');
    results.created.forEach(name => console.log(`  • ${name}`));
    console.log('\n💡 These filters will:');
    console.log('  • Auto-label future incoming emails');
    console.log('  • Skip the inbox (archive automatically)');
    console.log('  • Keep emails accessible under their respective labels\n');
  }

  if (results.errors.length > 0) {
    console.log('Errors:');
    results.errors.forEach(e => console.log(`  • ${e.config}: ${e.error}`));
  }

  console.log('═'.repeat(80) + '\n');
}

createFilters().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
