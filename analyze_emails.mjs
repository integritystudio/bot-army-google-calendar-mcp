import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

async function analyzeUnreadEmails() {
  try {
    const credPath = path.join(process.cwd(), 'credentials.json');
    const credFile = JSON.parse(await fs.readFile(credPath, 'utf-8'));
    const cred = credFile.installed || credFile;

    const tokenPath = path.join(homedir(), '.config/google-calendar-mcp/tokens-gmail.json');
    const content = await fs.readFile(tokenPath, 'utf-8');
    const multiAccountTokens = JSON.parse(content);
    const tokens = multiAccountTokens['normal'];

    const oauth2Client = new OAuth2Client(
      cred.client_id,
      cred.client_secret,
      cred.redirect_uris[0]
    );

    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Fetch unread messages
    const response = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults: 100
    });

    const messageIds = response.data.messages || [];
    console.log(`\n📧 FOUND ${messageIds.length} UNREAD MESSAGES\n`);

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

    // Categorize with scoring
    const categorized = {};
    
    validMessages.forEach(msg => {
      const { urgencyScore, importanceScore, urgency, importance } = categorizeEmail(msg);
      
      const category = `${urgency}${importance}`;
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push({ ...msg, urgencyScore, importanceScore });
    });

    // Output organized by urgency/importance matrix
    console.log("╔════════════════════════════════════════════════════════════════════════════════╗");
    console.log("║            UNREAD EMAIL MATRIX: URGENCY (rows) × IMPORTANCE (cols)            ║");
    console.log("╚════════════════════════════════════════════════════════════════════════════════╝\n");

    // Create matrix
    const matrix = {
      'HighHigh': categorized['HighHigh'] || [],
      'HighMedium': categorized['HighMedium'] || [],
      'HighLow': categorized['HighLow'] || [],
      'MediumHigh': categorized['MediumHigh'] || [],
      'MediumMedium': categorized['MediumMedium'] || [],
      'MediumLow': categorized['MediumLow'] || [],
      'LowHigh': categorized['LowHigh'] || [],
      'LowMedium': categorized['LowMedium'] || [],
      'LowLow': categorized['LowLow'] || []
    };

    // Section 1: HIGH URGENCY
    if (matrix.HighHigh.length > 0 || matrix.HighMedium.length > 0 || matrix.HighLow.length > 0) {
      console.log("🔴 HIGH URGENCY EMAILS (ACT IMMEDIATELY!)");
      console.log("═".repeat(80) + "\n");

      if (matrix.HighHigh.length > 0) {
        console.log("  ⚠️  HIGH IMPORTANCE - CRITICAL (DO THIS NOW!)");
        console.log("  " + "─".repeat(76));
        matrix.HighHigh.forEach((email, idx) => {
          console.log(`  ${idx + 1}. 👤 ${email.from.substring(0, 45)}`);
          console.log(`     📌 ${email.subject.substring(0, 60)}`);
          console.log(`     📝 ${email.snippet.substring(0, 65)}...`);
          console.log();
        });
      }

      if (matrix.HighMedium.length > 0) {
        console.log("  ⚡ MEDIUM IMPORTANCE - IMPORTANT (HANDLE SOON)");
        console.log("  " + "─".repeat(76));
        matrix.HighMedium.forEach((email, idx) => {
          console.log(`  ${idx + 1}. 👤 ${email.from.substring(0, 45)}`);
          console.log(`     📌 ${email.subject.substring(0, 60)}`);
          console.log(`     📝 ${email.snippet.substring(0, 65)}...`);
          console.log();
        });
      }

      if (matrix.HighLow.length > 0) {
        console.log("  💨 LOW IMPORTANCE - QUICK ATTENTION (BRIEF)");
        console.log("  " + "─".repeat(76));
        matrix.HighLow.forEach((email, idx) => {
          console.log(`  ${idx + 1}. 👤 ${email.from.substring(0, 45)}`);
          console.log(`     📌 ${email.subject.substring(0, 60)}`);
          console.log(`     📝 ${email.snippet.substring(0, 65)}...`);
          console.log();
        });
      }
    }

    // Section 2: MEDIUM URGENCY
    if (matrix.MediumHigh.length > 0 || matrix.MediumMedium.length > 0 || matrix.MediumLow.length > 0) {
      console.log("\n🟠 MEDIUM URGENCY EMAILS (ADDRESS TODAY)");
      console.log("═".repeat(80) + "\n");

      if (matrix.MediumHigh.length > 0) {
        console.log("  💼 HIGH IMPORTANCE - IMPORTANT (PRIORITIZE)");
        console.log("  " + "─".repeat(76));
        matrix.MediumHigh.forEach((email, idx) => {
          console.log(`  ${idx + 1}. 👤 ${email.from.substring(0, 45)}`);
          console.log(`     📌 ${email.subject.substring(0, 60)}`);
          console.log(`     📝 ${email.snippet.substring(0, 65)}...`);
          console.log();
        });
      }

      if (matrix.MediumMedium.length > 0) {
        console.log("  📧 MEDIUM IMPORTANCE - STANDARD (ROUTINE)");
        console.log("  " + "─".repeat(76));
        matrix.MediumMedium.forEach((email, idx) => {
          console.log(`  ${idx + 1}. 👤 ${email.from.substring(0, 45)}`);
          console.log(`     📌 ${email.subject.substring(0, 60)}`);
          console.log(`     📝 ${email.snippet.substring(0, 65)}...`);
          console.log();
        });
      }

      if (matrix.MediumLow.length > 0) {
        console.log("  ⏳ LOW IMPORTANCE - NOT URGENT (BACKLOG)");
        console.log("  " + "─".repeat(76));
        matrix.MediumLow.forEach((email, idx) => {
          console.log(`  ${idx + 1}. 👤 ${email.from.substring(0, 45)}`);
          console.log(`     📌 ${email.subject.substring(0, 60)}`);
          console.log(`     📝 ${email.snippet.substring(0, 65)}...`);
          console.log();
        });
      }
    }

    // Section 3: LOW URGENCY
    if (matrix.LowHigh.length > 0 || matrix.LowMedium.length > 0 || matrix.LowLow.length > 0) {
      console.log("\n🟡 LOW URGENCY EMAILS (READ WHEN YOU HAVE TIME)");
      console.log("═".repeat(80) + "\n");

      if (matrix.LowHigh.length > 0) {
        console.log("  📚 HIGH IMPORTANCE - READ LATER (VALUABLE)");
        console.log("  " + "─".repeat(76));
        matrix.LowHigh.forEach((email, idx) => {
          console.log(`  ${idx + 1}. 👤 ${email.from.substring(0, 45)}`);
          console.log(`     📌 ${email.subject.substring(0, 60)}`);
          console.log(`     📝 ${email.snippet.substring(0, 65)}...`);
          console.log();
        });
      }

      if (matrix.LowMedium.length > 0) {
        console.log("  📰 MEDIUM IMPORTANCE - FYI (INFORMATIONAL)");
        console.log("  " + "─".repeat(76));
        matrix.LowMedium.slice(0, 5).forEach((email, idx) => {
          console.log(`  ${idx + 1}. 👤 ${email.from.substring(0, 45)}`);
          console.log(`     📌 ${email.subject.substring(0, 60)}`);
          console.log(`     📝 ${email.snippet.substring(0, 65)}...`);
          console.log();
        });
        if (matrix.LowMedium.length > 5) {
          console.log(`  ... and ${matrix.LowMedium.length - 5} more\n`);
        }
      }

      if (matrix.LowLow.length > 0) {
        console.log("  🗑️  LOW IMPORTANCE - ARCHIVE? (PROMOTIONAL)");
        console.log("  " + "─".repeat(76));
        console.log(`  ${matrix.LowLow.length} promotional/newsletter emails\n`);
      }
    }

    // Summary Statistics
    console.log("\n" + "═".repeat(80));
    console.log("ACTIONABLE SUMMARY");
    console.log("═".repeat(80) + "\n");

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

