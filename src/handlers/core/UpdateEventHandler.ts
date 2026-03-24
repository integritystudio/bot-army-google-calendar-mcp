import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { OAuth2Client } from "google-auth-library";
import { UpdateEventInput } from "../../tools/registry.js";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { calendar_v3 } from 'googleapis';
import { RecurringEventHelpers, RecurringEventError, RECURRING_EVENT_ERRORS } from './RecurringEventHelpers.js';
import { createEventResponseWithConflicts } from "../utils.js";
import { ConflictDetectionService } from "../../services/conflict-detection/index.js";
import { createTimeObject } from "../../utils/timezone-utils.js";
import {
  buildEventForConflictCheckUpdate,
  performConflictCheck,
} from "./eventManipulationUtils.js";

export class UpdateEventHandler extends BaseToolHandler {
    private conflictDetectionService: ConflictDetectionService;
    
    constructor() {
        super();
        this.conflictDetectionService = new ConflictDetectionService();
    }
    
    async runTool(args: any, oauth2Client: OAuth2Client): Promise<CallToolResult> {
        const validArgs = args as UpdateEventInput;

        let conflicts = null;
        if (validArgs.checkConflicts !== false && (validArgs.start || validArgs.end)) {
            const calendar = this.getCalendar(oauth2Client);
            const existingEvent = await calendar.events.get({
                calendarId: validArgs.calendarId,
                eventId: validArgs.eventId
            });

            if (!existingEvent.data) {
                throw new Error('Event not found');
            }

            const timezone = validArgs.timeZone || await this.getCalendarTimezone(oauth2Client, validArgs.calendarId);
            const eventToCheck = buildEventForConflictCheckUpdate(validArgs, existingEvent.data, timezone);

            conflicts = await performConflictCheck(
                this.conflictDetectionService,
                oauth2Client,
                eventToCheck,
                validArgs.calendarId,
                {
                    checkDuplicates: false,
                    checkConflicts: true,
                    calendarsToCheck: validArgs.calendarsToCheck || [validArgs.calendarId],
                }
            );
        }

        const event = await this.updateEventWithScope(oauth2Client, validArgs);
        const text = createEventResponseWithConflicts(event, validArgs.calendarId, conflicts ?? undefined, "updated");

        return this.textResult(text);
    }

    private async updateEventWithScope(
        client: OAuth2Client,
        args: UpdateEventInput
    ): Promise<calendar_v3.Schema$Event> {
        try {
            const calendar = this.getCalendar(client);
            const helpers = new RecurringEventHelpers(calendar);

            // Get calendar's default timezone if not provided
            const defaultTimeZone = await this.getCalendarTimezone(client, args.calendarId);

            // Fetch event and detect type in single API call
            const { event, type: eventType } = await helpers.getEventAndType(args.eventId, args.calendarId);

            if (args.modificationScope && args.modificationScope !== 'all' && eventType !== 'recurring') {
                throw new RecurringEventError(
                    'Scope other than "all" only applies to recurring events',
                    RECURRING_EVENT_ERRORS.NON_RECURRING_SCOPE
                );
            }

            switch (args.modificationScope) {
                case 'thisEventOnly':
                    return this.updateSingleInstance(helpers, args, defaultTimeZone);
                case 'all':
                case undefined:
                    return this.updateAllInstances(helpers, args, defaultTimeZone);
                case 'thisAndFollowing':
                    return this.updateFutureInstances(helpers, args, defaultTimeZone, event);
                default:
                    throw new RecurringEventError(
                        `Invalid modification scope: ${args.modificationScope}`,
                        RECURRING_EVENT_ERRORS.INVALID_SCOPE
                    );
            }
        } catch (error) {
            if (error instanceof RecurringEventError) {
                throw error;
            }
            throw this.handleGoogleApiError(error);
        }
    }

    private async updateSingleInstance(
        helpers: RecurringEventHelpers,
        args: UpdateEventInput,
        defaultTimeZone: string
    ): Promise<calendar_v3.Schema$Event> {
        if (!args.originalStartTime) {
            throw new RecurringEventError(
                'originalStartTime is required for single instance updates',
                RECURRING_EVENT_ERRORS.MISSING_ORIGINAL_TIME
            );
        }

        const calendar = helpers.getCalendar();
        const instanceId = helpers.formatInstanceId(args.eventId, args.originalStartTime);
        
        const response = await calendar.events.patch({
            calendarId: args.calendarId,
            eventId: instanceId,
            requestBody: helpers.buildUpdateRequestBody(args, defaultTimeZone)
        });

        if (!response.data) throw new Error('Failed to update event instance');
        return response.data;
    }

    private async updateAllInstances(
        helpers: RecurringEventHelpers,
        args: UpdateEventInput,
        defaultTimeZone: string
    ): Promise<calendar_v3.Schema$Event> {
        const calendar = helpers.getCalendar();
        
        const response = await calendar.events.patch({
            calendarId: args.calendarId,
            eventId: args.eventId,
            requestBody: helpers.buildUpdateRequestBody(args, defaultTimeZone)
        });

        if (!response.data) throw new Error('Failed to update event');
        return response.data;
    }

    private async updateFutureInstances(
        helpers: RecurringEventHelpers,
        args: UpdateEventInput,
        defaultTimeZone: string,
        originalEvent?: calendar_v3.Schema$Event
    ): Promise<calendar_v3.Schema$Event> {
        if (!args.futureStartDate) {
            throw new RecurringEventError(
                'futureStartDate is required for future instance updates',
                RECURRING_EVENT_ERRORS.MISSING_FUTURE_DATE
            );
        }

        const calendar = helpers.getCalendar();
        const effectiveTimeZone = args.timeZone || defaultTimeZone;

        // Use passed event or fetch if not provided (for backward compatibility)
        let eventData = originalEvent;
        if (!eventData) {
            const originalResponse = await calendar.events.get({
                calendarId: args.calendarId,
                eventId: args.eventId
            });
            eventData = originalResponse.data;
        }

        if (!eventData.recurrence) {
            throw new Error('Event does not have recurrence rules');
        }

        // 1. Calculate UNTIL date and update original event
        const untilDate = helpers.calculateUntilDate(args.futureStartDate);
        const updatedRecurrence = helpers.updateRecurrenceWithUntil(eventData.recurrence, untilDate);

        await calendar.events.patch({
            calendarId: args.calendarId,
            eventId: args.eventId,
            requestBody: { recurrence: updatedRecurrence }
        });

        // 2. Create new recurring event starting from future date
        const newStartTime = args.start || args.futureStartDate;
        const newEndTime = args.end || helpers.calculateEndTime(newStartTime, eventData);

        const newEvent = {
            ...helpers.cleanEventForDuplication(eventData),
            ...helpers.buildUpdateRequestBody(args, defaultTimeZone),
            start: createTimeObject(newStartTime, effectiveTimeZone),
            end: createTimeObject(newEndTime, effectiveTimeZone)
        };

        const response = await calendar.events.insert({
            calendarId: args.calendarId,
            requestBody: newEvent
        });

        if (!response.data) throw new Error('Failed to create new recurring event');
        return response.data;
    }

}
