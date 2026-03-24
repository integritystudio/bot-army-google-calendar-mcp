import { createGmailClient } from './lib/gmail-client.mjs';

async function relabelEventAnnouncements() {
  const gmail = createGmailClient();

  console.log('🏷️  RELABELING EVENT ANNOUNCEMENTS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Search for event announcements that are currently labeled as newsletters
    const eventAnnouncements = [
      'subject:"just scheduled" OR subject:"monthly astrology" OR subject:"avatar"',
      'subject:"monthly" AND (subject:event OR subject:astrology OR subject:avatar OR subject:waitlist)',
    ];

    const eventLabelId = 'Label_1'; // Events parent label
    const communitySubLabelId = 'Label_4'; // Events/Community
    const subjectBasedLabelId = 'Label_7'; // Newsletters/Subject-Based

    let totalProcessed = 0;

    for (const query of eventAnnouncements) {
      try {
        const searchResult = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 100,
        });

        if (!searchResult.data.messages) continue;

        const messageIds = searchResult.data.messages.map(m => m.id);
        const count = messageIds.length;

        if (count > 0) {
          // Add Events labels
          await gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
              ids: messageIds,
              addLabelIds: [eventLabelId, communitySubLabelId],
              removeLabelIds: [subjectBasedLabelId],
            },
          });

          console.log(`✅ Relabeled ${count} event announcements`);
          console.log(`   Query: "${query.substring(0, 60)}..."`);
          console.log(`   Added: Events, Events/Community`);
          console.log(`   Removed: Newsletters/Subject-Based\n`);

          totalProcessed += count;
        }
      } catch (error) {
        console.log(`⚠️  Error with query: ${error.message}\n`);
      }
    }

    console.log('═'.repeat(80) + '\n');
    console.log('✨ EVENT ANNOUNCEMENTS RELABELED\n');
    console.log(`  📌 Total emails relabeled: ${totalProcessed}`);
    console.log(`  📂 New location: Events > Community`);
    console.log(`  🗑️  Removed: Newsletters/Subject-Based\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

relabelEventAnnouncements().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});