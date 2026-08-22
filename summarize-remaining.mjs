/**
 * Summarize the unread mail left in a handful of named buckets — the queries that
 * matter enough to check by hand rather than route with a filter.
 *
 * A report-messages.mjs preset: the query list is the whole of this file, because the
 * fetch-and-print shape lives there.
 *
 * Usage: node summarize-remaining.mjs
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { report } from './report-messages.mjs';
import { BANNER } from './lib/console-utils.mjs';

const INTERNAL_PREVIEW_COUNT = 2;
const FORUM_PREVIEW_COUNT = 1;
const MAX_PER_QUERY = 20;

const INTERNAL_QUERIES = [
  { name: 'John Skelton (files)', query: 'from:john@integritystudio.ai is:unread' },
  { name: 'Fellowship applications', query: 'subject:fellowship (subject:application OR subject:applications OR subject:deadline) newer_than:60d is:unread' },
  { name: 'Project discussions (misc)', query: 'from:chandra@integritystudio.ai OR from:alex@integritystudio.ai is:unread' },
];

const FORUM_QUERIES = [
  { name: 'Misc/sales', query: 'from:marcella@inmyteam.com is:unread' },
];

async function run() {
  const gmail = await createGmailClient();

  console.log('REMAINING UNREAD SUMMARY\n');
  console.log(BANNER + '\n');

  console.log('INTERNAL: Work file shares, project discussions\n');
  await report(gmail, INTERNAL_QUERIES, {
    columns: ['subject', 'from'],
    format: 'list',
    max: MAX_PER_QUERY,
    preview: INTERNAL_PREVIEW_COUNT,
    skipEmpty: true,
  });

  console.log('\nFORUMS: Technical summaries\n');
  await report(gmail, FORUM_QUERIES, {
    columns: ['subject', 'from'],
    format: 'list',
    max: MAX_PER_QUERY,
    preview: FORUM_PREVIEW_COUNT,
    skipEmpty: true,
  });

  console.log(BANNER + '\n');
}

run().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
