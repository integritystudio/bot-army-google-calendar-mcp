/**
 * Label event mail found by keyword, archiving the events that have already happened.
 *
 * Unlike mark-past-events-read.mjs this finds candidates by subject/sender keyword
 * rather than by an existing label, and it labels rather than marking read. The
 * classification itself is shared: lib/event-classifier.mjs.
 *
 * The sweep stays capped. The query matches on keywords rather than senders, so an
 * unbounded run would label and archive any mail merely mentioning a workshop.
 *
 * Usage: node filter-events-by-date.mjs
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { runIfMain, fail } from './lib/cli-utils.mjs';
import { GMAIL_INBOX, LABEL_EVENTS, LABEL_KEEP_IMPORTANT, DEFAULT_MAX_RESULTS } from './lib/constants.mjs';
import { classifyByEventDate } from './lib/event-classifier.mjs';
import { listAllMessageIds } from './lib/gmail-message-utils.mjs';
import { batchModifyMessages } from './lib/gmail-batch-utils.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';
import { BANNER, printComplete } from './lib/console-utils.mjs';

const EVENT_KEYWORDS = '(event OR meeting OR conference OR workshop OR seminar OR webinar OR presentation OR summit OR expo OR networking OR panel OR forum OR gathering OR ceremony OR celebration)';
const EVENT_SENDERS = '(meetup OR eventbrite OR "international house" OR calendly OR calendar)';

async function filterEventsByDate() {
  const gmail = createGmailClient();

  console.log('FILTERING EVENTS BY DATE (WITH DATE-BASED ARCHIVE)\n');
  console.log(BANNER + '\n');

  const labelCache = await buildLabelCache(gmail);
  const eventsLabelId = labelCache.get(LABEL_EVENTS);
  const keepImportantLabelId = labelCache.get(LABEL_KEEP_IMPORTANT);

  if (!eventsLabelId) fail('Events label not found');

  const searchQuery = `is:unread (subject:${EVENT_KEYWORDS} OR from:${EVENT_SENDERS}) ${keepImportantLabelId ? `-label:"${LABEL_KEEP_IMPORTANT}"` : ''}`;
  const ids = await listAllMessageIds(gmail, searchQuery, { limit: DEFAULT_MAX_RESULTS });
  console.log(`Found ${ids.length} event-like emails\n`);

  if (ids.length === 0) {
    console.log('No event emails to process\n');
    return;
  }

  // Applied per chunk rather than once at the end, so a failure partway keeps the
  // classifications already acted on. Past events are archived as well as labeled;
  // future ones keep their place in the inbox.
  let labeled = 0;
  let archived = 0;
  const totals = await classifyByEventDate(gmail, ids, {
    onChunk: async ({ past, future }) => {
      if (future.length > 0) {
        labeled += await batchModifyMessages(gmail, future, { addLabelIds: [eventsLabelId] });
      }
      if (past.length > 0) {
        archived += await batchModifyMessages(gmail, past, {
          addLabelIds: [eventsLabelId],
          removeLabelIds: [GMAIL_INBOX],
        });
      }
    },
  });

  console.log(`Future events: ${totals.future} | Past events: ${totals.past} | Unknown: ${totals.unknown}\n`);
  if (totals.failed > 0) {
    console.warn(`${totals.failed} message(s) could not be fetched and were left alone.\n`);
  }

  printComplete(`Future events labeled: ${labeled} | Past events archived: ${archived} | Unknown: ${totals.unknown}\n`);
}

runIfMain(import.meta.url, filterEventsByDate);
