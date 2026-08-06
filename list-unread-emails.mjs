/**
 * Inspect unread emails and label health.
 *
 * Usage:
 *   node list-unread-emails.mjs          # full category breakdown with previews
 *   node list-unread-emails.mjs --count  # just print total unread count
 *   node list-unread-emails.mjs --stats  # per-label total/unread counts + mailbox profile
 *   node list-unread-emails.mjs --verify # spot-check label application on sample emails
 *   node list-unread-emails.mjs --schema # detect schema.org JSON-LD in unread emails (Phase 1 audit)
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { BANNER, DIVIDER } from './lib/console-utils.mjs';
import { extractDisplayName, getHeader } from './lib/email-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { extractSchemaMarkupFromGmailPayload, categorizeBySchema, extractHtmlFromPayload } from './lib/schema-extractor.mjs';
import {
  USER_ID,
  LABEL_SENTRY,
  LABEL_KEEP_IMPORTANT,
  LABEL_EVENTS,
  LABEL_EVENTS_MEETUP,
  LABEL_EVENTS_APA,
  LABEL_EVENTS_LUMA,
  LABEL_EVENTS_PERSONAL,
  LABEL_EVENTS_EVENTBRITE,
  LABEL_EVENTS_IMPORTANT,
  LABEL_MONITORING,
  LABEL_PRODUCT_UPDATES,
  LABEL_PRODUCT_UPDATES_CHATGPT,
  LABEL_COMMUNITIES,
  LABEL_SERVICES,
  LABEL_SERVICES_REAL_ESTATE,
  LABEL_SERVICES_HEALTH,
  LABEL_SERVICES_UTILITIES,
  LABEL_BILLING,
  LABEL_BILLING_CREDIT_MONITORING,
  LABEL_BILLING_MARKET_ALERTS,
  LABEL_BILLING_ACCOUNT_SECURITY,
  LABEL_FORUMS,
  LABEL_FORUMS_LINKEDIN_SOCIAL,
  LABEL_FORUMS_GLASSDOOR,
  LABEL_NEWSLETTERS,
  LABEL_NEWSLETTERS_LINKEDIN,
  LABEL_JOB_SEARCH,
  LABEL_JOB_SEARCH_LINKEDIN,
  LABEL_JOB_SEARCH_GLASSDOOR,
  LABEL_JOB_SEARCH_BACKSTAGE,
  LABEL_JOB_SEARCH_INDEED,
  LABEL_JOB_SEARCH_OTHER,
  LABEL_TRAVEL,
  LABEL_TRAVEL_AIRBNB_RESERVATIONS,
  LABEL_TRAVEL_AIRBNB_SUPPORT,
  LABEL_PROMOTIONS_TRAVEL,
  LABEL_PROMOTIONS_TRAVEL_DISCOUNTS,
  LABEL_ADVOCACY,
  LABEL_ADVOCACY_POLITICAL,
  LABEL_ADVOCACY_NONPROFIT,
  LABEL_TIME_SENSITIVE,
  LABEL_SECURITY_ACCOUNT,
  LABEL_VOICEMAIL,
  LABEL_NETWORKING,
  LABEL_PURCHASES_AMAZON,
  LABEL_PROMOTIONS_RETAIL,
  LABEL_PROMOTIONS_BEAUTY,
  LABEL_PROMOTIONS_FOOD,
  LABEL_PROMOTIONS_FINANCIAL,
  LABEL_AUTOMOTIVE_SHOPPING,
  LABEL_AUTOMOTIVE_INSURANCE,
  LABEL_EVENTS_LOCAL,
  LABEL_EVENTS_PERFORMANCES,
  LABEL_EVENTS_ENTERTAINMENT,
  LABEL_SERVICES_HOME,
  LABEL_BILLING_RECEIPTS,
  LABEL_BILLING_STATEMENTS,
  LABEL_BILLING_INVOICES,
  LABEL_NEWSLETTERS_CIVIC_AUSTIN,
} from './lib/constants.mjs';

const countOnly = process.argv.includes('--count');
const statsMode = process.argv.includes('--stats');
const verifyMode = process.argv.includes('--verify');
const schemaMode = process.argv.includes('--schema');

const CATEGORY_PRIORITY = [
  LABEL_KEEP_IMPORTANT, LABEL_EVENTS, LABEL_MONITORING,
  LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING,
];

const OTHER_CATEGORY_LABELS = [
  LABEL_FORUMS, LABEL_NEWSLETTERS, LABEL_JOB_SEARCH, LABEL_TRAVEL, LABEL_ADVOCACY,
];

const PRODUCT_UPDATES_SUBLABELS = [LABEL_PRODUCT_UPDATES_CHATGPT];

const EVENTS_SUBLABELS = [
  LABEL_EVENTS_MEETUP, LABEL_EVENTS_APA, LABEL_EVENTS_LUMA,
  LABEL_EVENTS_PERSONAL, LABEL_EVENTS_EVENTBRITE, LABEL_EVENTS_IMPORTANT,
  LABEL_EVENTS_LOCAL, LABEL_EVENTS_PERFORMANCES, LABEL_EVENTS_ENTERTAINMENT,
];

const SERVICES_SUBLABELS = [
  LABEL_SERVICES_REAL_ESTATE, LABEL_SERVICES_HEALTH, LABEL_SERVICES_UTILITIES,
  LABEL_SERVICES_HOME,
];

const BILLING_SUBLABELS = [
  LABEL_BILLING_CREDIT_MONITORING, LABEL_BILLING_MARKET_ALERTS, LABEL_BILLING_ACCOUNT_SECURITY,
  LABEL_BILLING_RECEIPTS, LABEL_BILLING_STATEMENTS, LABEL_BILLING_INVOICES,
];

const FORUMS_SUBLABELS = [LABEL_FORUMS_LINKEDIN_SOCIAL, LABEL_FORUMS_GLASSDOOR];

const NEWSLETTERS_SUBLABELS = [LABEL_NEWSLETTERS_LINKEDIN, LABEL_NEWSLETTERS_CIVIC_AUSTIN];

const JOB_SEARCH_SUBLABELS = [
  LABEL_JOB_SEARCH_LINKEDIN, LABEL_JOB_SEARCH_GLASSDOOR, LABEL_JOB_SEARCH_BACKSTAGE,
  LABEL_JOB_SEARCH_INDEED, LABEL_JOB_SEARCH_OTHER,
];

const TRAVEL_SUBLABELS = [LABEL_TRAVEL_AIRBNB_RESERVATIONS, LABEL_TRAVEL_AIRBNB_SUPPORT];

const PROMOTIONS_LABELS = [
  LABEL_PROMOTIONS_TRAVEL, LABEL_PROMOTIONS_TRAVEL_DISCOUNTS,
  LABEL_PROMOTIONS_RETAIL, LABEL_PROMOTIONS_BEAUTY, LABEL_PROMOTIONS_FOOD, LABEL_PROMOTIONS_FINANCIAL,
];

const ATTENTION_LABELS = [LABEL_TIME_SENSITIVE, LABEL_SECURITY_ACCOUNT, LABEL_VOICEMAIL, LABEL_NETWORKING];

const AUTOMOTIVE_LABELS = [LABEL_AUTOMOTIVE_SHOPPING, LABEL_AUTOMOTIVE_INSURANCE];

const ADVOCACY_SUBLABELS = [LABEL_ADVOCACY_POLITICAL, LABEL_ADVOCACY_NONPROFIT];

const TRACKED_LABELS = [
  LABEL_SENTRY, ...CATEGORY_PRIORITY, ...PRODUCT_UPDATES_SUBLABELS, ...EVENTS_SUBLABELS, ...SERVICES_SUBLABELS, ...BILLING_SUBLABELS,
  ...OTHER_CATEGORY_LABELS, ...FORUMS_SUBLABELS, ...NEWSLETTERS_SUBLABELS, ...JOB_SEARCH_SUBLABELS,
  ...TRAVEL_SUBLABELS, ...PROMOTIONS_LABELS, ...ATTENTION_LABELS, ...AUTOMOTIVE_LABELS, ...ADVOCACY_SUBLABELS, LABEL_PURCHASES_AMAZON,
];

const PREVIEW_LIMIT = 5;
const SUBJECT_MAX_LENGTH = 60;

const SYSTEM_LABEL_UNREAD = 'UNREAD';
const SYSTEM_LABEL_INBOX = 'INBOX';

// labels.get returns authoritative messagesTotal/messagesUnread; messages.list's
// resultSizeEstimate is an estimate Gmail caps at ~201 and cannot be trusted.
async function getLabelCounts(gmail, labelId) {
  const res = await gmail.users.labels.get({ userId: USER_ID, id: labelId });
  return { total: res.data.messagesTotal || 0, unread: res.data.messagesUnread || 0 };
}

async function listUnreadEmails(gmail) {
  if (countOnly) {
    const { total } = await getLabelCounts(gmail, SYSTEM_LABEL_UNREAD);
    console.log(`\nUnread messages: ${total}`);
    return;
  }

  const searchResponse = await gmail.users.messages.list({ userId: USER_ID, q: 'is:unread', maxResults: 500 });

  const messageIds = searchResponse.data.messages || [];

  console.log('LISTING UNREAD EMAILS\n');
  console.log(BANNER + '\n');
  console.log(`Total unread: ${messageIds.length}\n`);

  if (messageIds.length === 0) {
    console.log('Inbox is clean!\n');
    return;
  }

  const labelCache = await buildLabelCache(gmail);
  const labelMap = new Map([...labelCache.entries()].map(([name, id]) => [id, name]));

  const fullMsgs = await Promise.all(
    messageIds.map(msg =>
      gmail.users.messages.get({ userId: USER_ID, id: msg.id, format: 'metadata', metadataHeaders: ['Subject', 'From'] })
    )
  );

  const emails = fullMsgs.map(fullMsg => {
    const headers = fullMsg.data.payload?.headers || [];
    return {
      subject: getHeader(headers, 'Subject', '(no subject)'),
      from: getHeader(headers, 'From', '(unknown)'),
      labels: (fullMsg.data.labelIds || []).map(id => labelMap.get(id)).filter(Boolean),
    };
  });

  const categories = Object.fromEntries([...CATEGORY_PRIORITY, LABEL_SENTRY, 'Other'].map(k => [k, []]));

  for (const email of emails) {
    const matched = CATEGORY_PRIORITY.find(label => email.labels.includes(label));
    if (matched) {
      categories[matched].push(email);
    } else if (email.from.includes('sentry')) {
      categories[LABEL_SENTRY].push(email);
    } else {
      categories['Other'].push(email);
    }
  }

  for (const [category, items] of Object.entries(categories)) {
    if (items.length === 0) continue;
    console.log(`\n${category} (${items.length}):`);
    console.log(DIVIDER);
    items.slice(0, PREVIEW_LIMIT).forEach(email => {
      console.log(`  • ${email.subject.substring(0, SUBJECT_MAX_LENGTH)}`);
      console.log(`    From: ${extractDisplayName(email.from).substring(0, 50)}`);
    });
    if (items.length > PREVIEW_LIMIT) console.log(`  ... and ${items.length - PREVIEW_LIMIT} more`);
  }

  console.log('\n' + BANNER);
  console.log('\nSUMMARY\n');
  for (const [category, items] of Object.entries(categories)) {
    if (items.length > 0) console.log(`  ${category}: ${items.length}`);
  }
  console.log(`\nTotal: ${messageIds.length}`);
  console.log(BANNER + '\n');
}

async function showStats(gmail) {
  const labelMap = await buildLabelCache(gmail);

  const profile = await gmail.users.getProfile({ userId: USER_ID });
  console.log(`Total messages: ${profile.data.messagesTotal}`);
  console.log(`Total threads: ${profile.data.threadsTotal}`);

  const [unreadCounts, inboxCounts] = await Promise.all([
    getLabelCounts(gmail, SYSTEM_LABEL_UNREAD),
    getLabelCounts(gmail, SYSTEM_LABEL_INBOX),
  ]);
  console.log(`Unread: ${unreadCounts.total}`);
  console.log(`Unread in inbox: ${inboxCounts.unread}`);

  console.log('\nBy Label (total / unread):');
  const labelStats = await Promise.all(
    TRACKED_LABELS.map(async label => {
      const labelId = labelMap.get(label);
      if (!labelId) return { label, total: 0, unread: 0, missing: true };
      const { total, unread } = await getLabelCounts(gmail, labelId);
      return { label, total, unread };
    })
  );

  for (const { label, total, unread, missing } of labelStats) {
    if (missing) {
      console.log(`  ${label}: 0 (label not found)`);
    } else {
      console.log(`  ${label}: ${total} total, ${unread} unread`);
    }
  }
}

async function verifyLabels(gmail) {
  const labelCache = await buildLabelCache(gmail);
  const labelMapById = new Map([...labelCache.entries()].map(([name, id]) => [id, name]));

  console.log('Checking if labels were applied...\n');

  const meetupResult = await gmail.users.messages.list({ userId: USER_ID, q: 'from:info@email.meetup.com' });
  console.log(`Meetup emails found: ${meetupResult.data.resultSizeEstimate}`);

  if (meetupResult.data.messages?.length > 0) {
    const msg = await gmail.users.messages.get({ userId: USER_ID, id: meetupResult.data.messages[0].id });
    const labels = msg.data.labelIds || [];
    console.log(`Labels on first Meetup email: ${labels.map(id => labelMapById.get(id)).filter(Boolean).join(', ')}`);
    console.log(`Has 'Events' label: ${labels.some(id => labelMapById.get(id) === LABEL_EVENTS)}\n`);

    const alphaResult = await gmail.users.messages.list({ userId: USER_ID, q: 'from:news@alphasignal.ai' });
    if (alphaResult.data.messages?.length > 0) {
      const msg2 = await gmail.users.messages.get({ userId: USER_ID, id: alphaResult.data.messages[0].id });
      const labels2 = msg2.data.labelIds || [];
      console.log(`AlphaSignal email has 'Product Updates' label: ${labels2.some(id => labelMapById.get(id) === LABEL_PRODUCT_UPDATES)}`);
    }
  }
}

const SCHEMA_SAMPLE_SIZE = 50;

async function auditSchemaMarkup(gmail) {
  console.log('SCHEMA.ORG JSON-LD AUDIT\n');
  console.log(BANNER + '\n');

  const searchResponse = await gmail.users.messages.list({
    userId: USER_ID,
    q: 'is:unread',
    maxResults: SCHEMA_SAMPLE_SIZE,
  });

  const messageIds = searchResponse.data.messages || [];
  console.log(`Scanning ${messageIds.length} unread emails for schema.org markup...\n`);

  if (messageIds.length === 0) return;

  const fullMsgs = await Promise.all(
    messageIds.map(msg =>
      gmail.users.messages.get({ userId: USER_ID, id: msg.id, format: 'full' })
    )
  );

  const typeCounts = {};
  const categoryCounts = {};
  const samples = [];

  for (const fullMsg of fullMsgs) {
    const headers = fullMsg.data.payload?.headers || [];
    const subject = getHeader(headers, 'Subject', '(no subject)');
    const from = getHeader(headers, 'From', '(unknown)');

    const html = extractHtmlFromPayload(fullMsg.data.payload);
    const schemaObjects = extractSchemaMarkupFromGmailPayload(html);
    if (schemaObjects.length === 0) continue;

    const { category, types, metadata } = categorizeBySchema(schemaObjects);

    for (const type of types) {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    if (category) {
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }

    samples.push({ subject, from: extractDisplayName(from), types, category, metadata });
  }

  const withSchema = samples.length;
  const withoutSchema = messageIds.length - withSchema;

  console.log(`Emails with schema.org markup: ${withSchema}/${messageIds.length} (${Math.round(withSchema / messageIds.length * 100)}%)`);
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
  const gmail = createGmailClient();
  if (statsMode) return showStats(gmail);
  if (verifyMode) return verifyLabels(gmail);
  if (schemaMode) return auditSchemaMarkup(gmail);
  return listUnreadEmails(gmail);
}

run().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
