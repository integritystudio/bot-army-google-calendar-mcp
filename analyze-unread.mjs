import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function analyzeUnread() {
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

  console.log('🔍 ANALYZING UNREAD EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get all labels
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const labels = labelsResponse.data.labels || [];
    const labelMap = {};
    labels.forEach(l => { labelMap[l.id] = l.name; });

    // Get all unread
    const allUnreadResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 500
    });

    const allUnread = allUnreadResponse.data.messages || [];
    console.log(`Total unread: ${allUnread.length}\n`);

    // Categorize by labels
    const categories = {};

    for (const msg of allUnread) {
      const fullMsg = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id
      });

      const labels = (fullMsg.data.labelIds || []).map(id => labelMap[id]).filter(Boolean);
      const labelStr = labels.length > 0 ? labels.join(', ') : 'No labels';

      if (!categories[labelStr]) {
        categories[labelStr] = [];
      }
      categories[labelStr].push(msg.id);
    }

    // Show breakdown
    Object.entries(categories)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([labels, ids]) => {
        console.log(`${labels}: ${ids.length}`);
      });

    console.log('\n' + '═'.repeat(80));
    console.log(`\nBreakdown shows which labels most unread emails have.`);
    console.log(`Items with "No labels" are the best candidates for new filters.\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

analyzeUnread().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
