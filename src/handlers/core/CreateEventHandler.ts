import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { OAuth2Client } from "google-auth-library";
import { CreateEventInput } from "../../tools/registry.js";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { calendar_v3 } from 'googleapis';
import { createEventResponseWithConflicts, formatConflictWarnings } from "../utils.js";
import { validateEventId } from "../../utils/event-id-validator.js";
import { ConflictDetectionService } from "../../services/conflict-detection/index.js";
import { CONFLICT_DETECTION_CONFIG } from "../../services/conflict-detection/config.js";
import {
  buildEventForConflictCheckCreate,
  buildEventRequestBodyCreate,
  performConflictCheck,
  getConferenceAndAttachmentOptions,
} from "./eventManipulationUtils.js";

export class CreateEventHandler extends BaseToolHandler {
    private conflictDetectionService: ConflictDetectionService;
    
    constructor() {
        super();
        this.conflictDetectionService = new ConflictDetectionService();
    }
    
    async runTool(args: any, oauth2Client: OAuth2Client): Promise<CallToolResult> {
        const validArgs = args as CreateEventInput;

        const timezone = args.timeZone || await this.getCalendarTimezone(oauth2Client, validArgs.calendarId);
        const eventToCheck = buildEventForConflictCheckCreate(validArgs, timezone);

        const conflicts = await performConflictCheck(
            this.conflictDetectionService,
            oauth2Client,
            eventToCheck,
            validArgs.calendarId,
            {
                checkDuplicates: true,
                checkConflicts: true,
                calendarsToCheck: validArgs.calendarsToCheck || [validArgs.calendarId],
                duplicateSimilarityThreshold: validArgs.duplicateSimilarityThreshold,
            }
        );

        // Block creation if exact or near-exact duplicate found
        const exactDuplicate = conflicts.duplicates.find(
            dup => dup.event.similarity >= CONFLICT_DETECTION_CONFIG.DUPLICATE_THRESHOLDS.BLOCKING
        );

        if (exactDuplicate && validArgs.allowDuplicates !== true) {
            const duplicateDetails = formatConflictWarnings({
                hasConflicts: true,
                duplicates: [exactDuplicate],
                conflicts: []
            });

            const cleanedDetails = duplicateDetails.replace('⚠️ POTENTIAL DUPLICATES DETECTED:', '').trim();
            const similarityPercentage = Math.round(exactDuplicate.event.similarity * 100);

            return {
                content: [{
                    type: "text",
                    text: `⚠️ DUPLICATE EVENT DETECTED (${similarityPercentage}% similar)!\n\n${cleanedDetails}\n\nThis event appears to be a duplicate. To create anyway, set allowDuplicates to true.`
                }]
            };
        }

        const event = await this.createEvent(oauth2Client, validArgs);
        const text = createEventResponseWithConflicts(event, validArgs.calendarId, conflicts, "created");

        return {
            content: [{
                type: "text",
                text: text
            }]
        };
    }

    private async createEvent(
        client: OAuth2Client,
        args: CreateEventInput
    ): Promise<calendar_v3.Schema$Event> {
        try {
            if (args.eventId) {
                validateEventId(args.eventId);
            }

            const timezone = args.timeZone || await this.getCalendarTimezone(client, args.calendarId);
            const requestBody = buildEventRequestBodyCreate(args, timezone);

            if (args.eventId) {
                requestBody.id = args.eventId;
            }

            const options = getConferenceAndAttachmentOptions(args);
            const calendar = this.getCalendar(client);

            const response = await calendar.events.insert({
                calendarId: args.calendarId,
                requestBody,
                sendUpdates: args.sendUpdates,
                ...options,
            });

            if (!response.data) throw new Error('Failed to create event, no data returned');
            return response.data;
        } catch (error: any) {
            if (error?.code === 409 || error?.response?.status === 409) {
                throw new Error(`Event ID '${args.eventId}' already exists. Please use a different ID.`);
            }
            throw this.handleGoogleApiError(error);
        }
    }
}
