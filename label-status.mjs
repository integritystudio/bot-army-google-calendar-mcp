/**
 * Show unread/total counts per label and verify label application.
 *
 * Usage:
 *   node label-status.mjs          # show counts per label
 *   node label-status.mjs --verify # spot-check label application on sample emails
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import {
  USER_ID,
  LABEL_SENTRY, LABEL_KEEP_IMPORTANT, LABEL_EVENTS, LABEL_MONITORING,
  LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING,
} from './lib/constants.mjs';

const verifyMode = process.argv.includes('--verify');
const gmail = createGmailClient();

const labelsResponse = await gmail.users.labels.list({ userId: USER_ID });
const labelMap = new Map((labelsResponse.data.labels || []).map(l => [l.name, l.id]));
const labelMapById = new Map((labelsResponse.data.labels || []).map(l => [l.id, l.name]));

const TRACKED_LABELS = [LABEL_SENTRY, LABEL_KEEP_IMPORTANT, LABEL_EVENTS, LABEL_MONITORING, LABEL_PRODUCT_UPDATES, LABEL_COMMUNITIES, LABEL_SERVICES, LABEL_BILLING];

if (!verifyMode) {
  const profile = await gmail.users.getProfile({ userId: USER_ID });
  console.log(`Total messages: ${profile.data.messagesTotal}`);
  console.log(`Total threads: ${profile.data.threadsTotal}`);

  const [unreadResult, inboxResult] = await Promise.all([
    gmail.users.messages.list({ userId: USER_ID, q: 'is:unread' }),
    gmail.users.messages.list({ userId: USER_ID, q: 'is:unread in:inbox' }),
  ]);
  console.log(`Unread (is:unread): ${unreadResult.data.resultSizeEstimate}`);
  console.log(`Unread in inbox: ${inboxResult.data.resultSizeEstimate}`);

  console.log('\nBy Label (total / unread):');
  const labelStats = await Promise.all(
    TRACKED_LABELS.map(async label => {
      const labelId = labelMap.get(label);
      if (!labelId) return { label, total: 0, unread: 0, missing: true };
      const [totalRes, unreadRes] = await Promise.all([
        gmail.users.messages.list({ userId: USER_ID, q: `label:${labelId}` }),
        gmail.users.messages.list({ userId: USER_ID, q: `label:${labelId} is:unread` }),
      ]);
      return {
        label,
        total: totalRes.data.resultSizeEstimate || 0,
        unread: unreadRes.data.resultSizeEstimate || 0,
      };
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

if (verifyMode) {
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
