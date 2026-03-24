import { calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { CreateEventInput, UpdateEventInput } from '../../tools/registry.js';
import { createTimeObject } from '../../utils/timezone-utils.js';
import { ConflictDetectionService } from '../../services/conflict-detection/index.js';
import { CONFLICT_DETECTION_CONFIG } from '../../services/conflict-detection/config.js';

export function buildCoreEvent(
  input: CreateEventInput | UpdateEventInput,
  timezone: string,
  existingEvent?: calendar_v3.Schema$Event
): Pick<calendar_v3.Schema$Event, 'summary' | 'description' | 'start' | 'end' | 'attendees' | 'location'> {
  const summary = 'summary' in input ? input.summary : (input.summary || existingEvent?.summary);
  const description = 'description' in input ? input.description : (input.description || existingEvent?.description);
  const start = ('start' in input && input.start) ? createTimeObject(input.start, timezone) : existingEvent?.start;
  const end = ('end' in input && input.end) ? createTimeObject(input.end, timezone) : existingEvent?.end;
  const attendees = 'attendees' in input ? input.attendees : undefined;
  const location = 'location' in input ? input.location : (input.location || existingEvent?.location);

  return {
    summary,
    description,
    start,
    end,
    attendees,
    location,
  };
}

export function buildOptionalEventFields(
  input: CreateEventInput | UpdateEventInput
): Pick<calendar_v3.Schema$Event, 'colorId' | 'reminders' | 'recurrence' | 'transparency' | 'visibility' | 'guestsCanInviteOthers' | 'guestsCanModify' | 'guestsCanSeeOtherGuests' | 'anyoneCanAddSelf' | 'conferenceData' | 'extendedProperties' | 'attachments' | 'source'> {
  const fields: any = {};

  if ('colorId' in input && input.colorId !== undefined) fields.colorId = input.colorId;
  if ('reminders' in input && input.reminders !== undefined) fields.reminders = input.reminders;
  if ('recurrence' in input && input.recurrence !== undefined) fields.recurrence = input.recurrence;
  if ('transparency' in input && input.transparency !== undefined) fields.transparency = input.transparency;
  if ('visibility' in input && input.visibility !== undefined) fields.visibility = input.visibility;
  if ('guestsCanInviteOthers' in input && input.guestsCanInviteOthers !== undefined) fields.guestsCanInviteOthers = input.guestsCanInviteOthers;
  if ('guestsCanModify' in input && input.guestsCanModify !== undefined) fields.guestsCanModify = input.guestsCanModify;
  if ('guestsCanSeeOtherGuests' in input && input.guestsCanSeeOtherGuests !== undefined) fields.guestsCanSeeOtherGuests = input.guestsCanSeeOtherGuests;
  if ('anyoneCanAddSelf' in input && input.anyoneCanAddSelf !== undefined) fields.anyoneCanAddSelf = input.anyoneCanAddSelf;
  if ('conferenceData' in input && input.conferenceData !== undefined) fields.conferenceData = input.conferenceData;
  if ('extendedProperties' in input && input.extendedProperties !== undefined) fields.extendedProperties = input.extendedProperties;
  if ('attachments' in input && input.attachments !== undefined) fields.attachments = input.attachments;
  if ('source' in input && input.source !== undefined) fields.source = input.source;

  return fields;
}

export function buildEventForConflictCheckCreate(
  input: CreateEventInput,
  timezone: string
): calendar_v3.Schema$Event {
  return buildCoreEvent(input, timezone) as calendar_v3.Schema$Event;
}

export function buildEventForConflictCheckUpdate(
  input: UpdateEventInput,
  existingEvent: calendar_v3.Schema$Event,
  timezone: string
): calendar_v3.Schema$Event {
  return {
    ...existingEvent,
    id: input.eventId,
    ...buildCoreEvent(input, timezone, existingEvent),
  } as calendar_v3.Schema$Event;
}

export function buildEventRequestBodyCreate(
  input: CreateEventInput,
  timezone: string
): calendar_v3.Schema$Event {
  return {
    ...buildCoreEvent(input, timezone),
    ...buildOptionalEventFields(input),
  } as calendar_v3.Schema$Event;
}

export interface ConflictCheckOptions {
  checkDuplicates?: boolean;
  checkConflicts?: boolean;
  calendarsToCheck?: string[];
  duplicateSimilarityThreshold?: number;
}

export async function performConflictCheck(
  conflictService: ConflictDetectionService,
  oauth2Client: OAuth2Client,
  eventToCheck: calendar_v3.Schema$Event,
  calendarId: string,
  options: ConflictCheckOptions = {}
): Promise<any> {
  const defaults: ConflictCheckOptions = {
    checkDuplicates: false,
    checkConflicts: true,
    calendarsToCheck: [calendarId],
    duplicateSimilarityThreshold: CONFLICT_DETECTION_CONFIG.DEFAULT_DUPLICATE_THRESHOLD,
  };

  const finalOptions = { ...defaults, ...options };

  return conflictService.checkConflicts(
    oauth2Client,
    eventToCheck,
    calendarId,
    finalOptions
  );
}

export function getConferenceAndAttachmentOptions(
  input: CreateEventInput | UpdateEventInput
): { conferenceDataVersion?: number; supportsAttachments?: boolean } {
  const result: { conferenceDataVersion?: number; supportsAttachments?: boolean } = {};

  if ('conferenceData' in input && input.conferenceData) {
    result.conferenceDataVersion = 1;
  }

  if ('attachments' in input && input.attachments) {
    result.supportsAttachments = true;
  }

  return result;
}
