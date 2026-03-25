/**
 * Batch response processing utilities for multi-calendar operations
 */

import { ExtendedEvent } from './types.js';

export interface BatchResponseResult<T extends ExtendedEvent = ExtendedEvent> {
  events: T[];
  errors: Array<{ calendarId: string; error: string }>;
}

export interface ProcessBatchResponsesOptions {
  includeErrors?: boolean;
  errorFormatter?: (statusCode: number, body: any) => string;
}

const defaultErrorFormatter = (statusCode: number, body: any): string => {
  return body?.error?.message || body?.message || `HTTP ${statusCode}`;
};

/**
 * Process batch API responses, mapping events to their source calendars
 * @param responses - Array of batch responses with statusCode and body
 * @param calendarIds - Parallel array of calendar IDs corresponding to responses
 * @param options - Configuration for error handling and formatting
 * @returns Object with events array and optional errors array
 */
export function processBatchResponses<T extends ExtendedEvent = ExtendedEvent>(
  responses: any[],
  calendarIds: string[],
  options: ProcessBatchResponsesOptions = {}
): BatchResponseResult<T> {
  const events: T[] = [];
  const errors: Array<{ calendarId: string; error: string }> = [];
  const errorFormatter = options.errorFormatter || defaultErrorFormatter;

  responses.forEach((response, index) => {
    const calendarId = calendarIds[index];

    if (response.statusCode === 200 && response.body?.items) {
      const items = response.body.items.map((item: any) => ({
        ...item,
        calendarId
      })) as T[];
      events.push(...items);
    } else if (options.includeErrors !== false) {
      errors.push({
        calendarId,
        error: errorFormatter(response.statusCode, response.body)
      });
    }
  });

  return { events, errors };
}