function categorizeEmail(msg) {
  const subject = msg.subject.toLowerCase();
  const from = msg.from.toLowerCase();
  const snippet = msg.snippet.toLowerCase();
  const content = `${subject} ${from} ${snippet}`;

  // Urgency scoring
  let urgencyScore = 5; // default medium
  if (content.includes('urgent') || content.includes('asap') || content.includes('immediate') || 
      content.includes('critical') || content.includes('emergency') || content.includes('alert')) {
    urgencyScore = 9; // high
  } else if (content.includes('fyi') || content.includes('newsletter') || content.includes('digest') ||
             content.includes('weekly') || content.includes('monthly') || content.includes('notification')) {
    urgencyScore = 2; // low
  }

  // Importance scoring  
  let importanceScore = 5; // default medium
  if (content.includes('manager') || content.includes('boss') || content.includes('ceo') ||
      content.includes('invoice') || content.includes('payment') || content.includes('contract') ||
      content.includes('approved') || content.includes('rejected') || content.includes('decision')) {
    importanceScore = 9; // high
  } else if (content.includes('marketing') || content.includes('promotion') || content.includes('sale') ||
             content.includes('discount') || content.includes('follow') || content.includes('subscribe')) {
    importanceScore = 2; // low
  }

  const urgency = urgencyScore >= 7 ? 'High' : (urgencyScore <= 3 ? 'Low' : 'Medium');
  const importance = importanceScore >= 7 ? 'High' : (importanceScore <= 3 ? 'Low' : 'Medium');

  return { urgencyScore, importanceScore, urgency, importance };
}

analyzeUnreadEmails();
