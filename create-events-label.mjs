import { createGmailClient } from './lib/gmail-client.mjs';

const USER_ID = 'me';

async function createEventsLabel() {
  const gmail = createGmailClient();

  // Pre-fetch existing labels to avoid N+1 queries
  const existingLabelsRes = await gmail.users.labels.list({
    userId: USER_ID,
    fields: 'labels(id,name,labelListVisibility,messagesTotal,threadsTotal)',
  });
  const existingLabelMap = new Map(
    existingLabelsRes.data.labels.map(l => [l.name, l])
  );

  const labelName = 'Events';

  try {
    const response = await gmail.users.labels.create({
      userId: USER_ID,
      requestBody: {
        name: labelName,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });

    console.log('✅ Label created successfully!\n');
    console.log('Label Details:');
    console.log(`  Name: ${response.data.name}`);
    console.log(`  ID: ${response.data.id}`);
    console.log(`  Visibility: ${response.data.labelListVisibility}`);
    console.log(`  Messages: ${response.data.messagesTotal || 0}`);
    console.log(`  Threads: ${response.data.threadsTotal || 0}`);

    return response.data;
  } catch (error) {
    if (error.message.includes('exists') || error.message.includes('conflicts')) {
      console.log(`⚠️  Label "${labelName}" already exists\n`);
      const existing = existingLabelMap.get(labelName);
      if (existing) {
        console.log('Label Details:');
        console.log(`  Name: ${existing.name}`);
        console.log(`  ID: ${existing.id}`);
        console.log(`  Visibility: ${existing.labelListVisibility}`);
        console.log(`  Messages: ${existing.messagesTotal || 0}`);
        console.log(`  Threads: ${existing.threadsTotal || 0}`);
      }
    } else {
      console.error('❌ Error creating label:', error.message);
      process.exit(1);
    }
  }
}

createEventsLabel();
