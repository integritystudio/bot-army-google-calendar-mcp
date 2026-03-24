import { createGmailClient } from './lib/gmail-client.mjs';

async function analyzeSubjectNewsletters() {
  const gmail = createGmailClient();

  console.log('📊 ANALYZING SUBJECT-BASED NEWSLETTER EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get all messages with the Subject-Based newsletter label
    const labelId = 'Label_7';
    const messagesResult = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [labelId],
      maxResults: 100,
    });

    if (!messagesResult.data.messages) {
      console.log('No Subject-Based newsletter emails found');
      return;
    }

    console.log(`📧 Found ${messagesResult.data.messages.length} Subject-Based newsletter emails\n`);
    console.log('═'.repeat(80) + '\n');

    // Fetch full message details to get subjects
    const messages = [];
    for (const msgHeader of messagesResult.data.messages.slice(0, 50)) {
      try {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: msgHeader.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From'],
        });

        const headers = msg.data.payload.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
        const from = headers.find(h => h.name === 'From')?.value || '(unknown)';

        messages.push({ subject, from });
      } catch (error) {
        console.log(`Error fetching message: ${error.message}`);
      }
    }

    // Categorize by subject patterns
    const categories = {
      'Weekly Reports/Digests': [],
      'Monthly Reports/Digests': [],
      'News/Updates': [],
      'Industry/Tech News': [],
      'Business/Career': [],
      'Marketing/Product': [],
      'Community/Social': [],
      'Wellness/Health': [],
      'Travel/Events': [],
      'Finance/Investment': [],
      'Other': [],
    };

    const categoryPatterns = {
      'Weekly Reports/Digests': /week|weekly|w\.?o\.?w/i,
      'Monthly Reports/Digests': /month|monthly/i,
      'News/Updates': /news|update|alert|notification/i,
      'Industry/Tech News': /tech|ai|machine learning|code|developer|engineering|api|startup/i,
      'Business/Career': /job|career|hiring|resume|skill|professional|leadership|strategy/i,
      'Marketing/Product': /product|marketing|sales|feature|launch|campaign|growth|user/i,
      'Community/Social': /community|group|meetup|event|forum|discord|slack/i,
      'Wellness/Health': /health|wellness|fitness|mental|yoga|meditation|nutrition|exercise/i,
      'Travel/Events': /travel|trip|destination|hotel|flight|vacation|conference|summit/i,
      'Finance/Investment': /finance|investment|stock|crypto|fund|money|earn|roi|revenue/i,
    };

    for (const msg of messages) {
      let categorized = false;
      for (const [category, pattern] of Object.entries(categoryPatterns)) {
        if (pattern.test(msg.subject)) {
          categories[category].push(msg.subject);
          categorized = true;
          break;
        }
      }
      if (!categorized) {
        categories['Other'].push(msg.subject);
      }
    }

    // Display results
    console.log('📋 SUBJECT CATEGORIES\n');

    const sortedCategories = Object.entries(categories)
      .filter(([_, emails]) => emails.length > 0)
      .sort((a, b) => b[1].length - a[1].length);

    for (const [category, subjects] of sortedCategories) {
      console.log(`${category.toUpperCase()}`);
      console.log(`Count: ${subjects.length}\n`);

      // Show unique subject patterns
      const uniqueSubjects = [...new Set(subjects)].slice(0, 5);
      for (const subject of uniqueSubjects) {
        const truncated = subject.length > 75
          ? subject.substring(0, 75) + '...'
          : subject;
        console.log(`  • ${truncated}`);
      }

      if (uniqueSubjects.length < subjects.length) {
        console.log(`  ... and ${subjects.length - uniqueSubjects.length} more`);
      }
      console.log();
    }

    // Summary
    console.log('═'.repeat(80) + '\n');
    console.log('📊 SUMMARY\n');
    const totalCategorized = messages.length;
    for (const [category, subjects] of sortedCategories) {
      const percentage = ((subjects.length / totalCategorized) * 100).toFixed(1);
      console.log(`${category}: ${subjects.length} (${percentage}%)`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeSubjectNewsletters().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});