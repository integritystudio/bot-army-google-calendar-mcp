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
