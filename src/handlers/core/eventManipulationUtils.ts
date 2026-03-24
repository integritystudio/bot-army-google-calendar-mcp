import { calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { CreateEventInput, UpdateEventInput } from '../../tools/registry.js';
import { createTimeObject } from '../utils/datetime.js';
import { ConflictDetectionService } from '../../services/conflict-detection/index.js';
import { CONFLICT_DETECTION_CONFIG } from '../../services/conflict-detection/config.js';

export function buildEventForConflictCheckCreate(
  input: CreateEventInput,
  timezone: string
): calendar_v3.Schema$Event {
  return {
    summary: input.summary,
    description: input.description,
    start: createTimeObject(input.start, timezone),
    end: createTimeObject(input.end, timezone),
    attendees: input.attendees,
    location: input.location,
  };
}

export function buildEventForConflictCheckUpdate(
  input: UpdateEventInput,
  existingEvent: calendar_v3.Schema$Event,
  timezone: string
): calendar_v3.Schema$Event {
  return {
    ...existingEvent,
    id: input.eventId,
    summary: input.summary || existingEvent.summary,
    description: input.description || existingEvent.description,
    start: input.start ? createTimeObject(input.start, timezone) : existingEvent.start,
    end: input.end ? createTimeObject(input.end, timezone) : existingEvent.end,
    location: input.location || existingEvent.location,
  };
}

export function buildEventRequestBodyCreate(
  input: CreateEventInput,
  timezone: string
): calendar_v3.Schema$Event {
  return {
    summary: input.summary,
    description: input.description,
    start: createTimeObject(input.start, timezone),
    end: createTimeObject(input.end, timezone),
    attendees: input.attendees,
    location: input.location,
    colorId: input.colorId,
    reminders: input.reminders,
    recurrence: input.recurrence,
    transparency: input.transparency,
    visibility: input.visibility,
    guestsCanInviteOthers: input.guestsCanInviteOthers,
    guestsCanModify: input.guestsCanModify,
    guestsCanSeeOtherGuests: input.guestsCanSeeOtherGuests,
    anyoneCanAddSelf: input.anyoneCanAddSelf,
    conferenceData: input.conferenceData,
    extendedProperties: input.extendedProperties,
    attachments: input.attachments,
    source: input.source,
  };
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
