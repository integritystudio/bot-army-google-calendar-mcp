export const ALLOWED_EVENT_FIELDS = [
  'id',
  'summary',
  'description',
  'start',
  'end',
  'location',
  'attendees',
  'colorId',
  'transparency',
  'extendedProperties',
  'reminders',
  'conferenceData',
  'attachments',
  'status',
  'htmlLink',
  'created',
  'updated',
  'creator',
  'organizer',
  'recurrence',
  'recurringEventId',
  'originalStartTime',
  'visibility',
  'iCalUID',
  'sequence',
  'hangoutLink',
  'anyoneCanAddSelf',
  'guestsCanInviteOthers',
  'guestsCanModify',
  'guestsCanSeeOtherGuests',
  'privateCopy',
  'locked',
  'source',
  'eventType'
] as const;

export type AllowedEventField = typeof ALLOWED_EVENT_FIELDS[number];

export const DEFAULT_EVENT_FIELDS: AllowedEventField[] = [
  'id',
  'summary',
  'start',
  'end',
  'status',
  'htmlLink',
  'location',
  'attendees'
];

const LIST_METADATA_FIELDS = [
  'nextPageToken',
  'nextSyncToken',
  'kind',
  'etag',
  'summary',
  'updated',
  'timeZone',
  'accessRole',
  'defaultReminders'
] as const;

export function validateFields(fields: string[]): AllowedEventField[] {
  const validFields: AllowedEventField[] = [];
  const invalidFields: string[] = [];

  for (const field of fields) {
    if (ALLOWED_EVENT_FIELDS.includes(field as AllowedEventField)) {
      validFields.push(field as AllowedEventField);
    } else {
      invalidFields.push(field);
    }
  }

  if (invalidFields.length > 0) {
    throw new Error(`Invalid fields requested: ${invalidFields.join(', ')}. Allowed fields: ${ALLOWED_EVENT_FIELDS.join(', ')}`);
  }

  return validFields;
}

function resolveFields(requestedFields: string[], includeDefaults: boolean): AllowedEventField[] {
  const validFields = validateFields(requestedFields);
  return includeDefaults
    ? [...new Set([...DEFAULT_EVENT_FIELDS, ...validFields])]
    : validFields;
}

export function buildSingleEventFieldMask(
  requestedFields?: string[],
  includeDefaults: boolean = true
): string | undefined {
  if (!requestedFields || requestedFields.length === 0) return undefined;
  return resolveFields(requestedFields, includeDefaults).join(',');
}

export function buildListFieldMask(
  requestedFields?: string[],
  includeDefaults: boolean = true
): string | undefined {
  if (!requestedFields || requestedFields.length === 0) return undefined;
  const fields = resolveFields(requestedFields, includeDefaults);
  return `items(${fields.join(',')}),${LIST_METADATA_FIELDS.join(',')}`;
}
