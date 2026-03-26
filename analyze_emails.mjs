import { createGmailClient } from './lib/gmail-client.mjs';
import { extractDisplayName, getHeader } from './lib/email-utils.mjs';
import { USER_ID } from './lib/constants.mjs';
import { categorizeEmail, printSection, ANALYZER_CONFIG } from './lib/email-analyzer.mjs';

const FROM_MAX = 45;
const SUBJECT_MAX = 60;
const SNIPPET_MAX = 65;
const MAX_RESULTS = 100;

const { SECTION_DIVIDER } = ANALYZER_CONFIG;

async function analyzeUnreadEmails() {
  try {
    const gmail = createGmailClient();

    const response = await gmail.users.messages.list({
      userId: USER_ID,
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
            userId: USER_ID,
            id: msg.id,
            format: "metadata",
            metadataHeaders: headers
          });

          const headerList = fullMsg.data.payload?.headers || [];

          return {
            id: msg.id,
            subject: getHeader(headerList, 'Subject') || "(No subject)",
            from: extractDisplayName(getHeader(headerList, 'From')) || "(Unknown sender)",
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

    const displayConfig = { fromMax: FROM_MAX, subjectMax: SUBJECT_MAX, snippetMax: SNIPPET_MAX };

    printSection('🔴 HIGH URGENCY EMAILS (ACT IMMEDIATELY!)', [
      { label: '⚠️  HIGH IMPORTANCE - CRITICAL (DO THIS NOW!)', emails: matrix.HighHigh },
      { label: '⚡ MEDIUM IMPORTANCE - IMPORTANT (HANDLE SOON)', emails: matrix.HighMedium },
      { label: '💨 LOW IMPORTANCE - QUICK ATTENTION (BRIEF)', emails: matrix.HighLow }
    ], displayConfig);

    printSection('🟠 MEDIUM URGENCY EMAILS (ADDRESS TODAY)', [
      { label: '💼 HIGH IMPORTANCE - IMPORTANT (PRIORITIZE)', emails: matrix.MediumHigh },
      { label: '📧 MEDIUM IMPORTANCE - STANDARD (ROUTINE)', emails: matrix.MediumMedium },
      { label: '⏳ LOW IMPORTANCE - NOT URGENT (BACKLOG)', emails: matrix.MediumLow }
    ], displayConfig);

    printSection('🟡 LOW URGENCY EMAILS (READ WHEN YOU HAVE TIME)', [
      { label: '📚 HIGH IMPORTANCE - READ LATER (VALUABLE)', emails: matrix.LowHigh },
      { label: '📰 MEDIUM IMPORTANCE - FYI (INFORMATIONAL)', emails: matrix.LowMedium, limit: 5 },
      { label: '🗑️  LOW IMPORTANCE - ARCHIVE? (PROMOTIONAL)', emails: matrix.LowLow, count: true }
    ], displayConfig);

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

analyzeUnreadEmails().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});