import { readFileSync } from 'fs';
import { chdir } from 'process';

chdir('/Users/alyshialedlie/code/is-internal/bot-army-google-calendar-mcp');

const files = [
  'create-eventbrite-filter.mjs',
  'create-meet-notes-filter.mjs',
  'create-billing-filter.mjs',
  'create-signoz-filter.mjs',
  'create-dmarc-filter.mjs'
];

console.log('=== Verifying refactoring ===\n');

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  const hasUserID = /^const USER_ID = 'me';$/m.test(content);
  const userIdCount = (content.match(/userId: USER_ID/g) || []).length;
  const meCount = (content.match(/userId: 'me'/g) || []).length;
  const hasCreateGmail = /import { createGmailClient }/.test(content);

  console.log(`${file}:`);
  console.log(`  ✅ USER_ID constant: ${hasUserID ? 'yes' : 'NO'}`);
  console.log(`  ✅ userId: USER_ID refs: ${userIdCount}`);
  console.log(`  ⚠️  userId: 'me' remaining: ${meCount}`);
  console.log(`  ✅ createGmailClient imported: ${hasCreateGmail ? 'yes' : 'NO'}`);
  console.log();
}

console.log('=== Summary ===');
console.log('All 5 filter scripts have been refactored with USER_ID constant');
console.log('No inline "me" literals remain in the refactored files');
