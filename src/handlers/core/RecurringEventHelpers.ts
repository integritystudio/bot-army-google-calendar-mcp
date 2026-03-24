import { calendar_v3 } from 'googleapis';
import {
  TIME_DURATIONS,
  formatBasicDateTime,
  oneDayBefore,
  stripUntilAndCount,
  buildUntilClause,
  isRRuleString,
} from '../../utils/date-utils.js';

export class RecurringEventHelpers {
  private calendar: calendar_v3.Calendar;

  constructor(calendar: calendar_v3.Calendar) {
    this.calendar = calendar;
  }

  /**
   * Detects if an event is recurring or single
   */
  async detectEventType(eventId: string, calendarId: string): Promise<'recurring' | 'single'> {
    const response = await this.calendar.events.get({
      calendarId,
      eventId
    });

    const event = response.data;
    return (event.recurrence?.length ?? 0) > 0 ? 'recurring' : 'single';
  }

  /**
   * Fetches an event and detects if it's recurring or single.
   * Returns both the event object and its type to avoid redundant fetches.
   */
  async getEventAndType(eventId: string, calendarId: string): Promise<{
    event: calendar_v3.Schema$Event;
    type: 'recurring' | 'single';
  }> {
    const response = await this.calendar.events.get({
      calendarId,
      eventId
    });

    const event = response.data;
    const type = (event.recurrence?.length ?? 0) > 0 ? 'recurring' : 'single';
    return { event, type };
  }

  /**
   * Formats an instance ID for single instance updates
   */
  formatInstanceId(eventId: string, originalStartTime: string): string {
    const utcDate = new Date(originalStartTime);
    const basicTimeFormat = formatBasicDateTime(utcDate);
    return `${eventId}_${basicTimeFormat}`;
  }

  /**
   * Calculates the UNTIL date for future instance updates
   */
  calculateUntilDate(futureStartDate: string): string {
    const futureDate = new Date(futureStartDate);
    const untilDate = oneDayBefore(futureDate);
    return formatBasicDateTime(untilDate);
  }

  /**
   * Calculates end time based on original duration
   */
  calculateEndTime(newStartTime: string, originalEvent: calendar_v3.Schema$Event): string {
    const newStart = new Date(newStartTime);
    const originalStart = new Date(originalEvent.start!.dateTime!);
    const originalEnd = new Date(originalEvent.end!.dateTime!);
    const durationMs = originalEnd.getTime() - originalStart.getTime();

    return new Date(newStart.getTime() + durationMs).toISOString();
  }

  /**
   * Updates recurrence rule with UNTIL clause
   */
  updateRecurrenceWithUntil(recurrence: string[], untilDate: string): string[] {
    if (!recurrence || recurrence.length === 0) {
      throw new Error('No recurrence rule found');
    }

    const updatedRecurrence: string[] = [];
    let foundRRule = false;

    for (const rule of recurrence) {
      if (isRRuleString(rule)) {
        foundRRule = true;
        const updatedRule = stripUntilAndCount(rule) + `;UNTIL=${untilDate}`;
        updatedRecurrence.push(updatedRule);
      } else {
        updatedRecurrence.push(rule);
      }
    }

    if (!foundRRule) {
      throw new Error('No RRULE found in recurrence rules');
    }

    return updatedRecurrence;
  }

  /**
   * Cleans event fields for new event creation
   */
  cleanEventForDuplication(event: calendar_v3.Schema$Event): calendar_v3.Schema$Event {
    const cleanedEvent = { ...event };
    
    // Remove fields that shouldn't be duplicated
    delete cleanedEvent.id;
    delete cleanedEvent.etag;
    delete cleanedEvent.iCalUID;
    delete cleanedEvent.created;
    delete cleanedEvent.updated;
    delete cleanedEvent.htmlLink;
    delete cleanedEvent.hangoutLink;
    
    return cleanedEvent;
  }

  /**
   * Builds request body for event updates
   */
  buildUpdateRequestBody(args: any, defaultTimeZone?: string): calendar_v3.Schema$Event {
    const requestBody: calendar_v3.Schema$Event = {};

    this.setIfPresent(requestBody, 'summary', args.summary);
    this.setIfPresent(requestBody, 'description', args.description);
    this.setIfPresent(requestBody, 'location', args.location);
    this.setIfPresent(requestBody, 'colorId', args.colorId);
    this.setIfPresent(requestBody, 'attendees', args.attendees);
    this.setIfPresent(requestBody, 'reminders', args.reminders);
    this.setIfPresent(requestBody, 'recurrence', args.recurrence);

    let timeChanged = false;
    const effectiveTimeZone = args.timeZone || defaultTimeZone;

    if (args.start !== undefined && args.start !== null) {
      requestBody.start = { dateTime: args.start, timeZone: effectiveTimeZone };
      timeChanged = true;
    }
    if (args.end !== undefined && args.end !== null) {
      requestBody.end = { dateTime: args.end, timeZone: effectiveTimeZone };
      timeChanged = true;
    }

    if (timeChanged || (!args.start && !args.end && effectiveTimeZone)) {
      requestBody.start = requestBody.start || {};
      requestBody.end = requestBody.end || {};
      requestBody.start.timeZone = effectiveTimeZone;
      requestBody.end.timeZone = effectiveTimeZone;
    }

    return requestBody;
  }

  private setIfPresent(obj: any, key: string, value: any): void {
    if (value !== undefined && value !== null) {
      obj[key] = value;
    }
  }
}

/**
 * Custom error class for recurring event errors
 */
export class RecurringEventError extends Error {
  public code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'RecurringEventError';
    this.code = code;
  }
}

export const RECURRING_EVENT_ERRORS = {
  INVALID_SCOPE: 'INVALID_MODIFICATION_SCOPE',
  MISSING_ORIGINAL_TIME: 'MISSING_ORIGINAL_START_TIME',
  MISSING_FUTURE_DATE: 'MISSING_FUTURE_START_DATE',
  PAST_FUTURE_DATE: 'FUTURE_DATE_IN_PAST',
  NON_RECURRING_SCOPE: 'SCOPE_NOT_APPLICABLE_TO_SINGLE_EVENT'
}; 