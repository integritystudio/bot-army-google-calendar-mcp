import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function analyzeCCVNewsletter() {
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

  console.log('📊 ANALYZING CCV NEWSLETTER EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get all CCV newsletter emails
    const labelId = 'Label_11';
    const messagesResult = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [labelId],
      maxResults: 100,
    });

    if (!messagesResult.data.messages) {
      console.log('No CCV newsletter emails found');
      return;
    }

    console.log(`📧 Found ${messagesResult.data.messages.length} CCV Newsletter emails\n`);
    console.log('═'.repeat(80) + '\n');

    // Fetch full message details
    const messages = [];
    for (const msgHeader of messagesResult.data.messages) {
      try {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: msgHeader.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'],
        });

        const headers = msg.data.payload.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
        const from = headers.find(h => h.name === 'From')?.value || '(unknown)';
        const date = headers.find(h => h.name === 'Date')?.value || '(no date)';

        messages.push({ subject, from, date });
      } catch (error) {
        console.log(`Error fetching message: ${error.message}`);
      }
    }

    // Display all emails sorted by date
    console.log('📋 CCV NEWSLETTER EMAILS\n');

    // Sort by date (most recent first)
    messages.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA;
    });

    // Group by month/year
    const emailsByMonth = {};

    for (const msg of messages) {
      const dateObj = new Date(msg.date);
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

      if (!emailsByMonth[monthKey]) {
        emailsByMonth[monthKey] = [];
      }
      emailsByMonth[monthKey].push(msg);
    }

    // Display organized by month
    for (const [monthKey, emails] of Object.entries(emailsByMonth)) {
      const [year, month] = monthKey.split('-');
      const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

      console.log(`${monthName.toUpperCase()}`);
      console.log(`Count: ${emails.length}\n`);

      for (const email of emails) {
        const truncated = email.subject.length > 75
          ? email.subject.substring(0, 75) + '...'
          : email.subject;
        console.log(`  • ${truncated}`);
      }
      console.log();
    }

    // Analyze content patterns
    console.log('═'.repeat(80) + '\n');
    console.log('📋 CONTENT ANALYSIS\n');

    const categories = {
      'Funding/Startup News': 0,
      'Industry Updates': 0,
      'Community News': 0,
      'Career/Jobs': 0,
      'Tech/Innovation': 0,
      'Events': 0,
      'Reports/Analysis': 0,
      'Other': 0,
    };

    const categoryPatterns = {
      'Funding/Startup News': /fund|startup|funding|investment|investor|raise|series|valuation/i,
      'Industry Updates': /industry|market|trend|analysis|report/i,
      'Community News': /community|event|conference|meetup|gather/i,
      'Career/Jobs': /job|career|hiring|recruit|opportunity|position/i,
      'Tech/Innovation': /tech|ai|innovation|software|platform|tool/i,
      'Events': /event|summit|workshop|webinar|conference/i,
      'Reports/Analysis': /report|analysis|insight|data|survey|study/i,
    };

    for (const msg of messages) {
      let categorized = false;
      for (const [category, pattern] of Object.entries(categoryPatterns)) {
        if (pattern.test(msg.subject)) {
          categories[category]++;
          categorized = true;
          break;
        }
      }
      if (!categorized) {
        categories['Other']++;
      }
    }

    console.log('📊 SUBJECT CATEGORY DISTRIBUTION\n');
    const sortedCategories = Object.entries(categories)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    for (const [category, count] of sortedCategories) {
      const percentage = ((count / messages.length) * 100).toFixed(1);
      console.log(`${category}: ${count} (${percentage}%)`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('\n💡 INSIGHTS\n');
    console.log(`Total CCV Newsletters: ${messages.length}`);
    console.log(`Date Range: ${messages[messages.length - 1]?.date} to ${messages[0]?.date}`);
    console.log('\nThe CCV Newsletter appears to be a curated roundup of community news,');
    console.log('covering startup funding, industry trends, and technology updates.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeCCVNewsletter();
