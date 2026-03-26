import { createGmailClient } from './lib/gmail-client.mjs';
import { LABEL_NEWSLETTERS_CCV } from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { fetchLabeledMessageMetadata } from './lib/gmail-message-utils.mjs';

async function analyzeCCVNewsletter() {
  const gmail = createGmailClient();

  console.log('📊 ANALYZING CCV NEWSLETTER EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  const labelCache = await buildLabelCache(gmail);
  const labelId = labelCache.get(LABEL_NEWSLETTERS_CCV);
  if (!labelId) {
    console.log('Newsletters/CCV label not found');
    return;
  }
  const { total, messages } = await fetchLabeledMessageMetadata(gmail, labelId);
  if (total === 0) {
    console.log('No CCV newsletter emails found');
    return;
  }

  console.log(`📧 Found ${total} CCV Newsletter emails\n`);
  console.log('═'.repeat(80) + '\n');

  console.log('📋 CCV NEWSLETTER EMAILS\n');

  messages.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB - dateA;
  });

  const emailsByMonth = {};

  for (const msg of messages) {
    const dateObj = new Date(msg.date);
    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

    if (!emailsByMonth[monthKey]) {
      emailsByMonth[monthKey] = [];
    }
    emailsByMonth[monthKey].push(msg);
  }

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
}

analyzeCCVNewsletter().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
