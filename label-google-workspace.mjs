import { createGmailClient } from './lib/gmail-client.mjs';

async function labelGoogleWorkspace() {
  const gmail = createGmailClient();

  console.log('🏷️  LABELING GOOGLE WORKSPACE EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get or create labels
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });

    // Get or create "Updates" label
    let updatesLabelId;
    const updatesLabel = labelsResponse.data.labels.find(l => l.name === 'Updates');
    if (updatesLabel) {
      updatesLabelId = updatesLabel.id;
      console.log('✅ Using existing label: Updates\n');
    } else {
      const createUpdatesResponse = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: 'Updates',
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      updatesLabelId = createUpdatesResponse.data.id;
      console.log('✅ Created label: Updates\n');
    }

    // Get or create "Organization: Google Workspace" label
    let orgLabelId;
    const orgLabel = labelsResponse.data.labels.find(l => l.name === 'Organization: Google Workspace');
    if (orgLabel) {
      orgLabelId = orgLabel.id;
      console.log('✅ Using existing label: Organization: Google Workspace\n');
    } else {
      const createOrgResponse = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: 'Organization: Google Workspace',
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      orgLabelId = createOrgResponse.data.id;
      console.log('✅ Created label: Organization: Google Workspace\n');
    }

    // Create filter for future emails
    console.log('STEP 1: Creating filter for future Google Workspace emails\n');
    try {
      await gmail.users.settings.filters.create({
        userId: 'me',
        requestBody: {
          criteria: {
            query: 'from:workspace-noreply@google.com'
          },
          action: {
            addLabelIds: [updatesLabelId, orgLabelId]
          }
        }
      });
      console.log('✅ Filter created for future emails\n');
    } catch (error) {
      if (error.message.includes('exists')) {
        console.log('ℹ️  Filter already exists\n');
      } else if (error.message.includes('Too many')) {
        console.log('⚠️  Gmail label limit reached for filter\n');
        console.log('   (Will still label existing emails manually)\n');
      } else {
        throw error;
      }
    }

    // Find and label existing emails
    console.log('STEP 2: Finding existing Google Workspace emails\n');

    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:workspace-noreply@google.com',
      maxResults: 100
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} Google Workspace emails\n`);

    if (messageIds.length > 0) {
      console.log('STEP 3: Applying labels\n');
      const batchSize = 50;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, Math.min(i + batchSize, messageIds.length));

        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch.map(m => m.id),
            addLabelIds: [updatesLabelId, orgLabelId]
          }
        });

        const processed = Math.min(i + batchSize, messageIds.length);
        console.log(`  ✅ Labeled ${processed}/${messageIds.length}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Label 1: Updates`);
    console.log(`✅ Label 2: Organization: Google Workspace`);
    console.log(`✅ Applied to: ${messageIds.length} emails`);
    console.log(`✅ Future emails will auto-label\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

labelGoogleWorkspace().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
