import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

async function checkUnreadEmails() {
  try {
    const credPath = path.join(process.cwd(), 'credentials.json');
    const credFile = JSON.parse(await fs.readFile(credPath, 'utf-8'));
    const cred = credFile.installed || credFile;

    const tokenPath = path.join(homedir(), '.config/google-calendar-mcp/tokens-gmail.json');
    const content = await fs.readFile(tokenPath, 'utf-8');
    const multiAccountTokens = JSON.parse(content);
    const tokens = multiAccountTokens['normal'];

    if (!tokens) {
      console.error('No tokens found');
      process.exit(1);
    }

    const oauth2Client = new OAuth2Client(
      cred.client_id,
      cred.client_secret,
      cred.redirect_uris[0]
    );

    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Fetch all unread messages with details
    const response = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults: 100
    });

    const messageIds = response.data.messages || [];
    console.log(`Found ${messageIds.length} unread messages\n`);

    // Fetch details for each message
    const messages = await Promise.all(
      messageIds.map(async (msg) => {
        try {
          const fullMsg = await gmail.users.messages.get({
            userId: "me",
            id: msg.id,
            format: "metadata",
            metadataHeaders: ["Subject", "From", "Date"]
          });

          const headers = fullMsg.data.payload?.headers || [];
          return {
            id: msg.id,
            subject: headers.find((h) => h.name === "Subject")?.value || "(No subject)",
            from: headers.find((h) => h.name === "From")?.value || "(Unknown sender)",
            date: headers.find((h) => h.name === "Date")?.value || "",
            snippet: fullMsg.data.snippet || ""
          };
        } catch (error) {
          return null;
        }
      })
    );

    const validMessages = messages.filter(m => m !== null);

    // Categorize messages
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

    // Output results
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

  // Urgency detection
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

  // Importance detection
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

  // Category breakdown
  console.log("\nCATEGORY BREAKDOWN:");
  categories.forEach(category => {
    const count = categorized[category.key]?.length || 0;
    if (count > 0) {
      const label = category.label.split('(')[0].trim();
      console.log(`  ${category.icon} ${label}: ${count}`);
    }
  });
}

checkUnreadEmails();
