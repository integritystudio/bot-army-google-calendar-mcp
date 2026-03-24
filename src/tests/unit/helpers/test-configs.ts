/**
 * Shared test configuration objects to eliminate duplication across test suites
 */

export const ANALYZER_CONFIG_BASE = {
  DEFAULT_SCORE: 5,
  HIGH_SCORE: 9,
  LOW_SCORE: 2,
  HIGH_THRESHOLD: 7,
  LOW_THRESHOLD: 3,
  SECTION_DIVIDER: '═'.repeat(80),
  ROW_DIVIDER: '─'.repeat(76)
};

export const ANALYZER_CONFIG_COMPLETE = {
  ...ANALYZER_CONFIG_BASE,
  HIGH_URGENCY_KEYWORDS: ['urgent', 'asap'],
  LOW_URGENCY_KEYWORDS: ['fyi', 'newsletter'],
  HIGH_IMPORTANCE_KEYWORDS: ['invoice', 'payment'],
  LOW_IMPORTANCE_KEYWORDS: ['sale', 'discount']
};

export const ANALYZER_CONFIG_INVALID_KEYWORDS = {
  ...ANALYZER_CONFIG_BASE,
  HIGH_URGENCY_KEYWORDS: 'urgent', // Invalid: string instead of array
  LOW_URGENCY_KEYWORDS: ['fyi'],
  HIGH_IMPORTANCE_KEYWORDS: ['invoice'],
  LOW_IMPORTANCE_KEYWORDS: ['sale']
};

export const ANALYZER_CONFIG_WITH_EXTRA = {
  ...ANALYZER_CONFIG_COMPLETE,
  EXTRA_FIELD: 'not allowed'
};
