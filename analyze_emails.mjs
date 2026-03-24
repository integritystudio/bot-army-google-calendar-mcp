import { createGmailClient } from './lib/gmail-client.mjs';
import { extractDisplayName } from './lib/email-utils.mjs';

const FROM_MAX = 45;
const SUBJECT_MAX = 60;
const SNIPPET_MAX = 65;
const MAX_RESULTS = 100;

const DEFAULT_SCORE = 5;
const HIGH_SCORE = 9;
const LOW_SCORE = 2;
const HIGH_THRESHOLD = 7;
const LOW_THRESHOLD = 3;

const HIGH_URGENCY_KEYWORDS = ['urgent', 'asap', 'immediate', 'critical', 'emergency', 'alert'];
const LOW_URGENCY_KEYWORDS = ['fyi', 'newsletter', 'digest', 'weekly', 'monthly', 'notification'];
const HIGH_IMPORTANCE_KEYWORDS = ['manager', 'boss', 'ceo', 'invoice', 'payment', 'contract', 'approved', 'rejected', 'decision'];
const LOW_IMPORTANCE_KEYWORDS = ['marketing', 'promotion', 'sale', 'discount', 'follow', 'subscribe'];

const SECTION_DIVIDER = '═'.repeat(80);
const ROW_DIVIDER = '─'.repeat(76);

async function analyzeUnreadEmails() {
  try {
    const gmail = createGmailClient();

    const response = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults: MAX_RESULTS
    });

    const messageIds = response.data.messages || [];
    console.log(`\n📧 FOUND ${messageIds.length} UNREAD MESSAGES\n`);

    const headers = ['Subject', 'From'];
    const messages = await Promise.all(
      messageIds.map(async (msg) => {
        try {
          const fullMsg = await gmail.users.messages.get({
            userId: "me",
            id: msg.id,
            format: "metadata",
            metadataHeaders: headers
          });

          const headerList = fullMsg.data.payload?.headers || [];
          const getHeader = (name) => headerList.find((h) => h.name === name)?.value || '';

          return {
            id: msg.id,
            subject: getHeader('Subject') || "(No subject)",
            from: extractDisplayName(getHeader('From')) || "(Unknown sender)",
            snippet: fullMsg.data.snippet || ""
          };
        } catch (error) {
          console.warn(`Failed to fetch message ${msg.id}: ${error.message}`);
          return null;
        }
      })
    );

    const validMessages = messages.filter(Boolean);

    const matrix = {
      'HighHigh': [], 'HighMedium': [], 'HighLow': [],
      'MediumHigh': [], 'MediumMedium': [], 'MediumLow': [],
      'LowHigh': [], 'LowMedium': [], 'LowLow': []
    };

    validMessages.forEach(msg => {
      const { urgency, importance } = categorizeEmail(msg);
      const key = `${urgency}${importance}`;
      matrix[key].push(msg);
    });

    console.log("╔════════════════════════════════════════════════════════════════════════════════╗");
    console.log("║            UNREAD EMAIL MATRIX: URGENCY (rows) × IMPORTANCE (cols)            ║");
    console.log("╚════════════════════════════════════════════════════════════════════════════════╝\n");

    printSection('🔴 HIGH URGENCY EMAILS (ACT IMMEDIATELY!)', [
      { label: '⚠️  HIGH IMPORTANCE - CRITICAL (DO THIS NOW!)', emails: matrix.HighHigh },
      { label: '⚡ MEDIUM IMPORTANCE - IMPORTANT (HANDLE SOON)', emails: matrix.HighMedium },
      { label: '💨 LOW IMPORTANCE - QUICK ATTENTION (BRIEF)', emails: matrix.HighLow }
    ]);

    printSection('🟠 MEDIUM URGENCY EMAILS (ADDRESS TODAY)', [
      { label: '💼 HIGH IMPORTANCE - IMPORTANT (PRIORITIZE)', emails: matrix.MediumHigh },
      { label: '📧 MEDIUM IMPORTANCE - STANDARD (ROUTINE)', emails: matrix.MediumMedium },
      { label: '⏳ LOW IMPORTANCE - NOT URGENT (BACKLOG)', emails: matrix.MediumLow }
    ]);

    printSection('🟡 LOW URGENCY EMAILS (READ WHEN YOU HAVE TIME)', [
      { label: '📚 HIGH IMPORTANCE - READ LATER (VALUABLE)', emails: matrix.LowHigh },
      { label: '📰 MEDIUM IMPORTANCE - FYI (INFORMATIONAL)', emails: matrix.LowMedium, limit: 5 },
      { label: '🗑️  LOW IMPORTANCE - ARCHIVE? (PROMOTIONAL)', emails: matrix.LowLow, count: true }
    ]);

    console.log("\n" + SECTION_DIVIDER);
    console.log("ACTIONABLE SUMMARY");
    console.log(SECTION_DIVIDER + "\n");

    const stats = {
      critical: matrix.HighHigh.length,
      important: matrix.HighMedium.length + matrix.MediumHigh.length,
      routine: matrix.HighLow.length + matrix.MediumMedium.length,
      backlog: matrix.MediumLow.length + matrix.LowHigh.length + matrix.LowMedium.length,
      archive: matrix.LowLow.length
    };

    console.log(`🔴 CRITICAL (Act Now):           ${stats.critical} emails`);
    console.log(`🟠 IMPORTANT (Today):            ${stats.important} emails`);
    console.log(`🟡 ROUTINE (This week):          ${stats.routine} emails`);
    console.log(`🟢 BACKLOG (Eventually):         ${stats.backlog} emails`);
    console.log(`⚫ ARCHIVE CANDIDATES:           ${stats.archive} emails`);
    console.log(`\n📊 Total Unread:                 ${validMessages.length} emails\n`);

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function scoreContent(content, highKeywords, lowKeywords) {
  if (highKeywords.some(k => content.includes(k))) return HIGH_SCORE;
  if (lowKeywords.some(k => content.includes(k))) return LOW_SCORE;
  return DEFAULT_SCORE;
}

