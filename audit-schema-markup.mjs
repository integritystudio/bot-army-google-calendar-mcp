/**
 * Audit how much unread mail carries schema.org JSON-LD, and what types it declares.
 *
 * Was a --schema flag on list-unread-emails.mjs, sharing nothing with that script's
 * other modes: different library, different data shape (full bodies, not headers), and
 * a different question. It answers "how machine-readable is my incoming mail", which is
 * what config/org-tags.mjs' schema blocks are modeled against.
 *
 * Usage: node audit-schema-markup.mjs
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { parseCli, runIfMain } from './lib/cli-utils.mjs';
import { BANNER } from './lib/console-utils.mjs';
import { extractDisplayName, extractEmailAddress } from './lib/email-utils.mjs';
import { listAllMessageIds, fetchFullMessages } from './lib/gmail-message-utils.mjs';
import {
  extractSchemaMarkupFromGmailPayload,
  categorizeBySchema,
  extractHtmlFromPayload,
} from './lib/schema-extractor.mjs';

const USAGE = 'Usage: node audit-schema-markup.mjs';
const SUBJECT_MAX_LENGTH = 60;

const SCHEMA_SAMPLE_SIZE = 50;

async function auditSchemaMarkup(gmail) {
  console.log('SCHEMA.ORG JSON-LD AUDIT\n');
  console.log(BANNER + '\n');

  const messageIds = await listAllMessageIds(gmail, 'is:unread', { limit: SCHEMA_SAMPLE_SIZE });
  console.log(`Scanning ${messageIds.length} unread emails for schema.org markup...\n`);

  if (messageIds.length === 0) return;

  // fetchFullMessages retries and warns about what it could not fetch. The hand-rolled
  // mapWithConcurrency call this replaces had no retry, and a single failed fetch
  // rejected the whole batch — one 429 aborted the audit rather than shrinking the sample.
  const fullMsgs = await fetchFullMessages(gmail, messageIds);

  const typeCounts = {};
  const categoryCounts = {};
  const samples = [];

  for (const { subject, from, payload } of fullMsgs) {
    const html = extractHtmlFromPayload(payload);
    const schemaObjects = extractSchemaMarkupFromGmailPayload(html);
    if (schemaObjects.length === 0) continue;

    const { category, types, metadata } = categorizeBySchema(schemaObjects);

    for (const type of types) {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    if (category) {
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }

    samples.push({ subject, from: extractDisplayName(from) || extractEmailAddress(from), types, category, metadata });
  }

  const withSchema = samples.length;
  // Denominator is what was actually fetched, not what was requested — a message
  // fetchFullMessages dropped after retrying is not evidence it lacks schema markup.
  const withoutSchema = fullMsgs.length - withSchema;

  console.log(`Emails with schema.org markup: ${withSchema}/${fullMsgs.length} (${Math.round(withSchema / fullMsgs.length * 100)}%)`);
  console.log(`Emails without: ${withoutSchema}\n`);

  if (Object.keys(typeCounts).length > 0) {
    console.log('Type Distribution:');
    for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type}: ${count}`);
    }
  }

  if (Object.keys(categoryCounts).length > 0) {
    console.log('\nCategory Mapping:');
    for (const [cat, count] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cat}: ${count}`);
    }
  }

  if (samples.length > 0) {
    console.log('\nSample Matches:\n');
    for (const sample of samples.slice(0, 10)) {
      console.log(`  • ${sample.subject.substring(0, SUBJECT_MAX_LENGTH)}`);
      console.log(`    From: ${sample.from}`);
      console.log(`    Types: ${sample.types.join(', ')} → ${sample.category || 'unmapped'}`);
      if (Object.keys(sample.metadata).length > 0) {
        console.log(`    Metadata: ${JSON.stringify(sample.metadata)}`);
      }
    }
  }

  console.log('\n' + BANNER + '\n');
}
async function run() {
  parseCli({}, USAGE);
  return auditSchemaMarkup(await createGmailClient());
}

runIfMain(import.meta.url, run);
