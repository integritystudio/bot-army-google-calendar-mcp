import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function createPerformanceTrackingLabel() {
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

  console.log('📊 CREATING PERFORMANCE TRACKING LABEL\n');
  console.log('═'.repeat(80) + '\n');

  // Step 1: Create Performance Tracking label
  console.log('1️⃣  CREATING LABEL: Performance Tracking\n');

  let perfLabelId;

  try {
    const response = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: 'Performance Tracking',
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });

    console.log('✅ Label created successfully!');
    console.log(`   Name: ${response.data.name}`);
    console.log(`   ID: ${response.data.id}\n`);
    perfLabelId = response.data.id;

  } catch (error) {
    if (error.message.includes('exists') || error.message.includes('conflicts')) {
      console.log('⚠️  Label already exists: Performance Tracking\n');
      const labels = await gmail.users.labels.list({ userId: 'me' });
      const existing = labels.data.labels.find(l => l.name === 'Performance Tracking');
      if (existing) {
        console.log(`   ID: ${existing.id}\n`);
        perfLabelId = existing.id;
      }
    } else {
      console.error('❌ Error creating label:', error.message);
      process.exit(1);
    }
  }

  // Step 2: Find and relabel Sentry emails
  console.log('═'.repeat(80));
  console.log('\n2️⃣  MOVING SENTRY UPDATES FROM NEWSLETTER TO PERFORMANCE TRACKING\n');

  const sentryPatterns = [
    'from:noreply@md.getsentry.com',
    'subject:Sentry OR subject:"TCAD-SCRAPER-BACKEND"',
  ];

  const newsletterLabelId = 'Label_7'; // Newsletters/Subject-Based
  let totalRelabeled = 0;

  for (const query of sentryPatterns) {
    try {
      const searchResult = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100,
      });

      if (!searchResult.data.messages) continue;

      const messageIds = searchResult.data.messages.map(m => m.id);
      const count = messageIds.length;

      if (count > 0) {
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: messageIds,
            addLabelIds: [perfLabelId],
            removeLabelIds: [newsletterLabelId],
          },
        });

        console.log(`  ✅ Relabeled ${count} emails matching: "${query.substring(0, 50)}..."`);
        console.log(`     Added: Performance Tracking`);
        console.log(`     Removed: Newsletters/Subject-Based\n`);
        totalRelabeled += count;
      }
    } catch (error) {
      console.log(`  ⚠️  Error with "${query}": ${error.message}`);
    }
  }

  console.log(`  📊 Total relabeled: ${totalRelabeled} emails\n`);

  // Step 3: Create filter for future Sentry emails
  console.log('═'.repeat(80));
  console.log('\n3️⃣  CREATING AUTO-LABEL FILTER FOR SENTRY\n');

  const filters = [
    {
      name: 'Sentry Error Tracking',
      criteria: { from: 'noreply@md.getsentry.com' },
    },
    {
      name: 'Sentry Alerts & Reports',
      criteria: { subject: 'Sentry OR "TCAD-SCRAPER-BACKEND"' },
    },
  ];

  let filtersCreated = 0;

  for (const filter of filters) {
    try {
      const response = await gmail.users.settings.filters.create({
        userId: 'me',
        requestBody: {
          criteria: filter.criteria,
          action: {
            addLabelIds: [perfLabelId],
          },
        },
      });

      console.log(`  ✅ Filter created: ${filter.name}`);
      console.log(`     ID: ${response.data.id}\n`);
      filtersCreated++;
    } catch (error) {
      if (error.message.includes('exists')) {
        console.log(`  ℹ️  Filter already exists: ${filter.name}`);
      } else {
        console.log(`  ⚠️  Error creating filter "${filter.name}": ${error.message}`);
      }
    }
  }

  console.log('═'.repeat(80));
  console.log('\n✨ PERFORMANCE TRACKING LABEL COMPLETE\n');
  console.log(`  📌 Sentry emails relabeled: ${totalRelabeled}`);
  console.log(`  🔄 Filters created: ${filtersCreated}`);
  console.log(`  📂 Label: Performance Tracking (${perfLabelId})`);
  console.log('\n💡 Sentry updates are now tracked under Performance Tracking, not Newsletters!\n');
  console.log('📂 New Top-Level Label:');
  console.log('   Performance Tracking');
  console.log('   ├── Sentry Error Reports');
  console.log('   ├── Weekly Reports');
  console.log('   └── (other performance data)\n');
}

createPerformanceTrackingLabel().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