function categorizeEmail(msg) {
  const subject = msg.subject.toLowerCase();
  const from = msg.from.toLowerCase();
  const snippet = msg.snippet.toLowerCase();

  const urgencyScore = scoreContent(`${subject} ${from} ${snippet}`, HIGH_URGENCY_KEYWORDS, LOW_URGENCY_KEYWORDS);
  const importanceScore = scoreContent(`${subject} ${from} ${snippet}`, HIGH_IMPORTANCE_KEYWORDS, LOW_IMPORTANCE_KEYWORDS);

  const urgency = urgencyScore >= HIGH_THRESHOLD ? 'High' : (urgencyScore <= LOW_THRESHOLD ? 'Low' : 'Medium');
  const importance = importanceScore >= HIGH_THRESHOLD ? 'High' : (importanceScore <= LOW_THRESHOLD ? 'Low' : 'Medium');

  return { urgency, importance };
}

function printSection(title, subsections) {
  const hasContent = subsections.some(s => s.emails.length > 0);
  if (!hasContent) return;

  console.log(`\n${title}`);
  console.log(SECTION_DIVIDER + "\n");

  subsections.forEach(({ label, emails, limit, count }) => {
    if (emails.length === 0) return;

    console.log(`  ${label}`);
    console.log('  ' + ROW_DIVIDER);

    if (count) {
      console.log(`  ${emails.length} promotional/newsletter emails\n`);
      return;
    }

    emails.slice(0, limit || Infinity).forEach((email, idx) => {
      console.log(`  ${idx + 1}. 👤 ${email.from.substring(0, FROM_MAX)}`);
      console.log(`     📌 ${email.subject.substring(0, SUBJECT_MAX)}`);
      console.log(`     📝 ${email.snippet.substring(0, SNIPPET_MAX)}...`);
      console.log();
    });

    if (limit && emails.length > limit) {
      console.log(`  ... and ${emails.length - limit} more\n`);
    }
  });
}

analyzeUnreadEmails().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});