import { EmailMessageSchema, EmailCategorySchema, PrintSectionConfigSchema, EmailSubsectionSchema } from '../src/schemas/email-analyzer-types.ts';
import { BANNER } from './console-utils.mjs';

const ROW_DIVIDER = '─'.repeat(76);

const DEFAULT_SCORE = 5;
const HIGH_SCORE = 9;
const LOW_SCORE = 2;
const HIGH_THRESHOLD = 7;
const LOW_THRESHOLD = 3;

const HIGH_URGENCY_KEYWORDS = ['urgent', 'asap', 'immediate', 'critical', 'emergency', 'alert'];
const LOW_URGENCY_KEYWORDS = ['fyi', 'newsletter', 'digest', 'weekly', 'monthly', 'notification'];
const HIGH_IMPORTANCE_KEYWORDS = ['manager', 'boss', 'ceo', 'invoice', 'payment', 'contract', 'approved', 'rejected', 'decision'];
const LOW_IMPORTANCE_KEYWORDS = ['marketing', 'promotion', 'sale', 'discount', 'follow', 'subscribe'];

/**
 * Score content against keyword lists
 * @param {string} content - Text to score
 * @param {string[]} highKeywords - Keywords indicating high score
 * @param {string[]} lowKeywords - Keywords indicating low score
 * @returns {number} Score value (2, 5, or 9)
 */
export function scoreContent(content, highKeywords, lowKeywords) {
  if (highKeywords.some(k => content.includes(k))) return HIGH_SCORE;
  if (lowKeywords.some(k => content.includes(k))) return LOW_SCORE;
  return DEFAULT_SCORE;
}

/**
 * Categorize an email by urgency and importance
 * @param {Object} msg - Email message object
 * @returns {Object} Categorization with urgency and importance levels
 */
export function categorizeEmail(msg) {
  const validated = EmailMessageSchema.parse(msg);
  const subject = validated.subject.toLowerCase();
  const from = validated.from.toLowerCase();
  const snippet = validated.snippet.toLowerCase();
  const content = `${subject} ${from} ${snippet}`;

  const urgencyScore = scoreContent(content, HIGH_URGENCY_KEYWORDS, LOW_URGENCY_KEYWORDS);
  const importanceScore = scoreContent(content, HIGH_IMPORTANCE_KEYWORDS, LOW_IMPORTANCE_KEYWORDS);

  const urgency = urgencyScore >= HIGH_THRESHOLD ? 'High' : (urgencyScore <= LOW_THRESHOLD ? 'Low' : 'Medium');
  const importance = importanceScore >= HIGH_THRESHOLD ? 'High' : (importanceScore <= LOW_THRESHOLD ? 'Low' : 'Medium');

  return EmailCategorySchema.parse({ urgency, importance });
}

/**
 * Print email subsections with configurable truncation
 * @param {string} title - Section title
 * @param {Object[]} subsections - Email subsections with labels and emails
 * @param {Object} displayConfig - Display configuration (fromMax, subjectMax, snippetMax)
 */
export function printSection(title, subsections, displayConfig = {}) {
  const config = PrintSectionConfigSchema.parse(displayConfig);
  const { fromMax, subjectMax, snippetMax } = config;

  // Validate subsections
  subsections.forEach(s => EmailSubsectionSchema.parse(s));

  const hasContent = subsections.some(s => s.emails.length > 0);
  if (!hasContent) return;

  console.log(`\n${title}`);
  console.log(BANNER + "\n");

  subsections.forEach(({ label, emails, limit, count }) => {
    if (emails.length === 0) return;

    console.log(`  ${label}`);
    console.log('  ' + ROW_DIVIDER);

    if (count) {
      console.log(`  ${emails.length} promotional/newsletter emails\n`);
      return;
    }

    emails.slice(0, limit || Infinity).forEach((email, idx) => {
      console.log(`  ${idx + 1}. 👤 ${email.from.substring(0, fromMax)}`);
      console.log(`     📌 ${email.subject.substring(0, subjectMax)}`);
      console.log(`     📝 ${email.snippet.substring(0, snippetMax)}...`);
      console.log();
    });

    if (limit && emails.length > limit) {
      console.log(`  ... and ${emails.length - limit} more\n`);
    }
  });
}

export const ANALYZER_CONFIG = {
  DEFAULT_SCORE,
  HIGH_SCORE,
  LOW_SCORE,
  HIGH_THRESHOLD,
  LOW_THRESHOLD,
  BANNER,
  ROW_DIVIDER,
  HIGH_URGENCY_KEYWORDS,
  LOW_URGENCY_KEYWORDS,
  HIGH_IMPORTANCE_KEYWORDS,
  LOW_IMPORTANCE_KEYWORDS
};
