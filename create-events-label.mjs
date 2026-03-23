import { createGmailClient } from './lib/gmail-client.mjs';

async function createEventsLabel() {
  const gmail = createGmailClient();

  try {
    const response = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: 'Events',
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
      console.log('⚠️  Label "Events" already exists\n');
      // Fetch existing label details
      const labels = await gmail.users.labels.list({ userId: 'me' });
      const existing = labels.data.labels.find(l => l.name === 'Events');
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
