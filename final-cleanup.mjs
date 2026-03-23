import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');
const tokenFileData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
const accountMode = process.env.ACCOUNT_MODE || 'normal';
const tokenData = tokenFileData[accountMode];

const credPath = process.env.GOOGLE_OAUTH_CREDENTIALS || './credentials.json';
const credData = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
const oauth2Client = new OAuth2Client(
  credData.installed.client_id,
  credData.installed.client_secret,
  credData.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokenData);

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

console.log('🧹 FINAL CLEANUP\n');
console.log('═'.repeat(80) + '\n');

// Get or create labels
const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
const labels = labelsResponse.data.labels || [];
const labelMap = {};
labels.forEach(l => { labelMap[l.name] = l.id; });

// Create Social label if needed
let socialLabelId = labelMap['Social'];
if (!socialLabelId) {
  const createResp = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: 'Social',
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show'
    }
  });
  socialLabelId = createResp.data.id;
  console.log('✅ Created Social label\n');
}

// Create Meeting Transcripts label if needed
let transcriptLabelId = labelMap['Meeting Transcripts'];
if (!transcriptLabelId) {
  const createResp = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: 'Meeting Transcripts',
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show'
    }
  });
  transcriptLabelId = createResp.data.id;
  console.log('✅ Created Meeting Transcripts label\n');
}

// 1. Mark DMARC as read
console.log('STEP 1: DMARC Reports\n');
const dmarcQuery = 'from:(dmarcreport@microsoft.com OR noreply-dmarc-support@google.com)';
const dmarcResp = await gmail.users.messages.list({
  userId: 'me',
  q: dmarcQuery,
  maxResults: 500
});

const dmarcIds = dmarcResp.data.messages || [];
console.log(`Found ${dmarcIds.length} DMARC reports`);

if (dmarcIds.length > 0) {
  const batchSize = 50;
  for (let i = 0; i < dmarcIds.length; i += batchSize) {
    const batch = dmarcIds.slice(i, Math.min(i + batchSize, dmarcIds.length));
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: batch.map(m => m.id),
        removeLabelIds: ['UNREAD']
      }
    });
  }
  console.log(`✅ Marked ${dmarcIds.length} as read\n`);
}

// 2. Label LinkedIn as Social and mark read
console.log('STEP 2: LinkedIn Updates\n');
const linkedinQuery = 'from:updates-noreply@linkedin.com';
const linkedinResp = await gmail.users.messages.list({
  userId: 'me',
  q: linkedinQuery,
  maxResults: 500
});

const linkedinIds = linkedinResp.data.messages || [];
console.log(`Found ${linkedinIds.length} LinkedIn emails`);

if (linkedinIds.length > 0) {
  const batchSize = 50;
  for (let i = 0; i < linkedinIds.length; i += batchSize) {
    const batch = linkedinIds.slice(i, Math.min(i + batchSize, linkedinIds.length));
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: batch.map(m => m.id),
        addLabelIds: [socialLabelId],
        removeLabelIds: ['UNREAD']
      }
    });
  }
  console.log(`✅ Labeled and marked ${linkedinIds.length} as read\n`);
}

// 3. Label Google Meet transcripts and archive/mark read
console.log('STEP 3: Google Meet Transcripts\n');
const meetQuery = 'from:meetings-noreply@google.com';
const meetResp = await gmail.users.messages.list({
  userId: 'me',
  q: meetQuery,
  maxResults: 500
});

const meetIds = meetResp.data.messages || [];
console.log(`Found ${meetIds.length} Google Meet notes`);

if (meetIds.length > 0) {
  const batchSize = 50;
  for (let i = 0; i < meetIds.length; i += batchSize) {
    const batch = meetIds.slice(i, Math.min(i + batchSize, meetIds.length));
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: batch.map(m => m.id),
        addLabelIds: [transcriptLabelId],
        removeLabelIds: ['UNREAD', 'INBOX']
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
