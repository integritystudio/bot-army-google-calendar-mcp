/**
 * Adapter to use simple-rrule library for RRULE parsing and expansion.
 * This module wraps simple-rrule to integrate with our existing date utilities.
 */

import {
  parseRecurrenceFromString,
  getRRuleString,
  expandRRuleFromString,
} from 'simple-rrule';
import type { IRrule } from 'simple-rrule';

/**
 * Parse an RRULE string into an object.
 * @param rruleString RRULE string (e.g., "RRULE:FREQ=DAILY;COUNT=5")
 * @returns Parsed rule object or undefined if parsing fails
 */
export function parseRRule(rruleString: string): IRrule | undefined {
  return parseRecurrenceFromString(rruleString);
}

/**
 * Convert a parsed RRule object back to an RRULE string.
 * @param rule Parsed rule object
 * @returns RRULE string
 */
export function serializeRRule(rule: IRrule): string {
  return getRRuleString(rule);
}

/**
 * Expand an RRULE string to get all occurrences in a date range.
 * @param rruleString RRULE string
 * @param startDate Start of date range
 * @param endDate End of date range
 * @returns Array of Date objects for each occurrence
 */
export function expandRRuleToDateRange(
  rruleString: string,
  startDate: Date,
  endDate: Date,
): Date[] {
  const result = expandRRuleFromString(rruleString, startDate, endDate);
  return result.events.map(e => e.date);
}

/**
 * Update the UNTIL clause in a parsed rule.
 * @param rule Parsed rule object
 * @param untilDate New UNTIL date
 * @returns Updated rule object
 */
export function setRRuleUntil(rule: IRrule, untilDate: Date): IRrule {
  const updated = { ...rule };
  const basicFormat = untilDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  updated.until = basicFormat;
  return updated;
}

/**
 * Remove UNTIL and COUNT constraints from a rule.
 * @param rule Parsed rule object
 * @returns Updated rule object without constraints
 */
export function clearRRuleConstraints(rule: IRrule): IRrule {
  return {
    ...rule,
    until: undefined,
    count: 0,
  };
}
