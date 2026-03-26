import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID, GMAIL_INBOX, GMAIL_UNREAD, LABEL_SOCIAL, LABEL_MEETING_TRANSCRIPTS } from './lib/constants.mjs';

const gmail = createGmailClient();

console.log('🧹 FINAL CLEANUP\n');
console.log('═'.repeat(80) + '\n');

const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
const labels = labelsResponse.data.labels || [];
const labelMap = {};
labels.forEach(l => { labelMap[l.name] = l.id; });

let socialLabelId = labelMap[LABEL_SOCIAL];
if (!socialLabelId) {
  const createResp = await gmail.users.labels.create({
    userId: USER_ID,
    requestBody: {
      name: LABEL_SOCIAL,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show'
    }
  });
  socialLabelId = createResp.data.id;
  console.log('✅ Created Social label\n');
}

let transcriptLabelId = labelMap[LABEL_MEETING_TRANSCRIPTS];
if (!transcriptLabelId) {
  const createResp = await gmail.users.labels.create({
    userId: USER_ID,
    requestBody: {
      name: LABEL_MEETING_TRANSCRIPTS,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show'
    }
  });
  transcriptLabelId = createResp.data.id;
  console.log('✅ Created Meeting Transcripts label\n');
}

const dmarcQuery = 'from:(dmarcreport@microsoft.com OR noreply-dmarc-support@google.com)';
const linkedinQuery = 'from:updates-noreply@linkedin.com';
const meetQuery = 'from:meetings-noreply@google.com';

const [dmarcResp, linkedinResp, meetResp] = await Promise.all([
  gmail.users.messages.list({ userId: USER_ID, q: dmarcQuery, maxResults: 500 }),
  gmail.users.messages.list({ userId: USER_ID, q: linkedinQuery, maxResults: 500 }),
  gmail.users.messages.list({ userId: USER_ID, q: meetQuery, maxResults: 500 }),
]);

const dmarcIds = dmarcResp.data.messages || [];
const linkedinIds = linkedinResp.data.messages || [];
const meetIds = meetResp.data.messages || [];

console.log('STEP 1: DMARC Reports\n');
console.log(`Found ${dmarcIds.length} DMARC reports`);

if (dmarcIds.length > 0) {
  const batchSize = 50;
  for (let i = 0; i < dmarcIds.length; i += batchSize) {
    const batch = dmarcIds.slice(i, i + batchSize);
    await gmail.users.messages.batchModify({
      userId: USER_ID,
      requestBody: {
        ids: batch.map(m => m.id),
        removeLabelIds: [GMAIL_UNREAD]
      }
    });
  }
  console.log(`✅ Marked ${dmarcIds.length} as read\n`);
}

console.log('STEP 2: LinkedIn Updates\n');
console.log(`Found ${linkedinIds.length} LinkedIn emails`);

if (linkedinIds.length > 0) {
  const batchSize = 50;
  for (let i = 0; i < linkedinIds.length; i += batchSize) {
    const batch = linkedinIds.slice(i, i + batchSize);
    await gmail.users.messages.batchModify({
      userId: USER_ID,
      requestBody: {
        ids: batch.map(m => m.id),
        addLabelIds: [socialLabelId],
        removeLabelIds: [GMAIL_UNREAD]
      }
    });
  }
  console.log(`✅ Labeled and marked ${linkedinIds.length} as read\n`);
}

console.log('STEP 3: Google Meet Transcripts\n');
console.log(`Found ${meetIds.length} Google Meet notes`);

if (meetIds.length > 0) {
  const batchSize = 50;
  for (let i = 0; i < meetIds.length; i += batchSize) {
    const batch = meetIds.slice(i, i + batchSize);
    await gmail.users.messages.batchModify({
      userId: USER_ID,
      requestBody: {
        ids: batch.map(m => m.id),
        addLabelIds: [transcriptLabelId],
        removeLabelIds: [GMAIL_UNREAD, GMAIL_INBOX]
      }
    });
  }
  console.log(`✅ Labeled, archived, and marked ${meetIds.length} as read\n`);
}

console.log('═'.repeat(80));
console.log('COMPLETE\n');
console.log(`✅ DMARC reports: ${dmarcIds.length} marked read`);
console.log(`✅ LinkedIn: ${linkedinIds.length} labeled as Social + read`);
console.log(`✅ Google Meet: ${meetIds.length} labeled + archived + read\n`);
console.log(`Total cleaned: ${dmarcIds.length + linkedinIds.length + meetIds.length} emails\n`);
console.log('═'.repeat(80) + '\n');
