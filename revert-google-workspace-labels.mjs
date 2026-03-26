import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, LABEL_UPDATES, LABEL_ORG_GOOGLE_WORKSPACE } from './lib/constants.mjs';

async function revertGoogleWorkspaceLabels() {
  const gmail = createGmailClient();

  console.log('⏮️  REVERTING GOOGLE WORKSPACE LABELS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
    const updatesLabel = labelsResponse.data.labels.find(l => l.name === LABEL_UPDATES);
    const orgLabel = labelsResponse.data.labels.find(l => l.name === LABEL_ORG_GOOGLE_WORKSPACE);

    if (!updatesLabel && !orgLabel) {
      console.log('No labels to remove\n');
      return;
    }

    console.log('STEP 1: Finding labeled Google Workspace emails\n');

    const labelIds = [];
    if (updatesLabel) labelIds.push(`label:${updatesLabel.id}`);
    if (orgLabel) labelIds.push(`label:${orgLabel.id}`);

    const searchQuery = labelIds.join(' OR ');
    const searchResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: searchQuery,
      maxResults: 100
    });

    const messageIds = searchResponse.data.messages || [];
    console.log(`Found ${messageIds.length} emails with these labels\n`);

    if (messageIds.length > 0) {
      console.log('STEP 2: Removing labels\n');

      const removeLabelIds = [];
      if (updatesLabel) removeLabelIds.push(updatesLabel.id);
      if (orgLabel) removeLabelIds.push(orgLabel.id);

      const batchSize = 50;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);

        await gmail.users.messages.batchModify({
          userId: USER_ID,
          requestBody: {
            ids: batch.map(m => m.id),
            removeLabelIds: removeLabelIds
          }
        });

        const processed = i + batch.length;
        console.log(`  ✅ Removed from ${processed}/${messageIds.length}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ Reverted: ${messageIds.length} emails`);
    if (updatesLabel) console.log(`✅ Removed label: Updates`);
    if (orgLabel) console.log(`✅ Removed label: Organization: Google Workspace`);
    console.log('\n');
    console.log('Note: Labels still exist but are no longer applied to emails\n');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

revertGoogleWorkspaceLabels().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
