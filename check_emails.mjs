import { createGmailClient } from './lib/gmail-client.mjs';
import { USER_ID } from './lib/constants.mjs';
import { getHeader } from './lib/email-utils.mjs';

async function checkUnreadEmails() {
  try {
    const gmail = createGmailClient();

    const response = await gmail.users.messages.list({
      userId: USER_ID,
      q: "is:unread",
      maxResults: 100
    });

    const messageIds = response.data.messages || [];
    console.log(`Found ${messageIds.length} unread messages\n`);

    const messages = await Promise.all(
      messageIds.map(async (msg) => {
        try {
          const fullMsg = await gmail.users.messages.get({
            userId: USER_ID,
            id: msg.id,
            format: "metadata",
            metadataHeaders: ["Subject", "From", "Date"]
          });

          const headers = fullMsg.data.payload?.headers || [];
          return {
            id: msg.id,
            subject: getHeader(headers, 'Subject', '(No subject)'),
            from: getHeader(headers, 'From', '(Unknown sender)'),
            date: getHeader(headers, 'Date'),
            snippet: fullMsg.data.snippet || ''
          };
        } catch (error) {
          return null;
        }
      })
    );

    const validMessages = messages.filter(m => m !== null);

    const categorized = {
      highUrgencyHighImportance: [],
      highUrgencyMediumImportance: [],
      highUrgencyLowImportance: [],
      mediumUrgencyHighImportance: [],
      mediumUrgencyMediumImportance: [],
      mediumUrgencyLowImportance: [],
      lowUrgencyHighImportance: [],
      lowUrgencyMediumImportance: [],
      lowUrgencyLowImportance: []
    };

    validMessages.forEach(msg => {
      const { urgency, importance } = categorizeEmail(msg);
      
      const key = `${urgency}Urgency${importance}Importance`;
      if (categorized[key]) {
        categorized[key].push(msg);
      }
    });

    outputResults(categorized);

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function categorizeEmail(msg) {
  const subject = msg.subject.toLowerCase();
  const from = msg.from.toLowerCase();
  const snippet = msg.snippet.toLowerCase();
  const content = `${subject} ${from} ${snippet}`;

  let urgency = 'medium';
  const highUrgencyKeywords = [
    'urgent', 'asap', 'immediate', 'urgent action', 'critical',
    'emergency', 'alert', 'action required', 'deadline today',
    'review needed today'
  ];

  const lowUrgencyKeywords = [
    'fyi', 'newsletter', 'digest', 'weekly', 'monthly',
    'update', 'news', 'magazine', 'notification'
  ];

  if (highUrgencyKeywords.some(kw => content.includes(kw))) {
    urgency = 'high';
  } else if (lowUrgencyKeywords.some(kw => content.includes(kw))) {
    urgency = 'low';
  }

  let importance = 'medium';
  const highImportanceKeywords = [
    'boss', 'manager', 'ceo', 'cto', 'director',
    'invoice', 'payment', 'contract', 'proposal',
    'approved', 'rejected', 'decision', 'approval',
    'meeting', 'urgent meeting', 'all hands'
  ];

  const lowImportanceKeywords = [
    'marketing', 'promotion', 'sale', 'discount',
    'follow us', 'subscribe', 'unsubscribe', 'social'
  ];

  if (highImportanceKeywords.some(kw => content.includes(kw))) {
    importance = 'high';
  } else if (lowImportanceKeywords.some(kw => content.includes(kw))) {
    importance = 'low';
  }

  return { urgency, importance };
}

function outputResults(categorized) {
  console.log("=".repeat(80));
  console.log("UNREAD EMAIL SUMMARY - CATEGORIZED BY URGENCY & IMPORTANCE");
  console.log("=".repeat(80));

  const categories = [
    { key: 'highUrgencyHighImportance', icon: '🔴', label: 'HIGH URGENCY + HIGH IMPORTANCE (ACT NOW!)' },
    { key: 'highUrgencyMediumImportance', icon: '🟠', label: 'HIGH URGENCY + MEDIUM IMPORTANCE (SOON)' },
    { key: 'highUrgencyLowImportance', icon: '🟡', label: 'HIGH URGENCY + LOW IMPORTANCE (QUICK)' },
    { key: 'mediumUrgencyHighImportance', icon: '🔵', label: 'MEDIUM URGENCY + HIGH IMPORTANCE (IMPORTANT)' },
    { key: 'mediumUrgencyMediumImportance', icon: '⚪', label: 'MEDIUM URGENCY + MEDIUM IMPORTANCE (NORMAL)' },
    { key: 'mediumUrgencyLowImportance', icon: '⚪', label: 'MEDIUM URGENCY + LOW IMPORTANCE (CAN WAIT)' },
    { key: 'lowUrgencyHighImportance', icon: '💙', label: 'LOW URGENCY + HIGH IMPORTANCE (READ LATER)' },
    { key: 'lowUrgencyMediumImportance', icon: '⚪', label: 'LOW URGENCY + MEDIUM IMPORTANCE (BACKGROUND)' },
    { key: 'lowUrgencyLowImportance', icon: '⚪', label: 'LOW URGENCY + LOW IMPORTANCE (ARCHIVE?)' }
  ];

  let totalProcessed = 0;

  categories.forEach(category => {
    const emails = categorized[category.key] || [];
    if (emails.length === 0) return;

    console.log(`\n${category.icon} ${category.label}`);
    console.log("-".repeat(80));
    console.log(`Count: ${emails.length}\n`);

    emails.forEach((email, idx) => {
      const fromName = email.from.substring(0, 50);
      const subject = email.subject.substring(0, 60);
      const preview = email.snippet.substring(0, 70);
      console.log(`${idx + 1}. FROM: ${fromName}`);
      console.log(`   SUBJECT: ${subject}`);
      console.log(`   PREVIEW: ${preview}...`);
      console.log();
      totalProcessed++;
    });
  });

  console.log("=".repeat(80));
  console.log(`SUMMARY: ${totalProcessed} unread emails categorized`);
  console.log("=".repeat(80));

  console.log("\nCATEGORY BREAKDOWN:");
  categories.forEach(category => {
    const count = categorized[category.key]?.length || 0;
    if (count > 0) {
      const label = category.label.split('(')[0].trim();
      console.log(`  ${category.icon} ${label}: ${count}`);
    }
  });
}

checkUnreadEmails().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});