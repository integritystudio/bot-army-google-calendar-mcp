/**
 * Mark Forums emails older than 5 days as read.
 * Usage: node mark-forums-read.mjs
 */
import { createGmailClient } from './lib/gmail-client.mjs';
import { GMAIL_UNREAD, LABEL_FORUMS } from './lib/constants.mjs';
import { searchAndModify } from './lib/gmail-batch-utils.mjs';

const gmail = createGmailClient();
const query = `label:"${LABEL_FORUMS}" is:unread older_than:5d`;

const count = await searchAndModify(gmail, query, { removeLabelIds: [GMAIL_UNREAD] });
console.log(`Marked ${count} Forums emails as read.`);
