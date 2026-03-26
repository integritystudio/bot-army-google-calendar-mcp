import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID } from './lib/constants.mjs';
import { getHeader } from './lib/email-utils.mjs';

async function searchHackathon() {
  const gmail = createGmailClient();

  console.log('🔍 SEARCHING FOR "HACKATHON" IN EVENTS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const searchResult = await gmail.users.messages.list({
      userId: USER_ID,
      q: 'label:Events hackathon',
      maxResults: 100,
    });

    if (!searchResult.data.messages || searchResult.data.messages.length === 0) {
      console.log('❌ No hackathon emails found in Events\n');
      console.log('═'.repeat(80) + '\n');
      console.log('Searched in all Events sub-labels:');
      console.log('  • Events');
      console.log('  • Events/Meetup');
      console.log('  • Events/Calendly');
      console.log('  • Events/Community');
      console.log('  • Events/Workshops');
      console.log('  • Events/Invitations\n');
      return;
    }

    const count = searchResult.data.messages.length;
    console.log(`✅ Found ${count} email(s) mentioning "hackathon"\n`);
    console.log('═'.repeat(80) + '\n');

    const fullMsgs = await Promise.all(
      searchResult.data.messages.map(msgHeader =>
        gmail.users.messages.get({
          userId: USER_ID,
          id: msgHeader.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date', 'To'],
        }).catch(error => {
          console.log(`Error fetching message: ${error.message}`);
          return null;
        })
      )
    );

    const emails = fullMsgs
      .filter(Boolean)
      .map(msg => {
        const headers = msg.data.payload.headers || [];
        return {
          id: msg.data.id,
          subject: getHeader(headers, 'Subject', '(no subject)'),
          from: getHeader(headers, 'From', '(unknown)'),
          date: getHeader(headers, 'Date', '(no date)'),
          to: getHeader(headers, 'To', '(unknown)'),
        };
      });

    console.log('📧 HACKATHON EMAILS\n');

    for (const email of emails) {
      console.log(`Subject: ${email.subject}`);
      console.log(`From: ${email.from}`);
      console.log(`Date: ${email.date}`);
      console.log(`ID: ${email.id}\n`);
    }

    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

searchHackathon().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});