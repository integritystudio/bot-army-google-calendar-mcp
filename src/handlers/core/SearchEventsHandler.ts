import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { OAuth2Client } from "google-auth-library";
import { SearchEventsInput } from "../../tools/registry.js";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { calendar_v3 } from 'googleapis';
import { resolveTimeRange } from "../../utils/timezone-utils.js";
import { buildListFieldMask } from "../../utils/field-mask-builder.js";
import { formatEventsList } from "./eventFormatting.js";
import { ListEventsOptions } from "./types.js";

export class SearchEventsHandler extends BaseToolHandler {
    async runTool(args: any, oauth2Client: OAuth2Client): Promise<CallToolResult> {
        const validArgs = args as SearchEventsInput;
        const events = await this.searchEvents(oauth2Client, validArgs);

        if (events.length === 0) {
            return this.textResult("No events found matching your search criteria.");
        }

        const eventsWithCalendarId = events.map(event => ({
            ...event,
            calendarId: validArgs.calendarId
        }));

        const text = formatEventsList(eventsWithCalendarId);

        return this.textResult(text);
    }

    private async searchEvents(
        client: OAuth2Client,
        args: SearchEventsInput
    ): Promise<calendar_v3.Schema$Event[]> {
        try {
            const calendar = this.getCalendar(client);

            const timezone = args.timeZone || await this.getCalendarTimezone(client, args.calendarId);
            const { timeMin, timeMax } = resolveTimeRange(args.timeMin, args.timeMax, timezone);

            const fieldMask = buildListFieldMask(args.fields);

            const response = await calendar.events.list({
                calendarId: args.calendarId,
                q: args.query,
                timeMin,
                timeMax,
                singleEvents: true,
                orderBy: 'startTime',
                ...(fieldMask && { fields: fieldMask }),
                ...(args.privateExtendedProperty && { privateExtendedProperty: args.privateExtendedProperty }),
                ...(args.sharedExtendedProperty && { sharedExtendedProperty: args.sharedExtendedProperty })
            });
            return response.data.items || [];
        } catch (error) {
            throw this.handleGoogleApiError(error);
        }
    }

}
