import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID } from './lib/constants.mjs';

async function analyzeUnread() {
  const gmail = createGmailClient();

  console.log('🔍 ANALYZING UNREAD EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
    const labels = labelsResponse.data.labels || [];
    const labelMap = {};
    labels.forEach(l => { labelMap[l.id] = l.name; });

    const allUnreadResponse = await gmail.users.messages.list({
      userId: USER_ID,
      q: 'is:unread',
      maxResults: 500
    });

    const allUnread = allUnreadResponse.data.messages || [];
    console.log(`Total unread: ${allUnread.length}\n`);

    const chunkSize = 50;
    const fullMsgs = [];
    for (let i = 0; i < allUnread.length; i += chunkSize) {
      const chunk = await Promise.all(
        allUnread.slice(i, i + chunkSize).map(msg =>
          gmail.users.messages.get({ userId: USER_ID, id: msg.id })
        )
      );
      fullMsgs.push(...chunk);
    }

    const categories = {};

    for (const fullMsg of fullMsgs) {
      const msgLabels = (fullMsg.data.labelIds || []).map(id => labelMap[id]).filter(Boolean);
      const labelStr = msgLabels.length > 0 ? msgLabels.join(', ') : 'No labels';

      if (!categories[labelStr]) {
        categories[labelStr] = [];
      }
      categories[labelStr].push(fullMsg.data.id);
    }

    Object.entries(categories)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([labels, ids]) => {
        console.log(`${labels}: ${ids.length}`);
      });

    console.log('\n' + '═'.repeat(80));
    console.log(`\nBreakdown shows which labels most unread emails have.`);
    console.log(`Items with "No labels" are the best candidates for new filters.\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

analyzeUnread().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
