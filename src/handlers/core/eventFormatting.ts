/**
 * Event list formatting utilities for consistent output across handlers
 */

import { calendar_v3 } from 'googleapis';
import { formatEventWithDetails } from '../utils.js';

export interface ExtendedEvent extends calendar_v3.Schema$Event {
  calendarId?: string;
}

export interface FormatEventsListOptions {
  groupByCalendar?: boolean;
  header?: string;
}

/**
 * Format a list of events for display
 * @param events - Array of events to format
 * @param options - Formatting options (groupByCalendar, custom header)
 * @returns Formatted text for display
 */
export function formatEventsList(
  events: ExtendedEvent[],
  options: FormatEventsListOptions = {}
): string {
  const { groupByCalendar = false } = options;

  if (groupByCalendar) {
    return formatGroupedEventsList(events);
  }

  return formatSimpleEventsList(events);
}

function formatSimpleEventsList(events: ExtendedEvent[]): string {
  let text = `Found ${events.length} event(s):\n\n`;

  events.forEach((event, index) => {
    const eventDetails = formatEventWithDetails(event, event.calendarId);
    text += `${index + 1}. ${eventDetails}\n\n`;
  });

  return text.trim();
}

function formatGroupedEventsList(events: ExtendedEvent[]): string {
  const grouped = groupEventsByCalendar(events);
  const calendarCount = Object.keys(grouped).length;

  let text = `Found ${events.length} event(s) across ${calendarCount} calendar(s):\n\n`;

  for (const [calendarId, calendarEvents] of Object.entries(grouped)) {
    text += `Calendar: ${calendarId}\n\n`;
    calendarEvents.forEach((event, index) => {
      const eventDetails = formatEventWithDetails(event, event.calendarId);
      text += `${index + 1}. ${eventDetails}\n\n`;
    });
    text += '\n';
  }

  return text.trim();
}

function groupEventsByCalendar(events: ExtendedEvent[]): Record<string, ExtendedEvent[]> {
  return events.reduce((acc, event) => {
    const calId = event.calendarId || 'Unknown';
    if (!acc[calId]) acc[calId] = [];
    acc[calId].push(event);
    return acc;
  }, {} as Record<string, ExtendedEvent[]>);
}
