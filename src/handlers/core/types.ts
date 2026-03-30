import { calendar_v3 } from 'googleapis';

export interface ExtendedEvent extends calendar_v3.Schema$Event {
  calendarId: string;
}

export interface ListEventsOptions {
  timeMin?: string;
  timeMax?: string;
  timeZone?: string;
  fields?: string[];
  privateExtendedProperty?: string[];
  sharedExtendedProperty?: string[];
}

/** Pick only ListEventsOptions fields from a superset object (e.g. args with calendarId). */
export function extractListEventsOptions(args: ListEventsOptions): ListEventsOptions {
  const { timeMin, timeMax, timeZone, fields, privateExtendedProperty, sharedExtendedProperty } = args;
  return { timeMin, timeMax, timeZone, fields, privateExtendedProperty, sharedExtendedProperty };
}
