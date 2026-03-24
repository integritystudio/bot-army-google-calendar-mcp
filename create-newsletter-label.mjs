import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID } from './lib/constants.mjs';
import { buildLabelCache, createLabels } from './lib/gmail-label-utils.mjs';

async function createNewsletterLabel() {
  const gmail = createGmailClient();

  // Pre-fetch existing labels to avoid N+1 queries
  const existingLabelsRes = await gmail.users.labels.list({
    userId: USER_ID,
    fields: 'labels(id,name,labelListVisibility,messagesTotal,threadsTotal)',
  });
  const existingLabelMap = new Map(
    existingLabelsRes.data.labels.map(l => [l.name, l])
  );

  const labelName = 'Newsletters';
  const labelIds = {};

  try {
    await createLabels(gmail, [labelName], labelIds, existingLabelMap);

    // Get full label details for display
    const labelId = labelIds[labelName];
    const labelsRes = await gmail.users.labels.get({
      userId: USER_ID,
      id: labelId,
    });
    const labelData = labelsRes.data;

    console.log('✅ Label created successfully!\n');
    console.log('Label Details:');
    console.log(`  Name: ${labelData.name}`);
    console.log(`  ID: ${labelData.id}`);
    console.log(`  Visibility: ${labelData.labelListVisibility}`);
    console.log(`  Messages: ${labelData.messagesTotal || 0}`);
    console.log(`  Threads: ${labelData.threadsTotal || 0}`);

    return labelData;
  } catch (error) {
    console.error('❌ Error creating label:', error.message);
    process.exit(1);
  }
}

createNewsletterLabel().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});