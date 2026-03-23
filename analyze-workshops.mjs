import { createGmailClient } from './lib/gmail-client.mjs';

async function analyzeWorkshops() {
  const gmail = createGmailClient();

  console.log('📊 ANALYZING WORKSHOP EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const labelId = 'Label_5'; // Events/Workshops
    const messagesResult = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [labelId],
      maxResults: 100,
    });

    if (!messagesResult.data.messages) {
      console.log('No workshop emails found');
      return;
    }

    console.log(`📧 Found ${messagesResult.data.messages.length} Workshop Emails\n`);
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

        messages.push({ subject, from });
      } catch (error) {
        // Skip if can't fetch
      }
    }

    // Categorize by workshop type
    const workshopTypes = {
      'Technical/AI/ML': [],
      'Healthcare/Medical': [],
      'Business/Leadership': [],
      'Creative/Arts': [],
      'Professional Development': [],
      'Community Learning': [],
      'Other': [],
    };

    const typePatterns = {
      'Technical/AI/ML': /computer vision|machine learning|ai|coding|developer|python|code|algorithm|neural|llm/i,
      'Healthcare/Medical': /healthcare|medical|health|nurse|hospital|clinic|therapy|mental|wellness|care/i,
      'Business/Leadership': /leadership|business|sales|marketing|entrepreneur|management|strategy/i,
      'Creative/Arts': /art|design|creative|writing|music|performance|sketch|drawing/i,
      'Professional Development': /workshop|training|course|certification|skill|development|learning/i,
      'Community Learning': /community|meetup|group|local|class|lesson/i,
    };

    for (const msg of messages) {
      let categorized = false;
      for (const [type, pattern] of Object.entries(typePatterns)) {
        if (pattern.test(msg.subject)) {
          workshopTypes[type].push(msg.subject);
          categorized = true;
          break;
        }
      }
      if (!categorized) {
        workshopTypes['Other'].push(msg.subject);
      }
    }

    // Display results
    console.log('📋 WORKSHOP CATEGORIES\n');

    const sortedTypes = Object.entries(workshopTypes)
      .filter(([_, emails]) => emails.length > 0)
      .sort((a, b) => b[1].length - a[1].length);

    for (const [type, emails] of sortedTypes) {
      const percentage = ((emails.length / messages.length) * 100).toFixed(0);
      console.log(`${type.toUpperCase()}`);
      console.log(`Count: ${emails.length} (${percentage}%)\n`);

      const samples = [...new Set(emails)].slice(0, 3);
      for (const subject of samples) {
        const truncated = subject.length > 70
          ? subject.substring(0, 70) + '...'
          : subject;
        console.log(`  • ${truncated}`);
      }

      if (samples.length < emails.length) {
        console.log(`  ... and ${emails.length - samples.length} more`);
      }
      console.log();
    }

    console.log('═'.repeat(80) + '\n');
    console.log('💡 RECOMMENDED SUB-LABELS:\n');

    for (const [type, emails] of sortedTypes) {
      if (emails.length > 0) {
        console.log(`  • Events/Workshops/${type}`);
      }
    }
    console.log();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeWorkshops();
