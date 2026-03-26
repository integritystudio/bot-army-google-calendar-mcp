import { createGmailClient } from './lib/gmail-client.mjs';
import { GMAIL_UNREAD, LABEL_COMMUNITIES } from './lib/constants.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

const gmail = createGmailClient();
const labelCache = await buildLabelCache(gmail);
const communitiesLabelId = labelCache.get(LABEL_COMMUNITIES);
if (!communitiesLabelId) {
  console.error('Communities label not found');
  process.exit(1);
}

const count = await searchAndModify(
  gmail,
  'from:"no-reply@discuss.google.dev" OR from:"no-reply@discuss.google.com"',
  { addLabelIds: [communitiesLabelId], removeLabelIds: [GMAIL_UNREAD] }
);
console.log(`Labeled ${count} Google Developer forum emails as Communities`);
